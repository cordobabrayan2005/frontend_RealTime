import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useMedia } from '../services/media';
import { usePeer } from '../services/peer';
import { useSockets } from '../services/sockets';
import { setupWebRTCHandlers } from '../services/webrtc';
import { Participant, ChatMessage } from '../components/videocall/types';

interface VideocallControllerHandlers {
  toggleCamera: () => void;
  toggleMic: () => void;
  toggleChat: () => void;
  toggleCode: () => void;
  closeChat: () => void;
  copyCode: () => void;
  changeChatInput: (value: string) => void;
  sendMessage: (event?: React.FormEvent) => void;
  hangup: () => Promise<void>;
}

interface VideocallController {
  meetingId?: string;
  meetingEnded: boolean;
  modalVisible: boolean;
  modalMessage: string;
  participants: Participant[];
  showChat: boolean;
  showCode: boolean;
  chatInput: string;
  hasNewMessages: boolean;
  messages: ChatMessage[];
  localVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  remoteVideoRefs: React.MutableRefObject<Map<string, MediaStream>>;
  remoteStreamsVersion: number;
  cameraOn: boolean;
  micOn: boolean;
  handlers: VideocallControllerHandlers;
}

export function useVideocallController(): VideocallController {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const meetingId = (location.state as any)?.meetingId as string | undefined;

  const remoteVideoRefs = useRef(new Map<string, MediaStream>());
  const videoPeersRef = useRef(new Set<string>());
  const [remoteStreamsVersion, setRemoteStreamsVersion] = useState(0);
  const bumpRemoteStreamsVersion = useCallback(() => {
    setRemoteStreamsVersion((prev) => prev + 1);
  }, []);

  const {
    audioStreamRef,
    videoStreamRef,
    localVideoRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn,
  } = useMedia();

  const {
    socket,
    voiceSocket,
    videoSocket,
    isCreator,
    CHAT_BACKEND_URL,
  } = useSockets(meetingId);

  const {
    peerVoice,
    peerVideo,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers,
  } = usePeer(
    meetingId,
    voiceSocket,
    videoSocket,
    audioStreamRef,
    videoStreamRef,
    cameraOn,
    micOn,
    remoteVideoRefs,
    bumpRemoteStreamsVersion,
  );

  const [showCode, setShowCode] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(() => [{ id: user?.id || 'local', name: 'Tú', isLocal: true }]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    if (!socket || !voiceSocket || !videoSocket || !user || !meetingId) {
      return;
    }

    let hasJoined = false;

    const cleanupMedia = () => {
      peerCallsRef.current?.forEach((call) => {
        try {
          call.close();
        } catch {
          /* ignore */
        }
      });
      peerCallsRef.current?.clear();

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            /* ignore */
          }
        });
        audioStreamRef.current = null;
      }

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            /* ignore */
          }
        });
        videoStreamRef.current = null;
      }

      remoteVideoRefs.current.clear();
      videoPeersRef.current.clear();
      bumpRemoteStreamsVersion();

      try {
        peerVoice?.destroy();
        peerVideo?.destroy();
      } catch {
        /* ignore */
      }

      try {
        voiceSocket?.disconnect();
        videoSocket?.disconnect();
      } catch {
        /* ignore */
      }
    };

    const handleConnect = () => {
      if (!hasJoined) {
        socket.emit('join-meeting', { meetingId, userId: user.id, name: user.name });
        hasJoined = true;
      }
    };

    const handleReceiveMessage = (data: { author: string; text: string; timestamp: string }) => {
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
      if (!showChat) {
        setHasNewMessages(true);
      }
    };

    const handleParticipantsList = (participantsList: { userId: string; name: string }[]) => {
      setParticipants(participantsList.map((participant) => ({
        id: participant.userId,
        name: participant.userId === user.id ? 'Tú' : participant.name,
        isLocal: participant.userId === user.id,
      })));
    };

    const handleForceDisconnect = () => {
      cleanupMedia();

      voiceSocket.removeAllListeners();
      voiceSocket.close();
      videoSocket.removeAllListeners();
      videoSocket.close();

      setMeetingEnded(true);
      setModalMessage('Has sido desconectado por el anfitrión.');
      setModalVisible(true);
      setTimeout(() => navigate('/realtime'), 1500);
    };

    const handleMeetingEnded = (message: string) => {
      cleanupMedia();
      setMeetingEnded(true);
      setModalMessage(message);
      setModalVisible(true);
      setTimeout(() => navigate('/realtime'), 2000);
    };

    const handleUserJoined = (data: { userId: string; name: string }) => {
      setParticipants((prev) => {
        if (prev.some((participant) => participant.id === data.userId) || prev.length >= 10) {
          return prev;
        }
        return [...prev, { id: data.userId, name: data.name, isLocal: false }];
      });
    };

    const handleUserLeft = (data: { userId: string }) => {
      remoteVideoRefs.current.delete(data.userId);
      bumpRemoteStreamsVersion();
      setParticipants((prev) => prev.filter((participant) => participant.id !== data.userId));
    };

    const handleSocketError = (msg: string) => {
      setModalMessage(`Error: ${msg}`);
      setModalVisible(true);
    };

    const handleVoiceJoined = (data: { peers: string[] }) => {
      data.peers.forEach((peerId) => {
        if (micOn) {
          initiateCall(peerId);
        }
      });
    };

    const handlePeerJoined = (peerId: string) => {
      if (micOn) {
        initiateCall(peerId);
      }
    };

    const handlePeerDisconnected = (peerId: string) => {
      const peerCall = peerCallsRef.current.get(peerId);
      if (peerCall) {
        peerCall.close();
        peerCallsRef.current.delete(peerId);
      }
      if (peerId.endsWith('_video')) {
        const userId = peerId.split('_')[0];
        remoteVideoRefs.current.delete(userId);
        videoPeersRef.current.delete(peerId);
        bumpRemoteStreamsVersion();
      }
    };

    const handleVoiceError = (msg: string) => {
      setModalMessage(`Voice error: ${msg}`);
      setModalVisible(true);
    };

    const handleVideoJoined = (data: { peers: string[] }) => {
      data.peers.forEach((peerId) => {
        if (peerId.endsWith('_video')) {
          videoPeersRef.current.add(peerId);
        }
        if (cameraOn) {
          initiateCall(peerId);
        }
      });
    };

    const handlePeerJoinedVideo = (peerId: string) => {
      if (peerId.endsWith('_video')) {
        videoPeersRef.current.add(peerId);
      }
      if (cameraOn) {
        initiateCall(peerId);
      }
    };

    const handleVideoError = (msg: string) => {
      setModalMessage(`Video error: ${msg}`);
      setModalVisible(true);
    };

    socket.removeAllListeners('connect');
    socket.removeAllListeners('receive-message');
    socket.removeAllListeners('participants-list');
    socket.removeAllListeners('meeting-ended');
    socket.removeAllListeners('user-joined');
    socket.removeAllListeners('user-left');
    socket.removeAllListeners('error');

    voiceSocket.removeAllListeners('connect');
    voiceSocket.removeAllListeners('voice-joined');
    voiceSocket.removeAllListeners('peer-joined');
    voiceSocket.removeAllListeners('peer-disconnected');
    voiceSocket.removeAllListeners('voice-error');
    voiceSocket.removeAllListeners('force-disconnect');

    videoSocket.removeAllListeners('connect');
    videoSocket.removeAllListeners('video-joined');
    videoSocket.removeAllListeners('peer-joined');
    videoSocket.removeAllListeners('peer-disconnected');
    videoSocket.removeAllListeners('video-error');
    videoSocket.removeAllListeners('force-disconnect');

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('participants-list', handleParticipantsList);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('error', handleSocketError);

    voiceSocket.on('connect', () => undefined);
    voiceSocket.on('voice-joined', handleVoiceJoined);
    voiceSocket.on('peer-joined', handlePeerJoined);
    voiceSocket.on('peer-disconnected', handlePeerDisconnected);
    voiceSocket.on('voice-error', handleVoiceError);
    voiceSocket.on('force-disconnect', handleForceDisconnect);

    videoSocket.on('connect', () => undefined);
    videoSocket.on('video-joined', handleVideoJoined);
    videoSocket.on('peer-joined', handlePeerJoinedVideo);
    videoSocket.on('peer-disconnected', handlePeerDisconnected);
    videoSocket.on('video-error', handleVideoError);
    videoSocket.on('force-disconnect', handleForceDisconnect);

    const cleanupWebRTC = setupWebRTCHandlers(voiceSocket, peerCallsRef, audioStreamRef);

    return () => {
      cleanupWebRTC();
    };
  }, [
    socket,
    voiceSocket,
    videoSocket,
    user,
    meetingId,
    micOn,
    cameraOn,
    audioStreamRef,
    videoStreamRef,
    initiateCall,
    navigate,
    peerCallsRef,
    peerVoice,
    peerVideo,
    bumpRemoteStreamsVersion,
  ]);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      if (!prev && next) {
        videoPeersRef.current.forEach((peerId) => {
          initiateCall(peerId);
        });
      }
      return next;
    });
  }, [setCameraOn, initiateCall]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const nextMicOn = !prev;
      sendMuteToPeers(!nextMicOn);
      return nextMicOn;
    });
  }, [setMicOn, sendMuteToPeers]);

  const toggleChat = useCallback(() => {
    setShowChat((prev) => {
      const next = !prev;
      if (!prev) {
        setHasNewMessages(false);
      }
      return next;
    });
  }, []);

  const toggleCode = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  const closeChat = useCallback(() => {
    setShowChat(false);
    setHasNewMessages(false);
  }, []);

  const copyCode = useCallback(() => {
    if (!meetingId) {
      return;
    }

    navigator.clipboard.writeText(meetingId)
      .then(() => {
        setModalMessage('Código copiado al portapapeles');
        setModalVisible(true);
        setTimeout(() => setModalVisible(false), 1500);
      })
      .catch(() => {
        setModalMessage('Error copiando código');
        setModalVisible(true);
        setTimeout(() => setModalVisible(false), 1500);
      });
  }, [meetingId]);

  const changeChatInput = useCallback((value: string) => {
    setChatInput(value);
  }, []);

  const sendMessage = useCallback((event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    const text = chatInput.trim();
    if (!text || !socket || meetingEnded) {
      return;
    }

    const authorName = user?.name || 'Tú';
    socket.emit('send-message', { meetingId, message: text, author: authorName });
    setMessages((prev) => [...prev, { id: prev.length + 1, author: 'Tú', text }]);
    setChatInput('');
  }, [chatInput, socket, meetingEnded, user, meetingId]);

  const hangup = useCallback(async () => {
    if (isCreator && meetingId) {
      try {
        const { token } = useAuthStore.getState();
        await fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        socket?.emit('end-meeting', meetingId);
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }

    if (user && voiceSocket) {
      voiceSocket.emit('leave-voice-room', { meetingId, peerId: user.id });
    }

    if (user && videoSocket) {
      videoSocket.emit('leave-video-room', { meetingId, peerId: user.id });
    }

    setParticipants([]);
    setShowChat(false);
    navigate('/realtime');
  }, [
    isCreator,
    meetingId,
    CHAT_BACKEND_URL,
    socket,
    user,
    voiceSocket,
    videoSocket,
    navigate,
  ]);

  return {
    meetingId,
    meetingEnded,
    modalVisible,
    modalMessage,
    participants,
    showChat,
    showCode,
    chatInput,
    hasNewMessages,
    messages,
    localVideoRef,
    remoteVideoRefs,
    remoteStreamsVersion,
    cameraOn,
    micOn,
    handlers: {
      toggleCamera,
      toggleMic,
      toggleChat,
      toggleCode,
      closeChat,
      copyCode,
      changeChatInput,
      sendMessage,
      hangup,
    },
  };
}
