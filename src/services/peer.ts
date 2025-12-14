import { useState, useEffect, useRef, useMemo } from 'react';
import Peer from 'peerjs';
import { useAuthStore } from '../stores/authStore';

type PeerEndpointConfig = {
  host: string;
  port: number;
  secure: boolean;
  path: string;
};

type PeerOverrides = {
  path?: string;
  port?: string;
  secure?: string;
};

const ensureLeadingSlash = (value?: string): string => {
  if (!value) return '/';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const parseBoolean = (value?: string): boolean | undefined => {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised === 'true') return true;
  if (normalised === 'false') return false;
  return undefined;
};

const parsePort = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolvePeerConfig = (
  source: string | undefined,
  fallback: string,
  fallbackHost?: string,
  overrides: PeerOverrides = {}
): PeerEndpointConfig => {
  const candidate = (source && source.trim()) || fallback;
  const hasProtocol = candidate.includes('://');
  const normalised = hasProtocol ? candidate : `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(normalised);
  } catch (error) {
    if (!fallbackHost) {
      throw error;
    }
    const secureFallback = parseBoolean(overrides.secure);
    const secure = secureFallback !== undefined ? secureFallback : fallback.startsWith('https://');
    const portOverride = parsePort(overrides.port);
    const port = portOverride ?? (secure ? 443 : 80);
    return {
      host: fallbackHost,
      secure,
      port,
      path: ensureLeadingSlash(overrides.path),
    };
  }

  const secureOverride = parseBoolean(overrides.secure);
  const secure = secureOverride !== undefined ? secureOverride : url.protocol === 'https:';
  const portOverride = parsePort(overrides.port);
  const port = portOverride ?? (url.port ? parseInt(url.port, 10) : (secure ? 443 : 80));

  return {
    host: url.hostname,
    secure,
    port,
    path: ensureLeadingSlash(overrides.path),
  };
};

const extractUserIdFromPeer = (peerId: string): string => peerId.replace(/_(voice|video)$/i, '');

export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  audioStreamRef: React.RefObject<MediaStream | null>,  // Corregido: Usar audioStreamRef
  videoStreamRef: React.RefObject<MediaStream | null>,  // Corregido: Usar videoStreamRef
  cameraOn: boolean,
  micOn: boolean,
  remoteVideoRefs: React.RefObject<Map<string, MediaStream>>,
  bumpRemoteStreamsVersion: () => void,
) {
  const { user } = useAuthStore();
  const [peerVoice, setPeerVoice] = useState<Peer | null>(null);
  const [peerVideo, setPeerVideo] = useState<Peer | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, any>>(new Map());

  const isLocalhost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }, []);

  const voicePeerConfig = useMemo(() => {
    const fallbackBase = import.meta.env.VITE_VOICE_BACKEND_URL || 'https://realtimevoicebackend.onrender.com';
    return resolvePeerConfig(
      import.meta.env.VITE_PEERJS_URL_VOICE || import.meta.env.VITE_PEERJS_HOST_VOICE,
      fallbackBase,
      import.meta.env.VITE_PEERJS_HOST_VOICE,
      {
        path: import.meta.env.VITE_PEERJS_PATH_VOICE,
        port: import.meta.env.VITE_PEERJS_PORT_VOICE,
        secure: import.meta.env.VITE_PEERJS_SECURE_VOICE,
      }
    );
  }, []);

  const videoPeerConfig = useMemo(() => {
    const fallbackBase = isLocalhost ? 'http://localhost:10001' : 'https://realtimevideocambackend.onrender.com';
    return resolvePeerConfig(
      import.meta.env.VITE_PEERJS_URL_VIDEO || import.meta.env.VITE_VIDEO_BACKEND_URL || import.meta.env.VITE_PEERJS_HOST_VIDEO,
      fallbackBase,
      import.meta.env.VITE_PEERJS_HOST_VIDEO,
      {
        path: import.meta.env.VITE_PEERJS_PATH_VIDEO,
        port: import.meta.env.VITE_PEERJS_PORT_VIDEO,
        secure: import.meta.env.VITE_PEERJS_SECURE_VIDEO,
      }
    );
  }, [isLocalhost]);

  // ==================== PEER DE VOZ (PERSISTENTE) ====================
  useEffect(() => {
    if (!meetingId || !user || !voiceSocket) return;  // No depende de micOn

    console.log('[FRONT] Inicializando Peer de voz...');
    const newPeerVoice = new Peer(`${user.id}_voice`, {
      host: voicePeerConfig.host,
      path: voicePeerConfig.path,
      secure: voicePeerConfig.secure,
      port: voicePeerConfig.port,
      debug: 1,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeerVoice.on('open', (id) => {
      console.log('[FRONT] ✅ Peer voz conectado:', id);
      setPeerStatus('connected');
      voiceSocket.emit('join-voice-room', { meetingId, peerId: newPeerVoice.id, userId: user.id });
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
  }, [meetingId, user?.id, voiceSocket, voicePeerConfig]);  // Sin micOn

  // ==================== PEER DE VIDEO (PERSISTENTE) ====================
  useEffect(() => {
    if (!meetingId || !user || !videoSocket) return;  // No depende de cameraOn

    console.log('[FRONT] Inicializando Peer de video...');
    const newPeerVideo = new Peer(`${user.id}_video`, {
      host: videoPeerConfig.host,
      path: videoPeerConfig.path,
      secure: videoPeerConfig.secure,
      port: videoPeerConfig.port,
      debug: 1,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeerVideo.on('open', (id) => {
      console.log('[FRONT] ✅ Peer video conectado:', id);
      setPeerStatus('connected');
      videoSocket.emit('join-video-room', { meetingId, peerId: newPeerVideo.id, userId: user.id });
    });

    newPeerVideo.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de video de:', call.peer);
      if (videoStreamRef.current && cameraOn) {
        call.answer(videoStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de video recibido de:', call.peer);
          const userId = extractUserIdFromPeer(call.peer);
          remoteVideoRefs.current.set(userId, remoteStream);
          bumpRemoteStreamsVersion();
        });
      } else {
        console.log('[FRONT] Rechazando llamada de video - cámara apagada');
        call.close();
      }
      call.on('close', () => {
        console.log('[FRONT] Llamada de video cerrada');
        const userId = extractUserIdFromPeer(call.peer);
        remoteVideoRefs.current.delete(userId);
        bumpRemoteStreamsVersion();
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
  }, [meetingId, user?.id, videoSocket, videoPeerConfig]);  // Sin cameraOn

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
      callVideo.on('stream', (remoteStream) => {
        const participantId = extractUserIdFromPeer(peerId);
        remoteVideoRefs.current.set(participantId, remoteStream);
        bumpRemoteStreamsVersion();
      });

      callVideo.on('close', () => {
        const participantId = extractUserIdFromPeer(peerId);
        remoteVideoRefs.current.delete(participantId);
        bumpRemoteStreamsVersion();
      });

      callVideo.on('error', (err: unknown) => {
        console.error('[FRONT] Error en llamada de video saliente:', err);
      });
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

  // Exportar sendMuteToPeers
  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers
  };
}