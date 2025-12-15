import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Custom hook for managing Socket.IO connections to chat, voice, and video backends.
 *
 * Features:
 * - Initializes three separate sockets (chat, voice, video) with authentication.
 * - Handles reconnection attempts and delays.
 * - Fetches ICE server configurations for voice and video backends.
 * - Determines if the current user is the meeting creator.
 * - Cleans up sockets on unmount or dependency change.
 *
 * @function useSockets
 * @param {string | undefined} meetingId - The unique identifier of the meeting.
 * @returns {{
 *   socket: Socket | null,
 *   voiceSocket: Socket | null,
 *   videoSocket: Socket | null,
 *   isCreator: boolean,
 *   CHAT_BACKEND_URL: string,
 *   VOICE_BACKEND_URL: string,
 *   VIDEO_BACKEND_URL: string
 * }} Object containing socket instances, creator flag, and backend URLs.
 *
 * @example
 * const {
 *   socket,
 *   voiceSocket,
 *   videoSocket,
 *   isCreator,
 *   CHAT_BACKEND_URL,
 *   VOICE_BACKEND_URL,
 *   VIDEO_BACKEND_URL,
 * } = useSockets("meeting123");
 *
 * // Example usage: listen for chat messages
 * useEffect(() => {
 *   if (socket) {
 *     socket.on("message", (msg) => console.log("Chat message:", msg));
 *   }
 * }, [socket]);
 */
export function useSockets(meetingId: string | undefined) {
  const { token, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);
  const [videoSocket, setVideoSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  const isLocalhost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }, []);

  const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

  const CHAT_BACKEND_URL = useMemo(() => {
    const fallback = 'https://realtimechatbackend-87nm.onrender.com';
    const raw = import.meta.env.VITE_CHAT_BACKEND_URL || fallback;
    return stripTrailingSlash(raw);
  }, []);

  const VOICE_BACKEND_URL = useMemo(() => {
    const fallback = 'https://realtimevoicebackend.onrender.com';
    const raw = import.meta.env.VITE_VOICE_BACKEND_URL || fallback;
    return stripTrailingSlash(raw);
  }, []);

  const VIDEO_BACKEND_URL = useMemo(() => {
    const fallback = isLocalhost ? 'http://localhost:10001' : 'https://realtimevideocambackend.onrender.com';
    const raw = import.meta.env.VITE_VIDEO_BACKEND_URL || fallback;
    return stripTrailingSlash(raw);
  }, [isLocalhost]);

  useEffect(() => {
    if (!meetingId || !token || !user) return;

    console.log('[FRONT] Inicializando sockets para reunión:', meetingId);

    const newSocket = io(CHAT_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    const newVoiceSocket = io(VOICE_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVoiceSocket(newVoiceSocket);

    const newVideoSocket = io(VIDEO_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVideoSocket(newVideoSocket);

    fetch(`${VOICE_BACKEND_URL}/api/ice-servers`)
      .then((res) => res.json())
      .then((data) => console.log('[FRONT] ICE servers voz:', data.iceServers))
      .catch((err) => console.error('[FRONT] Error ICE voz:', err));

    fetch(`${VIDEO_BACKEND_URL}/api/ice-servers`)
      .then((res) => res.json())
      .then((data) => console.log('[FRONT] ICE servers video:', data.iceServers))
      .catch((err) => console.error('[FRONT] Error ICE video:', err));

    fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.meeting && data.meeting.creatorId === user.id) {
          setIsCreator(true);
        }
      })
      .catch((err) => console.error('[FRONT] Error obteniendo reunión:', err));

    return () => {
      console.log('[FRONT] Cleanup: desconectando sockets');
      newSocket.disconnect();
      newVoiceSocket.disconnect();
      newVideoSocket.disconnect();
    };
  }, [meetingId, token, user?.id]);

  return {
    socket,
    voiceSocket,
    videoSocket,
    isCreator,
    CHAT_BACKEND_URL,
    VOICE_BACKEND_URL,
    VIDEO_BACKEND_URL,
  };
}
