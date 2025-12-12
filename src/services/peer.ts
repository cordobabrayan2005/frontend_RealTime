import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useAuthStore } from '../stores/authStore';

export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  audioStreamRef: React.RefObject<MediaStream | null>,
  videoStreamRef: React.RefObject<MediaStream | null>,
  cameraOn: boolean,
  micOn: boolean,
  onRemoteVideoStream: (userId: string, stream: MediaStream) => void,
  onRemoteVideoStreamRemoved: (userId: string) => void
) {
  const { user } = useAuthStore();
  const [peerVoice, setPeerVoice] = useState<Peer | null>(null);
  const [peerVideo, setPeerVideo] = useState<Peer | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, any>>(new Map());

  const PEERJS_HOST_VOICE = import.meta.env.VITE_PEERJS_HOST_VOICE || 'realtimevoicebackend.onrender.com';
  const PEERJS_HOST_VIDEO = import.meta.env.VITE_PEERJS_HOST_VIDEO || 'realtimevideocambackend.onrender.com';

  // ==================== PEER DE VOZ (PERSISTENTE) ====================
  useEffect(() => {
    if (!meetingId || !user || !voiceSocket) return;  // No depende de micOn

    console.log('[FRONT] Inicializando Peer de voz...');
    const newPeerVoice = new Peer(`${user.id}_voice`, {
      host: PEERJS_HOST_VOICE,
      path: '/',
      secure: true,
      port: 443,
      debug: 1,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeerVoice.on('open', (id) => {
      console.log('[FRONT] ✅ Peer voz conectado:', id);
      setPeerStatus('connected');
      voiceSocket.emit('join-voice-room', { meetingId, peerId: `${user.id}_voice`, userId: user.id });
    });

    newPeerVoice.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de voz de:', call.peer);
      if (audioStreamRef.current && micOn) {
        call.answer(audioStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de voz recibido de:', call.peer);
          const audio = document.createElement('audio');
          audio.srcObject = remoteStream;
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.play().catch(err => console.error('Autoplay audio:', err));
        });
        // Crear DataChannel para mute
        const dataChannel = call.peerConnection.createDataChannel('mute-channel');
        dataChannel.onopen = () => {
          console.log('[FRONT] DataChannel abierto para mute con:', call.peer);
          // Enviar estado inicial de mute
          dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
        };
        dataChannel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'mute') {
            // Mutear/desmutear el audio remoto localmente
            const audioElement = document.querySelector(`audio[data-peer="${call.peer}"]`) as HTMLAudioElement;
            if (audioElement) {
              audioElement.muted = data.muted;
            }
          }
        };
        // Guardar DataChannel en el call
        call.dataChannel = dataChannel;
      } else {
        console.log('[FRONT] Rechazando llamada de voz - mic apagado');
        call.close();
      }
      call.on('close', () => console.log('[FRONT] Llamada de voz cerrada'));
      call.on('error', (err) => console.error('[FRONT] Error en llamada de voz:', err));
      peerCallsRef.current.set(call.peer, call);
    });

    newPeerVoice.on('error', (err) => {
      console.error('[FRONT] Error Peer voz:', err);
      setPeerStatus('error');
    });

    setPeerVoice(newPeerVoice);

    return () => {
      console.log('[FRONT] Cleanup: destruyendo peer voz');
      newPeerVoice.destroy();
    };
  }, [meetingId, user?.id, voiceSocket]);  // Sin micOn

  // ==================== PEER DE VIDEO (PERSISTENTE) ====================
  useEffect(() => {
    if (!meetingId || !user || !videoSocket) return;  // No depende de cameraOn

    console.log('[FRONT] Inicializando Peer de video...');
    const newPeerVideo = new Peer(`${user.id}_video`, {
      host: PEERJS_HOST_VIDEO,
      path: '/',
      secure: true,
      port: 443,
      debug: 1,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeerVideo.on('open', (id) => {
      console.log('[FRONT] ✅ Peer video conectado:', id);
      setPeerStatus('connected');
      videoSocket.emit('join-video-room', { meetingId, peerId: `${user.id}_video`, userId: user.id });
    });

    newPeerVideo.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de video de:', call.peer);
      if (videoStreamRef.current && cameraOn) {
        call.answer(videoStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de video recibido de:', call.peer);
          const userId = call.peer.split('_')[0];
          onRemoteVideoStream(userId, remoteStream);
        });
        // Crear DataChannel para video state
        const dataChannel = call.peerConnection.createDataChannel('video-channel');
        dataChannel.onopen = () => {
          console.log('[FRONT] DataChannel abierto para video con:', call.peer);
          dataChannel.send(JSON.stringify({ type: 'video-state', enabled: cameraOn }));
        };
        dataChannel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'video-state') {
            console.log('[FRONT] Video state recibido:', data.enabled, 'de', call.peer);
            // Manejar en Videocall.tsx
          }
        };
        call.dataChannel = dataChannel;
      } else {
        console.log('[FRONT] Rechazando llamada de video - cámara apagada');
        call.close();
      }
      call.on('close', () => {
        console.log('[FRONT] Llamada de video cerrada');
        const userId = call.peer.split('_')[0];
        onRemoteVideoStreamRemoved(userId);
      });
      call.on('error', (err) => console.error('[FRONT] Error en llamada de video:', err));
      peerCallsRef.current.set(call.peer, call);
    });

    newPeerVideo.on('error', (err) => {
      console.error('[FRONT] Error Peer video:', err);
      setPeerStatus('error');
    });

    setPeerVideo(newPeerVideo);

    return () => {
      console.log('[FRONT] Cleanup: destruyendo peer video');
      newPeerVideo.destroy();
    };
  }, [meetingId, user?.id, videoSocket]);  // Sin cameraOn

  // ==================== INICIAR LLAMADAS ====================
  const initiateCall = async (peerId: string) => {
    if (peerId.endsWith('_voice') && micOn && peerVoice && audioStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const callVoice = peerVoice.call(peerId, audioStreamRef.current);
      peerCallsRef.current.set(peerId, callVoice);

      // Manejar DataChannel en llamada iniciada
      callVoice.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream de voz recibido de:', peerId);
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.setAttribute('data-peer', peerId);  // Para identificar
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.play().catch(err => console.error('Autoplay audio:', err));
      });

      // Escuchar DataChannel
      callVoice.peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'mute') {
            const audioElement = document.querySelector(`audio[data-peer="${peerId}"]`) as HTMLAudioElement;
            if (audioElement) {
              audioElement.muted = data.muted;
            }
          }
        };
      };
    } else if (peerId.endsWith('_video') && cameraOn && peerVideo && videoStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de video a:', peerId);
      const callVideo = peerVideo.call(peerId, videoStreamRef.current);
      peerCallsRef.current.set(peerId, callVideo);
      // Manejar stream remoto
      callVideo.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream de video recibido de:', peerId);
        const userId = peerId.split('_')[0];
        onRemoteVideoStream(userId, remoteStream);
      });
      // Escuchar DataChannel
      callVideo.peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'video-state') {
            console.log('[FRONT] Video state recibido:', data.enabled, 'de', peerId);
            // Manejar en Videocall.tsx
          }
        };
      };
    } else {
      console.log('[FRONT] No se puede iniciar llamada - stream no disponible');
    }
  };

  // Agregar función para enviar mute a todos los peers
  const sendMuteToPeers = (muted: boolean) => {
    peerCallsRef.current.forEach((call) => {
      if (call.dataChannel && call.dataChannel.readyState === 'open') {
        call.dataChannel.send(JSON.stringify({ type: 'mute', muted }));
      }
    });
  };

  const sendVideoStateToPeers = (enabled: boolean) => {
    peerCallsRef.current.forEach((call) => {
      if (call.dataChannel && call.dataChannel.readyState === 'open') {
        call.dataChannel.send(JSON.stringify({ type: 'video-state', enabled }));
      }
    });
  };

  // Exportar sendMuteToPeers
  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers,
    sendVideoStateToPeers
  };
}