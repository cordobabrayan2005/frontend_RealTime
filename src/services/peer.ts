import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook para manejar Peer.js y conexiones WebRTC
 */
export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  mediaStreamRef: React.RefObject<MediaStream | null>
) {
  const { user } = useAuthStore();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, any>>(new Map());

  const PEERJS_HOST = import.meta.env.VITE_PEERJS_HOST || 'realtimevoicebackend.onrender.com';
  const PEERJS_PATH = '/';

  useEffect(() => {
    if (!meetingId || !user || !voiceSocket) return;

    console.log('[FRONT] Inicializando Peer.js para servidor en Render...');

    const newPeer = new Peer(user.id, {
      host: PEERJS_HOST,
      path: PEERJS_PATH,
      secure: true,
      port: 443,
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    setPeer(newPeer);
    setPeerStatus('connecting');

    const connectionTimeout = setTimeout(() => {
      if (newPeer && !newPeer.disconnected) {
        console.log('[FRONT] ⏱️ Timeout de conexión Peer.js (20s)');
        setPeerStatus('error');

        const newPeerWithTimeout = new Peer(`${user.id}_${Date.now()}`, {
          host: PEERJS_HOST,
          path: PEERJS_PATH,
          secure: true,
          port: 443,
          debug: 0,
          config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          }
        });

        setPeer(newPeerWithTimeout);
      }
    }, 20000);

    newPeer.on('open', (id) => {
      clearTimeout(connectionTimeout);
      console.log('[FRONT] ✅ Peer.js conectado con ID:', id);
      setPeerStatus('connected');

      setTimeout(() => {
        voiceSocket.emit('join-voice-room', { meetingId, peerId: user.id, userId: user.id });
      }, 1000);
    });

    newPeer.on('error', (err) => {
      console.error('[FRONT] ❌ Error de Peer.js:', err.type, err.message);

      if (err.type === 'network' || err.type === 'disconnected' || err.message.includes('1006') || err.message.includes('Lost connection')) {
        console.log('[FRONT] 🔄 Error WebSocket detectado. Intentando solución...');
        setPeerStatus('error');

        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            console.log('[FRONT] Reconectando Peer.js...');
            setPeerStatus('connecting');

            try {
              newPeer.reconnect();
            } catch (reconnectErr) {
              console.error('[FRONT] Error al reconectar:', reconnectErr);

              const newPeerInstance = new Peer(`${user.id}_${Date.now()}`, {
                host: PEERJS_HOST,
                path: PEERJS_PATH,
                secure: true,
                port: 443,
                debug: 0,
                config: {
                  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                }
              });

              setPeer(newPeerInstance);
            }
          }
        }, 5000);
      }
    });

    newPeer.on('call', (call) => {
      if (!call.peer) {
        console.warn('[FRONT] Incoming call has no peer ID, ignoring');
        return;
      }
      console.log('[FRONT] Incoming call from:', call.peer);

      if (mediaStreamRef.current) {
        console.log('[FRONT] Answering call with stream');
        call.answer(mediaStreamRef.current);

        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Received remote stream from:', call.peer);
          const audio = new Audio();
          audio.srcObject = remoteStream;

          audio.play().then(() => {
            console.log('[FRONT] ✅ Audio reproduciendo correctamente');
          }).catch(err => {
            console.error('[FRONT] ❌ Error de autoplay:', err);
            alert('Haz clic en la página para habilitar audio.');
            const enable = () => {
              audio.play().catch(e => console.error('Aún fallando:', e));
              document.removeEventListener('click', enable);
            };
            document.addEventListener('click', enable, { once: true });
          });
        });

        call.on('close', () => {
          console.log('[FRONT] Call closed');
        });

        call.on('error', (err) => {
          console.error('[FRONT] Call error:', err);
        });

        peerCallsRef.current.set(call.peer, call);
      } else {
        console.log('[FRONT] Rejecting call - no stream');
        call.close();
      }
    });

    return () => {
      console.log('[FRONT] Cleanup: destruyendo peer');
      clearTimeout(connectionTimeout);
      if (newPeer) newPeer.destroy();
    };
  }, [meetingId, user?.id, voiceSocket, mediaStreamRef]);

  /**
   * Iniciar una llamada a un peer específico
   */
  const initiateCall = async (peerId: string) => {
    let retries = 0;

    while ((!peer || !mediaStreamRef.current) && retries < 10) {
      await new Promise(res => setTimeout(res, 300));
      retries++;
    }

    if (!peer || !mediaStreamRef.current) {
      console.warn('[FRONT] No ready for call after retries:', peerId);
      return;
    }

    const audioTracks = mediaStreamRef.current.getAudioTracks();
    if (!audioTracks.length || !audioTracks[0].enabled) {
      console.warn('[FRONT] No active audio tracks for calling peer:', peerId);
      return;
    }

    console.log('[FRONT] ✅ Iniciando llamada segura a:', peerId);

    const call = peer.call(peerId, mediaStreamRef.current);

    call.on('stream', (remoteStream) => {
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(() => { });
    });

    peerCallsRef.current.set(peerId, call);
  };

  return {
    peer,
    peerStatus,
    peerCallsRef,
    initiateCall
  };
}