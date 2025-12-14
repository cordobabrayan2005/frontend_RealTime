import { useEffect, useMemo, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook para manejar sockets de chat, voz y video
 */
export function useSockets(meetingId: string | undefined) {
  const { token, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);
  const [videoSocket, setVideoSocket] = useState<Socket | null>(null);  // Nuevo para video
  const [isCreator, setIsCreator] = useState(false);

  const CHAT_BACKEND_URL = import.meta.env.VITE_CHAT_BACKEND_URL || 'https://realtimechatbackend-87nm.onrender.com';
  const VOICE_BACKEND_URL = import.meta.env.VITE_VOICE_BACKEND_URL || 'https://realtimevoicebackend.onrender.com';
  const VIDEO_BACKEND_URL = import.meta.env.VITE_VIDEO_BACKEND_URL || 'https://realtimevideocambackend.onrender.com';  // Nuevo

  useEffect(() => {
    if (!meetingId || !token || !user) return;

    console.log('[FRONT] Inicializando sockets para reunión:', meetingId);

    // 1. Socket de chat
    const newSocket = io(CHAT_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    // 2. Socket de voz
    const newVoiceSocket = io(VOICE_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVoiceSocket(newVoiceSocket);

    // 3. Socket de video
    const newVideoSocket = io(VIDEO_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVideoSocket(newVideoSocket);

    // Obtener ICE servers de ambos backends
    fetch(`${VOICE_BACKEND_URL}/api/ice-servers`)
      .then(res => res.json())
      .then(data => console.log('[FRONT] ICE servers voz:', data.iceServers))
      .catch(err => console.error('[FRONT] Error ICE voz:', err));

    fetch(`${VIDEO_BACKEND_URL}/api/ice-servers`)
      .then(res => res.json())
      .then(data => console.log('[FRONT] ICE servers video:', data.iceServers))
      .catch(err => console.error('[FRONT] Error ICE video:', err));

    // Verificar si es el creador
    fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.meeting && data.meeting.creatorId === user.id) {
          setIsCreator(true);
        }
      })
      .catch(err => console.error('[FRONT] Error obteniendo reunión:', err));

    return () => {
      console.log('[FRONT] Cleanup: desconectando sockets');
      newSocket.disconnect();
      newVoiceSocket.disconnect();
      newVideoSocket.disconnect();  // Nuevo
    };
  }, [meetingId, token, user?.id]);

  return {
    socket,
    voiceSocket,
    videoSocket,  // Nuevo
    isCreator,
    CHAT_BACKEND_URL,
    VOICE_BACKEND_URL,
    VIDEO_BACKEND_URL  // Nuevo
  };
}