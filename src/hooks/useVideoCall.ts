import { useEffect, useRef, useState, useCallback } from "react";
import { videoSocketService } from "../services/videoSocketService";
import { videoPeerService } from "../services/videoPeerService";

/**
 * Represents a participant in the video call.
 *
 * @interface Participant
 * @property {string} socketId - Unique identifier for the participant's socket connection.
 * @property {string} odiserId - Unique identifier for the participant in the peer network.
 * @property {string} displayName - Display name of the participant.
 * @property {boolean} isAudioEnabled - Whether the participant's audio is enabled.
 * @property {boolean} isVideoEnabled - Whether the participant's video is enabled.
 * @property {MediaStream} [stream] - Optional media stream associated with the participant.
 */
interface Participant {
  socketId: string;
  odiserId: string;
  displayName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  stream?: MediaStream;
}

/**
 * Normalizes participant data to ensure audio/video flags are boolean.
 *
 * @function normalizeParticipant
 * @param {Participant} participant - Participant object to normalize.
 * @returns {Participant} Normalized participant object.
 */
const normalizeParticipant = (participant: Participant): Participant => ({
  ...participant,
  isAudioEnabled:
    typeof participant.isAudioEnabled === "boolean"
      ? participant.isAudioEnabled
      : true,
  isVideoEnabled:
    typeof participant.isVideoEnabled === "boolean"
      ? participant.isVideoEnabled
      : true,
});

/**
 * Custom hook for managing video calls using WebRTC and Socket.IO.
 *
 * Features:
 * - Initializes local audio/video streams.
 * - Connects to a video room via socket service.
 * - Manages participants list and their media states.
 * - Handles joining, leaving, and toggling audio/video.
 * - Cleans up resources on disconnect or unmount.
 *
 * @function useVideoCall
 * @param {string} roomId - Unique identifier of the video room.
 * @param {string} userId - Unique identifier of the current user.
 * @param {string} displayName - Display name of the current user.
 * @returns {{
 *   participants: Map<string, Participant>,
 *   localStream: MediaStream | null,
 *   localVideoRef: React.RefObject<HTMLVideoElement>,
 *   isAudioEnabled: boolean,
 *   isVideoEnabled: boolean,
 *   isConnected: boolean,
 *   error: string | null,
 *   joinRoom: () => Promise<void>,
 *   leaveRoom: () => void,
 *   toggleAudio: () => void,
 *   toggleVideo: () => void
 * }} Object containing participants, local stream, refs, states, and control functions.
 *
 * @example
 * const {
 *   participants,
 *   localStream,
 *   localVideoRef,
 *   isAudioEnabled,
 *   isVideoEnabled,
 *   isConnected,
 *   error,
 *   joinRoom,
 *   leaveRoom,
 *   toggleAudio,
 *   toggleVideo,
 * } = useVideoCall("room123", "user456", "Daniel");
 *
 * // Attach local video
 * <video ref={localVideoRef} autoPlay muted playsInline />
 *
 * // Join the room
 * useEffect(() => {
 *   joinRoom();
 *   return () => leaveRoom();
 * }, []);
 */
export function useVideoCall(
  roomId: string,
  userId: string,
  displayName: string
) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(
    new Map()
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCalls = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);
  const peerIdRef = useRef<string | null>(null);
  const peerToSocketRef = useRef<Map<string, string>>(new Map());

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsAudioEnabled(false);

      setLocalStream(stream);
      localStreamRef.current = stream;
      videoPeerService.setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error("[useVideoCall] Error accessing media devices:", err);
      setError("No se pudo acceder a la cámara o micrófono");
      throw err;
    }
  }, []);

  const callParticipant = useCallback(
    async (participant: Participant, stream: MediaStream) => {
      if (pendingCalls.current.has(participant.odiserId)) {
        return;
      }

      pendingCalls.current.add(participant.odiserId);

      try {
        const remoteStream = await videoPeerService.call(
          participant.odiserId,
          stream
        );

        setParticipants((prev) => {
          const next = new Map(prev);
          next.set(participant.socketId, {
            ...participant,
            stream: remoteStream,
          });
          return next;
        });
      } catch (err) {
        console.error("[useVideoCall] Error calling participant:", err);
      } finally {
        pendingCalls.current.delete(participant.odiserId);
      }
    },
    []
  );

  const leaveRoom = useCallback(() => {
    const peerId = peerIdRef.current;
    if (peerId) {
      videoSocketService.leaveVideoRoom(roomId, peerId);
    }

    videoPeerService.destroy();

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    videoSocketService.disconnect();
    setIsConnected(false);
    setParticipants(new Map());
    setLocalStream(null);
    localStreamRef.current = null;
    peerIdRef.current = null;
    peerToSocketRef.current.clear();
    isInitialized.current = false;
  }, [roomId]);

  const joinRoom = useCallback(async () => {
    if (isInitialized.current) {
      return;
    }

    try {
      if (!roomId || !userId || !displayName) {
        setError("Faltan datos requeridos");
        return;
      }

      isInitialized.current = true;

      const stream = await initializeMedia();

      const token = localStorage.getItem("authToken") || undefined;

      videoSocketService.connect(userId, token);

      const peerId = `${userId}_video`;
      peerIdRef.current = peerId;

      await videoPeerService.initialize(peerId);

      videoSocketService.onVideoJoined(({ peers }: { peers: string[] }) => {
        console.log("[useVideoCall] Existing peers in room:", peers);
      });

      videoSocketService.onPeerJoined((remotePeerId: string) => {
        console.log("[useVideoCall] Peer joined:", remotePeerId);
      });

      videoSocketService.onPeerDisconnected((remotePeerId: string) => {
        console.log("[useVideoCall] Peer disconnected:", remotePeerId);
        videoPeerService.closeCall(remotePeerId);

        const socketId = peerToSocketRef.current.get(remotePeerId);
        if (!socketId) {
          return;
        }

        peerToSocketRef.current.delete(remotePeerId);

        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
      });

      videoSocketService.onRoomParticipants(
        (data: { participants: Participant[] }) => {
          const next = new Map<string, Participant>();
          peerToSocketRef.current.clear();

          data.participants.forEach((participant) => {
            const normalized = normalizeParticipant(participant);
            next.set(normalized.socketId, normalized);
            peerToSocketRef.current.set(normalized.odiserId, normalized.socketId);
          });

          setParticipants(next);

          data.participants.forEach((participant) => {
            const normalized = normalizeParticipant(participant);
            callParticipant(normalized, stream);
          });
        }
      );

      videoSocketService.onParticipantJoined((data: Participant) => {
        const normalized = normalizeParticipant(data);
        peerToSocketRef.current.set(normalized.odiserId, normalized.socketId);

        setParticipants((prev) => {
          const next = new Map(prev);
          next.set(normalized.socketId, normalized);
          return next;
        });

        callParticipant(normalized, stream);
      });

      videoSocketService.onMediaStateChanged(
        (data: { socketId: string; isVideoEnabled: boolean }) => {
          setParticipants((prev) => {
            const next = new Map(prev);
            const participant = next.get(data.socketId);
            if (participant) {
              next.set(data.socketId, {
                ...participant,
                isVideoEnabled: data.isVideoEnabled,
              });
            }
            return next;
          });
        }
      );

      videoSocketService.onForceDisconnect(() => {
        console.warn("[useVideoCall] Force disconnect received");
        setError("La reunión finalizó");
        leaveRoom();
      });

      videoSocketService.onVideoError((message: string) => {
        console.error("[useVideoCall] Video error:", message);
        setError(message);
      });

      videoSocketService.onError((data: { message?: string }) => {
        const message = data?.message || "Error en la conexión de video";
        console.error("[useVideoCall] Socket error:", message);
        setError(message);
      });

      videoPeerService.onCall((remotePeerId, remoteStream) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          const socketId = peerToSocketRef.current.get(remotePeerId);
          if (socketId) {
            const participant = next.get(socketId);
            if (participant) {
              next.set(socketId, { ...participant, stream: remoteStream });
            }
          }
          return next;
        });
      });

      videoSocketService.joinVideoRoom(roomId, peerId, userId, displayName);

      setIsConnected(true);
    } catch (err) {
      console.error("[useVideoCall] Error joining room:", err);
      setError("Error al unirse a la sala");
      videoPeerService.destroy();
      videoSocketService.disconnect();
      isInitialized.current = false;
    }
  }, [
    roomId,
    userId,
    displayName,
    initializeMedia,
    callParticipant,
    leaveRoom,
  ]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        videoSocketService.updateMediaState(roomId, videoTrack.enabled);
      }
    }
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (isInitialized.current) {
        leaveRoom();
      }
    };
  }, [leaveRoom]);

  return {
    participants,
    localStream,
    localVideoRef,
    isAudioEnabled,
    isVideoEnabled,
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  };
}
