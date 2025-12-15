import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useAuthStore } from '../stores/authStore';

/**
 * Custom hook for managing PeerJS connections for voice and video calls.
 *
 * Features:
 * - Initializes persistent PeerJS connections for voice and video.
 * - Handles incoming calls (voice and video) and answers with local streams.
 * - Plays remote audio/video streams automatically, with autoplay fallback handling.
 * - Manages peer-to-peer DataChannels for mute/unmute signaling.
 * - Provides functions to initiate calls and broadcast mute state to peers.
 * - Cleans up PeerJS instances on unmount.
 *
 * @function usePeer
 * @param {string | undefined} meetingId - Unique identifier of the meeting.
 * @param {any} voiceSocket - Socket.IO connection for voice signaling.
 * @param {any} videoSocket - Socket.IO connection for video signaling.
 * @param {React.RefObject<MediaStream | null>} audioStreamRef - Ref to the local audio MediaStream.
 * @param {React.RefObject<MediaStream | null>} videoStreamRef - Ref to the local video MediaStream.
 * @param {boolean} cameraOn - Whether the local camera is enabled.
 * @param {boolean} micOn - Whether the local microphone is enabled.
 * @param {React.RefObject<Map<string, MediaStream>>} remoteVideoRefs - Ref to a map storing remote video streams keyed by user ID.
 * @returns {{
 *   peerVoice: Peer | null,
 *   peerVideo: Peer | null,
 *   peerStatus: 'connecting' | 'connected' | 'error',
 *   peerCallsRef: React.MutableRefObject<Map<string, any>>,
 *   initiateCall: (peerId: string) => Promise<void>,
 *   sendMuteToPeers: (muted: boolean) => void
 * }} Object containing PeerJS instances, status, references, and control functions.
 *
 * @example
 * const {
 *   peerVoice,
 *   peerVideo,
 *   peerStatus,
 *   peerCallsRef,
 *   initiateCall,
 *   sendMuteToPeers,
 * } = usePeer(meetingId, voiceSocket, videoSocket, audioStreamRef, videoStreamRef, cameraOn, micOn, remoteVideoRefs);
 *
 * // Initiate a voice call
 * initiateCall("user123_voice");
 *
 * // Broadcast mute state
 * sendMuteToPeers(true);
 */
export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  audioStreamRef: React.RefObject<MediaStream | null>,  // Fixed: Use audioStreamRef
  videoStreamRef: React.RefObject<MediaStream | null>,  // Fixed: Use videoStreamRef
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

  // ==================== Voice PeerJS setup ====================
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
        // DataChannel for mute signaling
        const dataChannel = call.peerConnection.createDataChannel('mute-channel');
        dataChannel.onopen = () => {
          console.log('[FRONT] DataChannel abierto para mute con:', call.peer);
          // Send initial mute state
          dataChannel.send(JSON.stringify({ type: 'mute', muted: !micOn }));
        };
        dataChannel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'mute') {
            // Mute/unmute remote audio locally
            const audioElement = document.querySelector(`audio[data-peer="${call.peer}"]`) as HTMLAudioElement;
            if (audioElement) {
              audioElement.muted = data.muted;
            }
          }
        };
        // Save DataChannel in the call
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

  // ==================== VIDEO PEER (PERSISTENT) ====================
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
      if (videoStreamRef.current && cameraOn) {
        call.answer(videoStreamRef.current);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Stream de video recibido de:', call.peer);
          const userId = call.peer.split('_')[0];
          remoteVideoRefs.current.set(userId, remoteStream);
          const video = document.createElement('video');
          video.srcObject = remoteStream;
          video.autoplay = true;
          video.setAttribute('playsinline', 'true');
          video.muted = false;
          video.play().catch(err => console.error('Autoplay video:', err));
        });
      } else {
        console.log('[FRONT] Rechazando llamada de video - cámara apagada');
        call.close();
      }
      call.on('close', () => {
        console.log('[FRONT] Llamada de video cerrada');
        const userId = call.peer.split('_')[0];
        remoteVideoRefs.current.delete(userId);
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
  }, [meetingId, user?.id, videoSocket]);  

  // ==================== START CALLS ====================
  const initiateCall = async (peerId: string) => {
    if (peerId.endsWith('_voice') && micOn && peerVoice && audioStreamRef.current) {
      console.log('[FRONT] Iniciando llamada de voz a:', peerId);
      const callVoice = peerVoice.call(peerId, audioStreamRef.current);
      peerCallsRef.current.set(peerId, callVoice);

      // Manage DataChannel in initiated call
      callVoice.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream de voz recibido de:', peerId);
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.setAttribute('data-peer', peerId);  // Para identificar
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.play().catch(err => console.error('Autoplay audio:', err));
      });

      // Listen to DataChannel
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
      // Video unchanged
      console.log('[FRONT] Iniciando llamada de video a:', peerId);
      const callVideo = peerVideo.call(peerId, videoStreamRef.current);
      peerCallsRef.current.set(peerId, callVideo);
    } else {
      console.log('[FRONT] No se puede iniciar llamada - stream no disponible');
    }
  };

  // Add function to send mute to all peers
  const sendMuteToPeers = (muted: boolean) => {
    peerCallsRef.current.forEach((call) => {
      if (call.dataChannel && call.dataChannel.readyState === 'open') {
        call.dataChannel.send(JSON.stringify({ type: 'mute', muted }));
      }
    });
  };

  // Export sendMuteToPeers
  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers
  };
}