import { useState, useEffect, useRef } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { useAuthStore } from '../stores/authStore';

type PeerCall = MediaConnection & { dataChannel?: RTCDataChannel };

const extractUserId = (peerId: string) => peerId.split('_')[0];

const ensureRemoteAudioElement = (peerId: string, stream: MediaStream) => {
  let audio = document.querySelector(`audio[data-peer="${peerId}"]`) as HTMLAudioElement | null;
  if (!audio) {
    audio = document.createElement('audio');
    audio.setAttribute('data-peer', peerId);
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    audio.volume = 1;
    audio.muted = false;
    document.body.appendChild(audio);
  }
  audio.srcObject = stream;
  audio.play().catch((error) => console.warn('[FRONT] Autoplay audio:', error));
};

const attachMuteChannel = (channel: RTCDataChannel, peerId: string) => {
  channel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === 'mute') {
        const audioElement = document.querySelector(`audio[data-peer="${peerId}"]`) as HTMLAudioElement | null;
        if (audioElement) {
          audioElement.muted = data.muted;
        }
      }
    } catch (error) {
      console.warn('[FRONT] Error procesando mensaje de mute:', error);
    }
  };
};

export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  audioStreamRef: React.RefObject<MediaStream | null>,
  videoStreamRef: React.RefObject<MediaStream | null>,
  cameraOn: boolean,
  micOn: boolean,
  remoteVideoRefs: React.RefObject<Map<string, MediaStream>>,
  onRemoteStreamsChanged?: () => void,
  videoReadyVersion?: number
) {
  const { user } = useAuthStore();
  const [peerVoice, setPeerVoice] = useState<Peer | null>(null);
  const [peerVideo, setPeerVideo] = useState<Peer | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, PeerCall>>(new Map());

  const PEERJS_HOST_VOICE = import.meta.env.VITE_PEERJS_HOST_VOICE || 'realtimevoicebackend.onrender.com';
  const PEERJS_HOST_VIDEO = import.meta.env.VITE_PEERJS_HOST_VIDEO || 'realtimevideocambackend.onrender.com';

  useEffect(() => {
    if (!meetingId || !user || !voiceSocket) return;

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
      voiceSocket.emit('join-voice-room', { meetingId, peerId: newPeerVoice.id, userId: user.id });
    });

    newPeerVoice.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de voz de:', call.peer);
      const existingCall = peerCallsRef.current.get(call.peer);
      if (existingCall && existingCall !== call) {
        try {
          existingCall.close();
        } catch (error) {
          console.warn('[FRONT] Error cerrando llamada de voz previa:', error);
        }
        peerCallsRef.current.delete(call.peer);
      }

      const outboundStream = audioStreamRef.current;
      if (!outboundStream) {
        console.log('[FRONT] Postergando llamada de voz, stream local no disponible');
        return;
      }

      call.answer(outboundStream);

      call.on('stream', (remoteStream: MediaStream) => {
        ensureRemoteAudioElement(call.peer, remoteStream);
      });

      if (call.peerConnection) {
        call.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
          attachMuteChannel(event.channel, call.peer);
        };
        try {
          const dataChannel = call.peerConnection.createDataChannel('mute-channel');
          dataChannel.onopen = () => {
            dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
          };
          attachMuteChannel(dataChannel, call.peer);
          (call as PeerCall).dataChannel = dataChannel;
        } catch (error) {
          console.warn('[FRONT] Error creando DataChannel de mute (entrante):', error);
        }
      }

      call.on('close', () => {
        const audioElement = document.querySelector(`audio[data-peer="${call.peer}"]`);
        if (audioElement) {
          audioElement.remove();
        }
      });

      call.on('error', (error) => {
        console.error('[FRONT] Error en llamada de voz:', error);
      });

      peerCallsRef.current.set(call.peer, call as PeerCall);
    });

    newPeerVoice.on('error', (error) => {
      console.error('[FRONT] Error Peer voz:', error);
      setPeerStatus('error');
    });

    setPeerVoice(newPeerVoice);

    return () => {
      newPeerVoice.destroy();
    };
  }, [meetingId, user?.id, voiceSocket, micOn, audioStreamRef]);

  useEffect(() => {
    if (!meetingId || !user || !videoSocket) return;

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
      videoSocket.emit('join-video-room', { meetingId, peerId: newPeerVideo.id, userId: user.id });
    });

    newPeerVideo.on('call', (call) => {
      console.log('[FRONT] Contestando llamada de video de:', call.peer);
      const existingCall = peerCallsRef.current.get(call.peer);
      if (existingCall && existingCall !== call) {
        try {
          existingCall.close();
        } catch (error) {
          console.warn('[FRONT] Error cerrando llamada de video previa:', error);
        }
        peerCallsRef.current.delete(call.peer);
      }

      const outboundStream = cameraOn && videoStreamRef.current ? videoStreamRef.current : undefined;
      if (outboundStream) {
        call.answer(outboundStream);
      } else {
        call.answer();
      }

      call.on('stream', (remoteStream: MediaStream) => {
        const participantId = extractUserId(call.peer);
        remoteVideoRefs.current.set(participantId, remoteStream);
        onRemoteStreamsChanged?.();
      });

      call.on('close', () => {
        const participantId = extractUserId(call.peer);
        if (remoteVideoRefs.current.delete(participantId)) {
          onRemoteStreamsChanged?.();
        }
      });

      call.on('error', (error) => {
        console.error('[FRONT] Error en llamada de video:', error);
      });

      peerCallsRef.current.set(call.peer, call as PeerCall);
    });

    newPeerVideo.on('error', (error) => {
      console.error('[FRONT] Error Peer video:', error);
      setPeerStatus('error');
    });

    setPeerVideo(newPeerVideo);

    return () => {
      newPeerVideo.destroy();
    };
  }, [meetingId, user?.id, videoSocket, cameraOn, videoStreamRef, onRemoteStreamsChanged, remoteVideoRefs]);

  const initiateCall = async (peerId: string) => {
    if (peerId.endsWith('_voice') && peerVoice) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const outboundStream = audioStreamRef.current;
      if (!outboundStream) {
        console.warn('[FRONT] No se pudo iniciar llamada de voz, stream local no disponible');
        return;
      }
      const call = peerVoice.call(peerId, outboundStream);
      peerCallsRef.current.set(peerId, call as PeerCall);

      call.on('stream', (remoteStream) => {
        ensureRemoteAudioElement(peerId, remoteStream);
      });

      call.on('close', () => {
        const audioElement = document.querySelector(`audio[data-peer="${peerId}"]`);
        if (audioElement) {
          audioElement.remove();
        }
      });

      call.on('error', (error) => {
        console.error('[FRONT] Error en llamada de voz saliente:', error);
      });

      if (call.peerConnection) {
        call.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
          attachMuteChannel(event.channel, peerId);
        };
        try {
          const dataChannel = call.peerConnection.createDataChannel('mute-channel');
          dataChannel.onopen = () => {
            dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
          };
          attachMuteChannel(dataChannel, peerId);
          (call as PeerCall).dataChannel = dataChannel;
        } catch (error) {
          console.warn('[FRONT] Error creando DataChannel de mute (saliente):', error);
        }
      }
    } else if (peerId.endsWith('_video') && peerVideo) {
      console.log('[FRONT] Iniciando llamada de video a:', peerId);
      const outboundStream = cameraOn && videoStreamRef.current ? videoStreamRef.current : undefined;
      const call = outboundStream ? peerVideo.call(peerId, outboundStream) : peerVideo.call(peerId);
      peerCallsRef.current.set(peerId, call as PeerCall);

      call.on('stream', (remoteStream: MediaStream) => {
        const participantId = extractUserId(peerId);
        remoteVideoRefs.current.set(participantId, remoteStream);
        onRemoteStreamsChanged?.();
      });

      call.on('close', () => {
        const participantId = extractUserId(peerId);
        if (remoteVideoRefs.current.delete(participantId)) {
          onRemoteStreamsChanged?.();
        }
      });

      call.on('error', (error) => {
        console.error('[FRONT] Error en llamada de video saliente:', error);
      });
    } else {
      console.log('[FRONT] No se pudo iniciar la llamada, instancia Peer no lista');
    }
  };

  const sendMuteToPeers = (muted: boolean) => {
    peerCallsRef.current.forEach((call) => {
      if (call.dataChannel && call.dataChannel.readyState === 'open') {
        call.dataChannel.send(JSON.stringify({ type: 'mute', muted }));
      }
    });
  };

  useEffect(() => {
    const stream = cameraOn && videoStreamRef.current ? videoStreamRef.current : null;
    const track = stream?.getVideoTracks()[0] ?? null;

    peerCallsRef.current.forEach((call, peerId) => {
      if (!peerId.endsWith('_video')) {
        return;
      }
      const connection = call.peerConnection as RTCPeerConnection | undefined;
      if (!connection || typeof connection.getSenders !== 'function') {
        return;
      }
      const senders = connection.getSenders().filter((sender) => sender.track?.kind === 'video');
      if (track) {
        if (senders.length > 0) {
          senders.forEach((sender) => {
            sender.replaceTrack(track).catch((error) => {
              console.warn('[FRONT] Error reemplazando track de video:', error);
            });
          });
        } else if (stream) {
          try {
            connection.addTrack(track, stream);
          } catch (error) {
            console.warn('[FRONT] Error agregando track de video:', error);
          }
        }
      } else {
        senders.forEach((sender) => {
          sender.replaceTrack(null).catch((error) => {
            console.warn('[FRONT] Error deteniendo track de video:', error);
          });
        });
      }
    });
  }, [cameraOn, videoReadyVersion, videoStreamRef]);

  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers
  };
}