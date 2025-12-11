import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useAuthStore } from '../stores/authStore';

export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  mediaStreamRef: React.RefObject<MediaStream | null>,
  cameraOn: boolean,
  micOn: boolean,
  remoteVideoRefs: React.RefObject<Map<string, MediaStream>>
) {
  const { user } = useAuthStore();
  const [peerVoice, setPeerVoice] = useState<Peer | null>(null);
  const [peerVideo, setPeerVideo] = useState<Peer | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, any>>(new Map());

  const PEERJS_HOST_VOICE = import.meta.env.VITE_PEERJS_HOST_VOICE || 'realtimevoicebackend.onrender.com';
  const PEERJS_HOST_VIDEO = import.meta.env.VITE_PEERJS_HOST_VIDEO || 'realtimevideocambackend.onrender.com';

  // ==================== PEER DE VOZ (SOLO DEPENDE DE micOn) ====================
  useEffect(() => {
    if (!meetingId || !user || !voiceSocket || !micOn) {
      if (peerVoice) {
        peerVoice.destroy();
        setPeerVoice(null);
      }
      return;
    }

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
      // Unirse inmediatamente sin delay
      voiceSocket.emit('join-voice-room', { meetingId, peerId: `${user.id}_voice`, userId: user.id });
    });

    newPeerVoice.on('call', (call) => {
      if (mediaStreamRef.current && micOn) {
        console.log('[FRONT] Contestando llamada de voz de:', call.peer);
        call.answer(mediaStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de voz recibido de:', call.peer);
          const audio = document.createElement('audio');
          audio.srcObject = remoteStream;
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.play().catch(err => console.error('Autoplay audio:', err));
        });
        call.on('close', () => {
          console.log('[FRONT] Llamada de voz cerrada');
        });
        call.on('error', (err) => {
          console.error('[FRONT] Error en llamada de voz:', err);
        });
        peerCallsRef.current.set(call.peer, call);
      } else {
        console.log('[FRONT] Rechazando llamada de voz - no hay stream');
        call.close();
      }
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
  }, [meetingId, user?.id, voiceSocket, micOn]);  // Solo micOn

  // ==================== PEER DE VIDEO (SOLO DEPENDE DE cameraOn) ====================
  useEffect(() => {
    if (!meetingId || !user || !videoSocket || !cameraOn) {
      if (peerVideo) {
        peerVideo.destroy();
        setPeerVideo(null);
      }
      return;
    }

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
      // Unirse inmediatamente sin delay
      videoSocket.emit('join-video-room', { meetingId, peerId: `${user.id}_video`, userId: user.id });
    });

    newPeerVideo.on('call', (call) => {
      if (!call.peer) {
        console.warn('[FRONT] Incoming call has no peer ID, ignoring');
        return;
      }
      console.log('[FRONT] Contestando llamada de video de:', call.peer);

      if (mediaStreamRef.current && cameraOn) {
        call.answer(mediaStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de video recibido de:', call.peer);
          const video = document.createElement('video');
          video.srcObject = remoteStream;
          video.autoplay = true;
          video.setAttribute('playsinline', 'true');
          video.muted = false;
          video.play().catch(err => console.error('Autoplay video:', err));
          remoteVideoRefs.current.set(call.peer, remoteStream);
        });
        call.on('close', () => {
          console.log('[FRONT] Llamada de video cerrada');
          remoteVideoRefs.current.delete(call.peer);
        });
        call.on('error', (err) => {
          console.error('[FRONT] Error en llamada de video:', err);
        });
        peerCallsRef.current.set(call.peer, call);
      } else {
        console.log('[FRONT] Rechazando llamada de video - no hay stream');
        call.close();
      }
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
  }, [meetingId, user?.id, videoSocket, cameraOn]);  // Solo cameraOn

  // ==================== INICIAR LLAMADAS ====================
  const initiateCall = async (peerId: string) => {
    if (peerId.endsWith('_voice') && micOn && peerVoice && mediaStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const callVoice = peerVoice.call(peerId, mediaStreamRef.current);
      peerCallsRef.current.set(peerId, callVoice);
    } else if (peerId.endsWith('_video') && cameraOn && peerVideo && mediaStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de video a:', peerId);
      const callVideo = peerVideo.call(peerId, mediaStreamRef.current);
      peerCallsRef.current.set(peerId, callVideo);
    } else {
      console.log('[FRONT] No se puede iniciar llamada - peer no disponible o media apagada');
    }
  };

  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall
  };
}