import { Socket } from 'socket.io-client';

/**
 * Sets up WebRTC event handlers for managing peer-to-peer audio connections.
 *
 * Features:
 * - Handles incoming WebRTC offers, creates peer connections, and responds with answers.
 * - Adds local audio tracks to the peer connection.
 * - Emits ICE candidates to the signaling server via `voiceSocket`.
 * - Plays remote audio streams automatically, with a fallback for autoplay restrictions.
 * - Handles incoming WebRTC answers and ICE candidates.
 * - Returns a cleanup function to remove event listeners when no longer needed.
 *
 * @function setupWebRTCHandlers
 * @param {Socket | null} voiceSocket - The Socket.IO connection used for signaling WebRTC events.
 * @param {React.MutableRefObject<Map<string, any>>} peerCallsRef - Reference to a map storing peer connections keyed by sender socket IDs.
 * @param {React.RefObject<MediaStream | null>} audioStreamRef - Reference to the local audio MediaStream.
 * @returns {() => void} Cleanup function that removes the registered event listeners.
 *
 * @example
 * const cleanup = setupWebRTCHandlers(voiceSocket, peerCallsRef, audioStreamRef);
 *
 * // Later, when cleaning up:
 * cleanup();
 */
export function setupWebRTCHandlers(
  voiceSocket: Socket | null,
  peerCallsRef: React.MutableRefObject<Map<string, any>>,
  audioStreamRef: React.RefObject<MediaStream | null>,
) {
  if (!voiceSocket) return () => {};

  const handleWebRTCOffer = (data: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[FRONT] Received offer from:', data.senderSocketId);
    if (audioStreamRef.current) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      audioStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, audioStreamRef.current!));

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          voiceSocket.emit('ice-candidate', { targetSocketId: data.senderSocketId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event: RTCTrackEvent) => {
        console.log('[FRONT] Stream received from:', data.senderSocketId);
        const audio = document.createElement('audio');
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.muted = false;

        audio.play().catch((err) => {
          console.warn('[FRONT] Autoplay bloqueado, esperando interacción...');
          const resume = () => {
            audio.play().catch((error) => console.error('Aún fallando:', error));
            document.removeEventListener('click', resume);
          };
          document.addEventListener('click', resume, { once: true });
        });
      };

      pc.setRemoteDescription(data.offer).then(() => {
        pc.createAnswer().then((answer) => {
          pc.setLocalDescription(answer);
          voiceSocket.emit('webrtc-answer', { targetSocketId: data.senderSocketId, answer });
        });
      });

      peerCallsRef.current?.set(data.senderSocketId, pc);
    }
  };

  const handleWebRTCAnswer = (data: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
    console.log('[FRONT] Received answer from:', data.senderSocketId);
    const pc = peerCallsRef.current?.get(data.senderSocketId);
    if (pc) {
      pc.setRemoteDescription(data.answer);
    }
  };

  const handleICECandidate = (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
    console.log('[FRONT] Received ICE candidate from:', data.senderSocketId);
    const pc = peerCallsRef.current?.get(data.senderSocketId);
    if (pc) {
      pc.addIceCandidate(data.candidate);
    }
  };

  voiceSocket.on('webrtc-offer', handleWebRTCOffer);
  voiceSocket.on('webrtc-answer', handleWebRTCAnswer);
  voiceSocket.on('ice-candidate', handleICECandidate);

  return () => {
    voiceSocket.off('webrtc-offer', handleWebRTCOffer);
    voiceSocket.off('webrtc-answer', handleWebRTCAnswer);
    voiceSocket.off('ice-candidate', handleICECandidate);
  };
}
