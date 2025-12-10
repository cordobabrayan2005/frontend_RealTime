import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook para manejar sockets de chat y voz
 */
export function useSockets(meetingId: string | undefined) {
  const { token, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  const CHAT_BACKEND_URL = import.meta.env.VITE_CHAT_BACKEND_URL || 'https://realtimechatbackend-87nm.onrender.com';
  const VOICE_BACKEND_URL = import.meta.env.VITE_VOICE_BACKEND_URL || 'https://realtimevoicebackend.onrender.com';

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

    // Obtener ICE servers del backend
    // fetch(`${VOICE_BACKEND_URL}/ice-servers`)
    //   .then(res => res.json())
    //   .then(data => {
    //     console.log('[FRONT] ICE servers:', data.iceServers);
    //   })
    //   .catch(err => console.error('[FRONT] Error fetching ICE servers:', err));

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
    };
  }, [meetingId, token, user?.id]);

  return {
    socket,
    voiceSocket,
    isCreator,
    CHAT_BACKEND_URL,
    VOICE_BACKEND_URL
  };
}