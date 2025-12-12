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
    if (!meetingId || !user || !videoSocket) return;

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

      // IMPORTANTE: Siempre contestar la llamada, incluso si la cámara está apagada
      // Enviar stream vacío si no hay video, para mantener la conexión WebRTC
      const streamToAnswer = cameraOn && videoStreamRef.current
        ? videoStreamRef.current
        : new MediaStream(); // Stream vacío para mantener conexión

      call.answer(streamToAnswer);

      call.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream de video recibido de:', call.peer);
        console.log('[FRONT] Remote stream tiene tracks de video:', remoteStream.getVideoTracks().length);

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
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'video-state') {
            console.log('[FRONT] Video state recibido:', data.enabled, 'de', call.peer);
            // Aquí puedes manejar el estado del video remoto si es necesario
          }
        } catch (err) {
          console.error('[FRONT] Error procesando mensaje DataChannel:', err);
        }
      };

      call.dataChannel = dataChannel;
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
  }, [meetingId, user?.id, videoSocket]); // Mantener sin cameraOn aquí

  // ==================== INICIAR LLAMADAS ====================
  const initiateCall = async (peerId: string) => {
    console.log('[FRONT] initiateCall para:', peerId, {
      isVideoCall: peerId.endsWith('_video'),
      cameraOn,
      hasVideoStream: !!videoStreamRef.current,
      hasPeerVideo: !!peerVideo
    });

    if (peerId.endsWith('_voice') && micOn && peerVoice && audioStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      // ... código existente para voz ...

    } else if (peerId.endsWith('_video') && peerVideo) {
      // INICIO: Corrección crítica aquí
      console.log('[FRONT] Iniciando llamada de video a:', peerId);

      try {
        // Siempre iniciar la llamada, incluso con cámara apagada
        // Si no hay stream de video, enviar uno vacío
        const videoStream = cameraOn && videoStreamRef.current
          ? videoStreamRef.current
          : new MediaStream();

        console.log('[FRONT] Stream para llamada:', {
          hasVideoTracks: videoStream.getVideoTracks().length,
          cameraOn,
          streamType: videoStreamRef.current ? 'real' : 'empty'
        });

        const callVideo = peerVideo.call(peerId, videoStream);
        peerCallsRef.current.set(peerId, callVideo);

        // Manejar stream remoto
        callVideo.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de video recibido de:', peerId, {
            videoTracks: remoteStream.getVideoTracks().length,
            audioTracks: remoteStream.getAudioTracks().length
          });

          const userId = peerId.split('_')[0];
          onRemoteVideoStream(userId, remoteStream);
        });

        // Escuchar DataChannel
        callVideo.peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dataChannel.onopen = () => {
            console.log('[FRONT] DataChannel abierto para video (outgoing)');
            // Enviar estado inicial
            dataChannel.send(JSON.stringify({ type: 'video-state', enabled: cameraOn }));
          };

          dataChannel.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'video-state') {
                console.log('[FRONT] Video state recibido:', data.enabled, 'de', peerId);
                // Manejar estado del video remoto si es necesario
              }
            } catch (err) {
              console.error('[FRONT] Error procesando DataChannel:', err);
            }
          };
        };

        callVideo.on('close', () => {
          console.log('[FRONT] Llamada de video cerrada con:', peerId);
          const userId = peerId.split('_')[0];
          onRemoteVideoStreamRemoved(userId);
          peerCallsRef.current.delete(peerId);
        });

        callVideo.on('error', (err) => {
          console.error('[FRONT] Error en llamada de video con', peerId, ':', err);
        });

      } catch (error) {
        console.error('[FRONT] Error al iniciar llamada de video:', error);
      }
    } else {
      console.log('[FRONT] Condiciones no cumplidas para llamada:', {
        peerId,
        endsWithVideo: peerId.endsWith('_video'),
        hasPeerVideo: !!peerVideo
      });
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