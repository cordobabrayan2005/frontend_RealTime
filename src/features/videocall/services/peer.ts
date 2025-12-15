import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { useAuthStore } from '../../../stores/authStore';

/**
 * PeerJS media connection extended with an optional control data channel.
 */
type PeerCall = MediaConnection & { dataChannel?: RTCDataChannel };

/**
 * Extracts the user identifier from a compound peer identifier.
 *
 * @param {string} peerId PeerJS identifier formatted as `{userId}_{channel}`.
 * @returns {string} User identifier.
 */
const extractUserId = (peerId: string) => peerId.split('_')[0];

/**
 * Updates the remote stream map for the given peer.
 *
 * @param {React.RefObject<Map<string, MediaStream>>} remoteVideoRefs Mutable map that stores remote streams.
 * @param {string} peerId PeerJS identifier for the connection.
 * @param {MediaStream | null} stream Latest remote stream or null when removed.
 * @param {(() => void)=} onRemoteStreamsChanged Optional callback fired when the map mutates.
 */
const updateRemoteVideoRef = (
  remoteVideoRefs: React.RefObject<Map<string, MediaStream>>,
  peerId: string,
  stream: MediaStream | null,
  onRemoteStreamsChanged?: () => void
) => {
  const participantId = extractUserId(peerId);
  if (!participantId) {
    return;
  }

  if (stream) {
    remoteVideoRefs.current.set(participantId, stream);
    onRemoteStreamsChanged?.();
    return;
  }

  if (remoteVideoRefs.current.delete(participantId)) {
    onRemoteStreamsChanged?.();
  }
};

/**
 * Wires up PeerJS callbacks so remote video streams keep the local registry in sync.
 *
 * @param {PeerCall} call Active PeerJS media connection.
 * @param {React.RefObject<Map<string, MediaStream>>} remoteVideoRefs Store for participant streams.
 * @param {(() => void)=} onRemoteStreamsChanged Optional notifier executed after updates.
 */
const attachRemoteVideoListeners = (
  call: PeerCall,
  remoteVideoRefs: React.RefObject<Map<string, MediaStream>>,
  onRemoteStreamsChanged?: () => void
) => {
  const updateStream = (stream: MediaStream | null) => {
    updateRemoteVideoRef(remoteVideoRefs, call.peer, stream, onRemoteStreamsChanged);
  };

  call.on('stream', (remoteStream: MediaStream) => {
    updateStream(remoteStream);
  });

  call.on('close', () => {
    updateStream(null);
  });

  const peerConnection = call.peerConnection as RTCPeerConnection | undefined;
  if (!peerConnection) {
    return;
  }

  const handleTrack = (event: RTCTrackEvent) => {
    if (event.track.kind !== 'video') {
      return;
    }

    const stream = event.streams?.[0];
    if (stream) {
      updateStream(stream);
    } else {
      const syntheticStream = new MediaStream([event.track]);
      updateStream(syntheticStream);
    }

    const handleTrackEnded = () => {
      updateStream(null);
      event.track.removeEventListener('ended', handleTrackEnded);
    };

    event.track.addEventListener('ended', handleTrackEnded);
  };

  peerConnection.addEventListener('track', handleTrack);

  call.on('close', () => {
    peerConnection.removeEventListener('track', handleTrack);
  });
};

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

/**
 * Initializes PeerJS clients for audio and video, handles incoming calls, and exposes helpers for the
 * meeting lifecycle. Audio and video remain isolated so toggling one does not affect the other.
 *
 * @param {string | undefined} meetingId Active meeting identifier.
 * @param {*} voiceSocket Socket instance for voice signaling.
 * @param {*} videoSocket Socket instance for video signaling.
 * @param {React.RefObject<MediaStream | null>} audioStreamRef Reference to the local audio stream.
 * @param {React.RefObject<MediaStream | null>} videoStreamRef Reference to the local video stream.
 * @param {boolean} cameraOn Whether the camera toggle is enabled.
 * @param {boolean} micOn Whether the microphone toggle is enabled.
 * @param {React.RefObject<Map<string, MediaStream>>} remoteVideoRefs Mutable list of remote streams.
 * @param {(() => void)=} onRemoteStreamsChanged Optional callback executed after the remote map updates.
 * @param {number=} videoReadyVersion Bump counter to resync tracks after new permissions.
 * @returns {object} PeerJS clients, status, and helper callbacks.
 */
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

  /**
   * Retrieves the current outbound camera stream when the local camera toggle is enabled.
   *
   * @returns {MediaStream | null} Active camera stream or null when disabled.
   */
  const getCurrentVideoStream = useCallback(() => {
    if (!cameraOn) {
      return null;
    }
    return videoStreamRef.current ?? null;
  }, [cameraOn, videoStreamRef]);

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

      const outboundStream = audioStreamRef.current ?? undefined;
      if (outboundStream) {
        call.answer(outboundStream);
      } else {
        call.answer();
      }

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

      const outboundStream = getCurrentVideoStream();
      call.answer(outboundStream ?? new MediaStream());

      attachRemoteVideoListeners(call as PeerCall, remoteVideoRefs, onRemoteStreamsChanged);

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
  }, [meetingId, user?.id, videoSocket, cameraOn, videoStreamRef, onRemoteStreamsChanged, remoteVideoRefs, getCurrentVideoStream]);

  /**
   * Starts a PeerJS call with the specified peer, selecting audio or video based on the identifier.
   *
   * @param {string} peerId Remote peer identifier ending in `_voice` or `_video`.
   */
  const initiateCall = useCallback(async (peerId: string) => {
    if (peerId.endsWith('_voice') && peerVoice) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const outboundStream = audioStreamRef.current ?? null;
      const call = peerVoice.call(peerId, outboundStream ?? new MediaStream());
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
      const outboundStream = getCurrentVideoStream();
      const call = peerVideo.call(peerId, outboundStream ?? new MediaStream());
      peerCallsRef.current.set(peerId, call as PeerCall);

      attachRemoteVideoListeners(call as PeerCall, remoteVideoRefs, onRemoteStreamsChanged);

      call.on('error', (error) => {
        console.error('[FRONT] Error en llamada de video saliente:', error);
      });
    } else {
      console.log('[FRONT] No se pudo iniciar la llamada, instancia Peer no lista');
    }
  }, [peerVoice, peerVideo, audioStreamRef, getCurrentVideoStream, micOn, remoteVideoRefs, onRemoteStreamsChanged]);

  /**
   * Convenience wrapper that initiates a voice-only call.
   *
   * @param {string} peerId Peer identifier ending in `_voice`.
   */
  const initiateVoiceCall = useCallback((peerId: string) => {
    if (!peerId.endsWith('_voice')) {
      console.warn('[FRONT] Peer de voz inválido:', peerId);
      return;
    }
    void initiateCall(peerId);
  }, [initiateCall]);

  /**
   * Convenience wrapper that initiates a video-only call.
   *
   * @param {string} peerId Peer identifier ending in `_video`.
   */
  const initiateVideoCall = useCallback((peerId: string) => {
    if (!peerId.endsWith('_video')) {
      console.warn('[FRONT] Peer de video inválido:', peerId);
      return;
    }
    void initiateCall(peerId);
  }, [initiateCall]);

  /**
   * Propagates local camera changes to every active video call, invoking PeerJS helpers when available.
   *
   * @param {MediaStream | null} stream Latest local video stream, null when disabled.
   */
  const syncVideoTrack = useCallback((stream: MediaStream | null) => {
    const activeTrack = stream?.getVideoTracks()[0] ?? null;
    const emptyStream = new MediaStream();

    peerCallsRef.current.forEach((call, peerId) => {
      if (!peerId.endsWith('_video')) {
        return;
      }

      const candidateStream = activeTrack ? stream! : emptyStream;
      const replace = (call as MediaConnection & { replaceStream?: (value: MediaStream) => void }).replaceStream;

      if (typeof replace === 'function') {
        try {
          replace(candidateStream);
        } catch (error) {
          console.warn('[FRONT] Error reemplazando stream de video (PeerJS):', error);
        }
        return;
      }

      const connection = call.peerConnection as RTCPeerConnection | undefined;
      if (!connection || typeof connection.getSenders !== 'function') {
        return;
      }

      const videoSenders = connection.getSenders().filter((sender) => sender.track?.kind === 'video');

      if (videoSenders.length === 0) {
        if (activeTrack && typeof connection.addTrack === 'function') {
          try {
            connection.addTrack(activeTrack, stream!);
          } catch (error) {
            console.warn('[FRONT] Error agregando track de video como respaldo:', error);
          }
        }
        return;
      }

      videoSenders.forEach((sender) => {
        sender
          .replaceTrack(activeTrack)
          .catch((error) => {
            console.warn('[FRONT] Error actualizando track de video:', error);
          });
      });
    });
  }, []);

  /**
   * Broadcasts microphone mute changes to every connected peer via the control data channel.
   *
   * @param {boolean} muted Whether the local microphone is muted.
   */
  const sendMuteToPeers = (muted: boolean) => {
    peerCallsRef.current.forEach((call) => {
      if (call.dataChannel && call.dataChannel.readyState === 'open') {
        call.dataChannel.send(JSON.stringify({ type: 'mute', muted }));
      }
    });
  };

  useEffect(() => {
    const stream = getCurrentVideoStream();
    syncVideoTrack(stream);
  }, [cameraOn, videoReadyVersion, getCurrentVideoStream, syncVideoTrack]);

  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    initiateVoiceCall,
    initiateVideoCall,
    sendMuteToPeers,
    syncVideoTrack
  };
}