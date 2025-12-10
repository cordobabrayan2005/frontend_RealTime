import { Socket } from 'socket.io-client';

/**
 * Manejo de señalización WebRTC vía Socket.io
 */
export function setupWebRTCHandlers(
  voiceSocket: Socket | null,
  peerCallsRef: React.MutableRefObject<Map<string, any>>,
  mediaStreamRef: React.RefObject<MediaStream | null>
) {
  if (!voiceSocket) return () => {};

  const handleWebRTCOffer = (data: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[FRONT] Received offer from:', data.senderSocketId);
    if (mediaStreamRef.current) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      mediaStreamRef.current.getTracks().forEach(track => pc.addTrack(track, mediaStreamRef.current!));
      
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          voiceSocket.emit('ice-candidate', { targetSocketId: data.senderSocketId, candidate: event.candidate });
        }
      };
      
      pc.ontrack = (event: RTCTrackEvent) => {
        console.log('[FRONT] Stream received from:', data.senderSocketId);
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(err => {
          console.error('[FRONT] Error playing audio:', err);
          audio.muted = true;
          audio.play();
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