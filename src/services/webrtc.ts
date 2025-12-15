import { Socket } from 'socket.io-client';

/**
 * Sets up WebRTC signaling event handlers using a Socket.IO connection.
 */
export function setupWebRTCHandlers(
  voiceSocket: Socket | null,
  peerCallsRef: React.MutableRefObject<Map<string, any>>,
  audioStreamRef: React.RefObject<MediaStream | null>
) {
  if (!voiceSocket) return () => {};

  const handleWebRTCOffer = (data: {
    senderSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    console.log('[FRONT] Received offer from:', data.senderSocketId);

    if (audioStreamRef.current) {
      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              'turn:relay1.expressturn.com:3480?transport=udp',
              'turn:relay1.expressturn.com:3480?transport=tcp',
              'turns:relay1.expressturn.com:443'
            ],
            username: '000000002081173935',
            credential: 'gWuSuOJzycRF1q2lE3W/AjLFpfU='
          }
        ]
      });

      audioStreamRef.current
        .getTracks()
        .forEach(track => pc.addTrack(track, audioStreamRef.current!));

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          voiceSocket.emit('ice-candidate', {
            targetSocketId: data.senderSocketId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event: RTCTrackEvent) => {
        console.log('[FRONT] Stream received from:', data.senderSocketId);

        const audio = document.createElement('audio');
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.muted = false;

        audio.play().catch(() => {
          console.warn('[FRONT] Autoplay bloqueado, esperando interacción...');
          const resume = () => {
            audio.play().catch(e => console.error('Aún fallando:', e));
            document.removeEventListener('click', resume);
          };
          document.addEventListener('click', resume, { once: true });
        });
      };

      pc.setRemoteDescription(data.offer).then(() => {
        pc.createAnswer().then(answer => {
          pc.setLocalDescription(answer);
          voiceSocket.emit('webrtc-answer', {
            targetSocketId: data.senderSocketId,
            answer
          });
        });
      });

      peerCallsRef.current?.set(data.senderSocketId, pc);
    }
  };

  const handleWebRTCAnswer = (data: {
    senderSocketId: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    console.log('[FRONT] Received answer from:', data.senderSocketId);
    const pc = peerCallsRef.current?.get(data.senderSocketId);
    if (pc) {
      pc.setRemoteDescription(data.answer);
    }
  };

  const handleICECandidate = (data: {
    senderSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => {
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