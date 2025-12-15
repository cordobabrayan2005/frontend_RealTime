import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { useMedia } from '../services/media';
import { usePeer } from '../services/peer';
import { useSockets } from '../services/sockets';
import { setupWebRTCHandlers } from '../services/webrtc';
import { Participant, ChatMessage } from '../types';

/**
 * Handler callbacks exposed by the videocall controller hook.
 */
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

/**
 * Shape of the stateful data returned by the videocall controller hook.
 */
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

/**
 * Centralized meeting controller that wires together sockets, media streams, participants, and UI state.
 *
 * @returns {VideocallController} Aggregated state, refs, and action handlers for the videocall experience.
 */
export function useVideocallController(): VideocallController {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const meetingId = (location.state as any)?.meetingId as string | undefined;

  const remoteVideoRefs = useRef(new Map<string, MediaStream>());
  const videoPeersRef = useRef(new Set<string>());
  const peerIdToParticipantRef = useRef(new Map<string, string>());
  const participantToVideoPeerRef = useRef(new Map<string, string>());
  const socketIdToParticipantRef = useRef(new Map<string, string>());
  const participantToSocketIdRef = useRef(new Map<string, string>());
  const cameraStateReadyRef = useRef(false);
  const [remoteStreamsVersion, setRemoteStreamsVersion] = useState(0);
  const bumpRemoteStreamsVersion = useCallback(() => {
    setRemoteStreamsVersion((prev) => prev + 1);
  }, []);

  const localParticipant = useMemo<Participant>(() => ({
    id: user?.id || 'local',
    name: 'Tú',
    isLocal: true,
  }), [user?.id]);

  const {
    audioStreamRef,
    videoStreamRef,
    localVideoRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn,
    videoReadyVersion,
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
    initiateVoiceCall,
    initiateVideoCall,
    sendMuteToPeers,
    syncVideoTrack,
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
    videoReadyVersion,
  );

  const [showCode, setShowCode] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(() => [localParticipant]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const participantNamesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const nextMap = new Map<string, string>();
    participants.forEach((participant) => {
      nextMap.set(participant.id, participant.name);
    });
    participantNamesRef.current = nextMap;
  }, [participants]);

  useEffect(() => {
    setParticipants((prev) => {
      const remote = prev.filter((participant) => !participant.isLocal);
      return [localParticipant, ...remote];
    });
  }, [localParticipant]);

  useEffect(() => {
    if (!socket || !voiceSocket || !videoSocket || !user || !meetingId) {
      return;
    }

    let hasJoined = false;

    /**
     * Normalizes a peer ID by removing suffixes like '_voice' or '_video'.
     * @param {string} value - The peer ID to normalize.
     * @returns {string} The normalized peer ID.
     */
    const normalizePeerId = (value: string) => value.replace(/_(voice|video)$/i, '');

    /**
     * Generates a display name for a remote participant.
     * @param {string} baseId - The base participant ID.
     * @param {string} [preferred] - Preferred display name.
     * @returns {string} The display name.
     */
    const makeRemoteName = (baseId: string, preferred?: string) => {
      if (preferred && preferred !== 'User') return preferred;
      const existing = participantNamesRef.current.get(baseId);
      if (existing && existing !== 'Tú') return existing;
      const suffix = baseId.slice(-4).toUpperCase();
      return `Participante ${suffix || baseId}`;
    };

    /**
     * Creates a remote participant object.
     * @param {string} peerId - The peer ID.
     * @param {string} [displayName] - Display name.
     * @param {string} [remoteUserId] - Remote user ID.
     * @returns {Participant | null} The participant object or null if invalid.
     */
    const createRemoteParticipant = (peerId: string, displayName?: string, remoteUserId?: string): Participant | null => {
      if (!peerId) return null;
      const participantId = (remoteUserId && remoteUserId.trim()) || normalizePeerId(peerId);
      if (!participantId || participantId === user.id) return null;
      return { id: participantId, name: makeRemoteName(participantId, displayName), isLocal: false };
    };

    /**
     * Sets the list of remote participants, ensuring uniqueness.
     * @param {Participant[]} entries - Array of participant entries.
     */
    const setRemoteParticipants = (entries: Participant[]) => {
      const unique = new Map<string, Participant>();
      entries.forEach((participant) => unique.set(participant.id, participant));
      setParticipants([localParticipant, ...Array.from(unique.values())]);
    };

    /**
     * Registers a video peer and maps IDs.
     * @param {string} [peerId] - The peer ID.
     * @param {string} [socketId] - The socket ID.
     * @param {string} [remoteUserId] - Remote user ID.
     */
    const registerVideoPeer = (peerId?: string, socketId?: string, remoteUserId?: string) => {
      if (!peerId || !peerId.endsWith('_video')) {
        return;
      }
      const participantId = (remoteUserId && remoteUserId.trim()) || normalizePeerId(peerId);
      if (!participantId || participantId === user.id) {
        return;
      }
      videoPeersRef.current.add(peerId);
      peerIdToParticipantRef.current.set(peerId, participantId);
      participantToVideoPeerRef.current.set(participantId, peerId);
      if (socketId) {
        socketIdToParticipantRef.current.set(socketId, participantId);
        participantToSocketIdRef.current.set(participantId, socketId);
      }
    };

    /**
     * Adds a remote participant to the list if not already present and under limit.
     * @param {Participant | null} participant - The participant to add.
     */
    const addRemoteParticipant = (participant: Participant | null) => {
      if (!participant) return;
      setParticipants((prev) => {
        if (prev.some((item) => item.id === participant.id) || prev.length >= 10) {
          return prev;
        }
        return [...prev, participant];
      });
    };

    /**
     * Removes a remote participant from the list.
     * @param {string} participantId - The participant ID to remove.
     */
    const removeRemoteParticipant = (participantId: string) => {
      if (!participantId || participantId === user.id) return;
      setParticipants((prev) => prev.filter((participant) => participant.isLocal || participant.id !== participantId));
    };

    /**
     * Cleans up media streams, peers, and refs.
     */
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
      peerIdToParticipantRef.current.clear();
      participantToVideoPeerRef.current.clear();
      socketIdToParticipantRef.current.clear();
      participantToSocketIdRef.current.clear();
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

      setParticipants([localParticipant]);
    };

    /**
     * Handles socket connection and joins the meeting if not already joined.
     */
    const handleConnect = () => {
      if (!hasJoined) {
        socket.emit('join-meeting', { meetingId, userId: user.id, name: user.name });
        hasJoined = true;
      }
    };

    /**
     * Handles receiving a chat message.
     * @param {object} data - Message data.
     * @param {string} data.author - Author of the message.
     * @param {string} data.text - Message text.
     * @param {string} data.timestamp - Timestamp.
     */
    const handleReceiveMessage = (data: { author: string; text: string; timestamp: string }) => {
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
      if (!showChat) {
        setHasNewMessages(true);
      }
    };

    /**
     * Handles the participants list update.
     * @param {Array<{ userId: string; name: string }>} participantsList - List of participants.
     */
    const handleParticipantsList = (participantsList: { userId: string; name: string }[]) => {
      if (!participantsList) return;
      const remote = participantsList
        .map(({ userId, name }) => {
          if (userId === user.id) return null;
          return { id: userId, name: name || makeRemoteName(userId), isLocal: false } as Participant;
        })
        .filter(Boolean) as Participant[];
      setRemoteParticipants(remote);
    };

     /**
     * Handles force disconnect by the host.
     */
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

    /**
     * Handles meeting end.
     * @param {string} message - End message.
     */
    const handleMeetingEnded = (message: string) => {
      cleanupMedia();
      setMeetingEnded(true);
      setModalMessage(message);
      setModalVisible(true);
      setTimeout(() => navigate('/realtime'), 2000);
    };

    /**
     * Handles a user joining the meeting.
     * @param {object} data - User data.
     * @param {string} data.userId - User ID.
     * @param {string} data.name - User name.
     */
    const handleUserJoined = (data: { userId: string; name: string }) => {
      if (!data?.userId || data.userId === user.id) return;
      addRemoteParticipant({ id: data.userId, name: data.name || makeRemoteName(data.userId), isLocal: false });
    };

    /**
     * Handles a user leaving the meeting.
     * @param {object} data - User data.
     * @param {string} data.userId - User ID.
     */
    const handleUserLeft = (data: { userId: string }) => {
      const userId = data?.userId;
      if (!userId) return;
      remoteVideoRefs.current.delete(userId);
      const socketId = participantToSocketIdRef.current.get(userId);
      if (socketId) {
        socketIdToParticipantRef.current.delete(socketId);
        participantToSocketIdRef.current.delete(userId);
      }
      Array.from(videoPeersRef.current).forEach((peerId) => {
        if (peerId.startsWith(`${userId}_`)) {
          videoPeersRef.current.delete(peerId);
          peerIdToParticipantRef.current.delete(peerId);
        }
      });
      participantToVideoPeerRef.current.delete(userId);
      bumpRemoteStreamsVersion();
      removeRemoteParticipant(userId);
    };

    /**
     * Handles socket errors.
     * @param {string} msg - Error message.
     */
    const handleSocketError = (msg: string) => {
      setModalMessage(`Error: ${msg}`);
      setModalVisible(true);
    };

    /**
     * Handles voice room join and initiates calls to peers.
     * @param {object} data - Voice join data.
     * @param {string[]} data.peers - List of peer IDs.
     */
    const handleVoiceJoined = (data: { peers: string[] }) => {
      data.peers.forEach((peerId) => {
        initiateVoiceCall(peerId);
      });
    };

    /**
     * Handles a peer joining the voice room.
     * @param {string} peerId - Peer ID.
     */
    const handlePeerJoined = (peerId: string) => {
      initiateVoiceCall(peerId);
    };

    /**
     * Handles a peer disconnecting from voice or video.
     * @param {string} peerId - Peer ID.
     */
    const handlePeerDisconnected = (peerId: string) => {
      const peerCall = peerCallsRef.current.get(peerId);
      if (peerCall) {
        peerCall.close();
        peerCallsRef.current.delete(peerId);
      }
      const participantId = peerIdToParticipantRef.current.get(peerId) || normalizePeerId(peerId);
      const isVideoPeer = peerId.endsWith('_video');
      if (isVideoPeer) {
        if (participantId) {
          if (remoteVideoRefs.current.delete(participantId)) {
            bumpRemoteStreamsVersion();
          }
          const registeredPeer = participantToVideoPeerRef.current.get(participantId);
          if (registeredPeer === peerId) {
            participantToVideoPeerRef.current.delete(participantId);
          }
        }
        videoPeersRef.current.delete(peerId);
        peerIdToParticipantRef.current.delete(peerId);
        return;
      }

      if (!participantId) {
        return;
      }

      remoteVideoRefs.current.delete(participantId);
      videoPeersRef.current.forEach((storedPeerId) => {
        if (storedPeerId.startsWith(`${participantId}_`)) {
          videoPeersRef.current.delete(storedPeerId);
          peerIdToParticipantRef.current.delete(storedPeerId);
          participantToVideoPeerRef.current.delete(participantId);
        }
      });

      const socketId = participantToSocketIdRef.current.get(participantId);
      if (socketId) {
        socketIdToParticipantRef.current.delete(socketId);
        participantToSocketIdRef.current.delete(participantId);
      }

      removeRemoteParticipant(participantId);
    };

    /**
     * Handles voice errors.
     * @param {string} msg - Error message.
     */
    const handleVoiceError = (msg: string) => {
      setModalMessage(`Voice error: ${msg}`);
      setModalVisible(true);
    };

    /**
     * Handles video room join and initiates video calls.
     * @param {object} data - Video join data.
     * @param {string[]} data.peers - List of peer IDs.
     */
    const handleVideoJoined = (data: { peers: string[] }) => {
      data.peers.forEach((peerId) => {
        registerVideoPeer(peerId);
        addRemoteParticipant(createRemoteParticipant(peerId));
        initiateVideoCall(peerId);
      });
    };

    const handlePeerJoinedVideo = (peerId: string) => {
      registerVideoPeer(peerId);
      addRemoteParticipant(createRemoteParticipant(peerId));
      initiateVideoCall(peerId);
    };

    const handleRoomParticipants = (payload: { participants: Array<{ socketId?: string; odiserId: string; userId?: string; displayName?: string }> }) => {
      if (!payload?.participants) return;
      const remote = payload.participants
        .map(({ socketId, odiserId, userId: remoteUserId, displayName }) => {
          registerVideoPeer(odiserId, socketId, remoteUserId);
          initiateVideoCall(odiserId);
          return createRemoteParticipant(odiserId, displayName, remoteUserId);
        })
        .filter(Boolean) as Participant[];
      setRemoteParticipants(remote);
    };

    const handleVideoParticipantJoined = (payload: { socketId?: string; odiserId: string; userId?: string; displayName?: string }) => {
      registerVideoPeer(payload.odiserId, payload.socketId, payload.userId);
      addRemoteParticipant(createRemoteParticipant(payload.odiserId, payload.displayName, payload.userId));
      if (payload.odiserId && !payload.odiserId.startsWith(`${user.id}_`)) {
        initiateVideoCall(payload.odiserId);
      }
    };

    const handleMediaStateChanged = (payload: { socketId: string; isVideoEnabled: boolean }) => {
      const socketId = payload?.socketId;
      if (!socketId) return;
      const participantId = socketIdToParticipantRef.current.get(socketId);
      if (!participantId || participantId === user.id) {
        return;
      }
      if (!payload.isVideoEnabled) {
        const removed = remoteVideoRefs.current.delete(participantId);
        if (removed) {
          bumpRemoteStreamsVersion();
        }
        return;
      }
      if (!remoteVideoRefs.current.has(participantId)) {
        const peerId = participantToVideoPeerRef.current.get(participantId);
        if (peerId) {
          const existingCall = peerCallsRef.current.get(peerId);
          if (existingCall) {
            try {
              existingCall.close();
            } catch {
              /* ignore */
            }
            peerCallsRef.current.delete(peerId);
          }
          initiateVideoCall(peerId);
        }
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
    videoSocket.removeAllListeners('room-participants');
    videoSocket.removeAllListeners('participant-joined');
    videoSocket.removeAllListeners('media-state-changed');

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
    videoSocket.on('room-participants', handleRoomParticipants);
    videoSocket.on('participant-joined', handleVideoParticipantJoined);
    videoSocket.on('media-state-changed', handleMediaStateChanged);

    const cleanupWebRTC = setupWebRTCHandlers(voiceSocket, peerCallsRef, audioStreamRef);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('participants-list', handleParticipantsList);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('error', handleSocketError);

      voiceSocket.off('voice-joined', handleVoiceJoined);
      voiceSocket.off('peer-joined', handlePeerJoined);
      voiceSocket.off('peer-disconnected', handlePeerDisconnected);
      voiceSocket.off('voice-error', handleVoiceError);
      voiceSocket.off('force-disconnect', handleForceDisconnect);

      videoSocket.off('video-joined', handleVideoJoined);
      videoSocket.off('peer-joined', handlePeerJoinedVideo);
      videoSocket.off('peer-disconnected', handlePeerDisconnected);
      videoSocket.off('video-error', handleVideoError);
      videoSocket.off('force-disconnect', handleForceDisconnect);
      videoSocket.off('room-participants', handleRoomParticipants);
      videoSocket.off('participant-joined', handleVideoParticipantJoined);
      videoSocket.off('media-state-changed', handleMediaStateChanged);

      cleanupWebRTC();
    };
  }, [
    socket,
    voiceSocket,
    videoSocket,
    user,
    meetingId,
    audioStreamRef,
    videoStreamRef,
    initiateVoiceCall,
    initiateVideoCall,
    navigate,
    peerCallsRef,
    peerVoice,
    peerVideo,
    bumpRemoteStreamsVersion,
    localParticipant,
  ]);

  useEffect(() => {
    const stream = cameraOn ? videoStreamRef.current : null;
    syncVideoTrack(stream ?? null);
  }, [cameraOn, videoReadyVersion, syncVideoTrack, videoStreamRef]);

  useEffect(() => {
    if (!videoSocket || !meetingId) {
      return;
    }
    if (!cameraStateReadyRef.current) {
      cameraStateReadyRef.current = true;
      if (!cameraOn) {
        return;
      }
    }
    videoSocket.emit('media-state-change', {
      roomId: meetingId,
      isVideoEnabled: cameraOn,
    });
  }, [cameraOn, meetingId, videoSocket]);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => !prev);
  }, [setCameraOn]);

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
      const voicePeerId = peerVoice?.id || `${user.id}_voice`;
      voiceSocket.emit('leave-voice-room', { meetingId, peerId: voicePeerId });
    }

    if (user && videoSocket) {
      const videoPeerId = peerVideo?.id || `${user.id}_video`;
      videoSocket.emit('leave-video-room', { meetingId, peerId: videoPeerId });
    }

    remoteVideoRefs.current.clear();
    videoPeersRef.current.clear();
    peerIdToParticipantRef.current.clear();
    participantToVideoPeerRef.current.clear();
    socketIdToParticipantRef.current.clear();
    participantToSocketIdRef.current.clear();
    bumpRemoteStreamsVersion();
    setParticipants([localParticipant]);
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
    peerVoice,
    peerVideo,
    localParticipant,
    bumpRemoteStreamsVersion,
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
