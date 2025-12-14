import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
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
  audioStreamRef: React.RefObject<MediaStream | null>,
  videoStreamRef: React.RefObject<MediaStream | null>,
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

  const attachMuteChannel = (channel: RTCDataChannel, peerKey: string) => {
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'mute') {
          // Buscar el elemento video (no audio) para controlar el mute
          const videoElement = document.querySelector(`video[data-audio-peer="${peerKey}"]`) as HTMLVideoElement | null;
          if (videoElement) {
            // En lugar de mutear el elemento, controlar el track del stream
            if (videoElement.srcObject instanceof MediaStream) {
              const audioTracks = videoElement.srcObject.getAudioTracks();
              audioTracks.forEach(track => {
                track.enabled = !data.muted;
              });
            }
          }
        }
      } catch (error) {
        console.warn('[FRONT] Error procesando mensaje de mute:', error);
      }
    };
  };

  // CORRECCIÓN PRINCIPAL: Usar VIDEO en lugar de AUDIO para mejor compatibilidad
  const ensureRemoteAudioElement = (peerId: string, stream: MediaStream) => {
    console.log('[FRONT] Creando/actualizando elemento para audio de:', peerId, 
      'Tracks de audio:', stream.getAudioTracks().length);
    
    // Usar VIDEO en lugar de AUDIO - mejor compatibilidad con autoplay
    let video = document.querySelector(`video[data-audio-peer="${peerId}"]`) as HTMLVideoElement | null;
    if (!video) {
      video = document.createElement('video');
      video.setAttribute('data-audio-peer', peerId);
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = false; // CRÍTICO: no mutear para audio
      video.volume = 1.0;
      
      // Ocultar completamente pero mantener activo
      video.style.position = 'absolute';
      video.style.left = '-9999px';
      video.style.top = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-1';
      
      document.body.appendChild(video);
      console.log('[FRONT] Elemento video creado para audio de:', peerId);
    }
    
    // Verificar si los tracks de audio están presentes
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[FRONT] Stream sin tracks de audio para:', peerId);
    } else {
      console.log('[FRONT] Audio track enabled:', audioTracks[0].enabled);
    }
    
    // Solo actualizar si es necesario
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      
      // Intentar reproducir inmediatamente
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[FRONT] Autoplay bloqueado para:', peerId, err.name || err.message);
          
          // Estrategia de fallback para navegadores restrictivos
          const resumeAudio = () => {
            console.log('[FRONT] Reintentando reproducir audio después de interacción');
            video?.play().catch(e => console.error('[FRONT] Error al reanudar:', e));
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
          };
          
          // Esperar cualquier interacción del usuario
          document.addEventListener('click', resumeAudio, { once: true });
          document.addEventListener('touchstart', resumeAudio, { once: true });
          document.addEventListener('keydown', resumeAudio, { once: true });
        });
      }
    }
  };

  const callPeer = (peerInstance: Peer | null, peerId: string, stream?: MediaStream): MediaConnection | null => {
    if (!peerInstance) return null;
    return stream
      ? peerInstance.call(peerId, stream)
      : (peerInstance as unknown as { call: (id: string) => MediaConnection }).call(peerId);
  };

  const answerPeerCall = (call: any, stream?: MediaStream) => {
    if (stream) {
      call.answer(stream);
    } else {
      call.answer();
    }
  };

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
      const existingCall = peerCallsRef.current.get(call.peer);
      if (existingCall && existingCall !== call) {
        try {
          existingCall.close();
        } catch (err) {
          console.warn('[FRONT] Error cerrando llamada de voz previa:', err);
        }
        peerCallsRef.current.delete(call.peer);
      }
      const outboundStream = audioStreamRef.current ?? undefined;
      answerPeerCall(call, outboundStream);

      call.on('stream', (remoteStream: MediaStream) => {
        console.log('[FRONT] Stream de voz recibido de:', call.peer);
        // Usar la nueva función mejorada
        ensureRemoteAudioElement(call.peer, remoteStream);
      });

      try {
        const dataChannel = call.peerConnection?.createDataChannel('mute-channel');
        if (dataChannel) {
          dataChannel.onopen = () => {
            dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
          };
          attachMuteChannel(dataChannel, call.peer);
          call.dataChannel = dataChannel;
        }
      } catch (error) {
        console.warn('[FRONT] Error creando DataChannel de mute (entrante):', error);
      }

      if (call.peerConnection) {
        call.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
          attachMuteChannel(event.channel, call.peer);
        };
      }
      call.on('close', () => {
        console.log('[FRONT] Llamada de voz cerrada');
        // Eliminar el elemento de audio cuando se cierra la llamada
        const videoElement = document.querySelector(`video[data-audio-peer="${call.peer}"]`);
        if (videoElement) {
          videoElement.remove();
        }
      });
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
      // Limpiar todos los elementos de audio al desmontar
      document.querySelectorAll('video[data-audio-peer]').forEach(el => el.remove());
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
      videoSocket.emit('join-video-room', {
        meetingId,
        peerId: newPeerVideo.id,
        userId: user.id,
        displayName: user.name || user.email || user.id,
      });
    });

    newPeerVideo.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de video de:', call.peer);
      const existingCall = peerCallsRef.current.get(call.peer);
      if (existingCall && existingCall !== call) {
        try {
          existingCall.close();
        } catch (err) {
          console.warn('[FRONT] Error cerrando llamada de video previa:', err);
        }
        peerCallsRef.current.delete(call.peer);
      }
      if (videoStreamRef.current && cameraOn) {
        call.answer(videoStreamRef.current);
      } else {
        call.answer();
      }

      call.on('stream', (remoteStream: MediaStream) => {
        console.log('[FRONT] Stream de video recibido de:', call.peer);
        const userId = extractUserIdFromPeer(call.peer);
        remoteVideoRefs.current.set(userId, remoteStream);
        bumpRemoteStreamsVersion();
      });

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
    if (peerId.endsWith('_voice') && peerVoice) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const existingCall = peerCallsRef.current.get(peerId);
      if (existingCall) {
        try {
          existingCall.close();
        } catch (err) {
          console.warn('[FRONT] Error cerrando llamada de voz saliente previa:', err);
        }
        peerCallsRef.current.delete(peerId);
      }
      const outboundStream = audioStreamRef.current ?? undefined;
      const callVoice = callPeer(peerVoice, peerId, outboundStream);
      if (!callVoice) {
        console.warn('[FRONT] No se pudo iniciar la llamada de voz, instancia Peer inválida');
        return;
      }
      peerCallsRef.current.set(peerId, callVoice);

      // Manejar DataChannel en llamada iniciada
      callVoice.on('stream', (remoteStream: MediaStream) => {
        console.log('[FRONT] Stream de voz recibido de:', peerId);
        // Usar la nueva función mejorada
        ensureRemoteAudioElement(peerId, remoteStream);
      });

      // Escuchar DataChannel
      callVoice.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
        attachMuteChannel(event.channel, peerId);
      };
      try {
        const dataChannel = callVoice.peerConnection?.createDataChannel('mute-channel');
        if (dataChannel) {
          dataChannel.onopen = () => {
            dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
          };
          attachMuteChannel(dataChannel, peerId);
          callVoice.dataChannel = dataChannel;
        }
      } catch (error) {
        console.warn('[FRONT] Error creando DataChannel de mute (saliente):', error);
      }
      
      // Limpiar elemento de audio al cerrar la llamada
      callVoice.on('close', () => {
        const videoElement = document.querySelector(`video[data-audio-peer="${peerId}"]`);
        if (videoElement) {
          videoElement.remove();
        }
      });
    } else if (peerId.endsWith('_video') && peerVideo) {
      console.log('[FRONT] Iniciando llamada de video a:', peerId);
      const existingCall = peerCallsRef.current.get(peerId);
      if (existingCall) {
        try {
          existingCall.close();
        } catch (err) {
          console.warn('[FRONT] Error cerrando llamada de video saliente previa:', err);
        }
        peerCallsRef.current.delete(peerId);
      }
      const streamToSend = cameraOn && videoStreamRef.current ? videoStreamRef.current : undefined;
      const callVideo = callPeer(peerVideo, peerId, streamToSend);
      if (!callVideo) {
        console.warn('[FRONT] No se pudo iniciar la llamada de video, instancia Peer inválida');
        return;
      }
      peerCallsRef.current.set(peerId, callVideo);
      callVideo.on('stream', (remoteStream: MediaStream) => {
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

  const syncVideoTrack = useCallback((stream: MediaStream | null) => {
    const track = stream?.getVideoTracks()[0] ?? null;
    peerCallsRef.current.forEach((call, peerId) => {
      if (!peerId.endsWith('_video')) {
        return;
      }
      const pc: RTCPeerConnection | undefined = call?.peerConnection;
      if (!pc) {
        return;
      }
      const senders = pc.getSenders().filter((sender) => sender.track?.kind === 'video');
      if (track) {
        if (senders.length > 0) {
          senders.forEach((sender) => {
            sender.replaceTrack(track).catch((err) => {
              console.warn('[FRONT] Error al reemplazar track de video:', err);
            });
          });
        } else {
          try {
            if (stream) {
              pc.addTrack(track, stream);
            }
          } catch (err) {
            console.warn('[FRONT] Error agregando track de video:', err);
          }
        }
      } else {
        senders.forEach((sender) => {
          sender.replaceTrack(null).catch((err) => {
            console.warn('[FRONT] Error al detener track de video:', err);
          });
        });
      }
    });
  }, []);

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
    sendMuteToPeers,
    syncVideoTrack,
  };
}