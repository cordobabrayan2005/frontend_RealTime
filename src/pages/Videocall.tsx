import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import Peer from 'peerjs';

export default function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const meetingId = (location.state as any)?.meetingId;
  const { token, user } = useAuthStore();

  // Estados
  const [participants, setParticipants] = useState([{ id: user?.id || 'local', name: 'Tú', isLocal: true }]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true); // MICRÓFONO ACTIVADO POR DEFECTO
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messages, setMessages] = useState([{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);
  const [showCode, setShowCode] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<any>(null);
  const voiceSocketRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Map<string, any>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // URLs
  const CHAT_BACKEND_URL = 'https://realtimechatbackend-87nm.onrender.com';
  const VOICE_BACKEND_URL = 'https://realtimevoicebackend.onrender.com';

  // ==================== INICIAR LLAMADA ====================
  const startCall = useRef((peerId: string) => {
    if (!peerRef.current || !mediaStreamRef.current || peerId === user?.id) {
      console.log('[FRONT] No se puede iniciar llamada:', peerId);
      return;
    }

    console.log('[FRONT] Iniciando llamada a:', peerId);

    try {
      const call = peerRef.current.call(peerId, mediaStreamRef.current);

      call.on('stream', (remoteStream: MediaStream) => {
        console.log('[FRONT] Stream de audio recibido de:', peerId);

        // Crear o reutilizar elemento de audio
        let audio = audioElementsRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audioElementsRef.current.set(peerId, audio);
        }

        audio.srcObject = remoteStream;
        audio.volume = 1.0;

        audio.play().catch(err => {
          console.warn('[FRONT] Error reproduciendo audio, intentando muted:', err);
          audio.muted = true;
          audio.play().catch(e => console.error('[FRONT] Falló reproducción:', e));
        });
      });

      call.on('close', () => {
        console.log('[FRONT] Llamada cerrada con:', peerId);
        callsRef.current.delete(peerId);

        const audio = audioElementsRef.current.get(peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          audioElementsRef.current.delete(peerId);
        }
      });

      call.on('error', (err) => {
        console.error('[FRONT] Error en llamada:', peerId, err);
        callsRef.current.delete(peerId);
      });

      callsRef.current.set(peerId, call);

    } catch (error) {
      console.error('[FRONT] Error iniciando llamada:', error);
    }
  });

  // ==================== INICIALIZACIÓN ====================
  useEffect(() => {
    if (!meetingId || !token || !user) {
      console.error('[FRONT] Faltan datos para la videollamada');
      navigate('/realtime');
      return;
    }

    console.log('[FRONT] Inicializando videollamada para reunión:', meetingId);

    // 1. Socket de chat
    const socket = io(CHAT_BACKEND_URL, {
      auth: { token },
      reconnection: true
    });
    socketRef.current = socket;

    // 2. Socket de voz - CONFIGURACIÓN SIMPLE
    const voiceSocket = io(VOICE_BACKEND_URL, {
      auth: { token }
    });
    voiceSocketRef.current = voiceSocket;

    // 3. Peer.js - CONFIGURACIÓN SIMPLIFICADA
    const peer = new Peer({
      host: 'realtimevoicebackend.onrender.com',
      port: 443,
      path: '/peerjs',
      secure: true,
      debug: 0, // Menos logs
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });
    peerRef.current = peer;

    console.log('[FRONT] Peer.js inicializado con ID:', user.id);

    // Eventos de chat
    socket.on('connect', () => {
      console.log('[FRONT] Chat conectado');
      socket.emit('join-meeting', {
        meetingId,
        userId: user.id,
        name: user.name
      });
    });

    socket.on('receive-message', (data: { author: string; text: string }) => {
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        author: data.author,
        text: data.text
      }]);
      if (!showChat) setHasNewMessages(true);
    });

    socket.on('participants-list', (participantsList: { userId: string; name: string }[]) => {
      setParticipants(participantsList.map(p => ({
        id: p.userId,
        name: p.userId === user.id ? 'Tú' : p.name,
        isLocal: p.userId === user.id
      })));
    });

    socket.on('meeting-ended', (message: string) => {
      setMeetingEnded(true);
      alert(message);
      setTimeout(() => navigate('/realtime'), 3000);
    });

    socket.on('user-joined', (data: { userId: string; name: string }) => {
      setParticipants(prev => {
        if (prev.some(p => p.id === data.userId) || prev.length >= 10) return prev;
        return [...prev, { id: data.userId, name: data.name, isLocal: false }];
      });
    });

    socket.on('user-left', (data: { userId: string }) => {
      setParticipants(prev => prev.filter(p => p.id !== data.userId));
    });

    // Verificar si es creador
    fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.meeting && data.meeting.creatorId === user.id) {
          setIsCreator(true);
        }
      })
      .catch(console.error);

    // Eventos de voz
    voiceSocket.on('connect', () => {
      console.log('[FRONT] Socket de voz conectado');
      // Unirse después de que Peer.js esté listo
    });

    // Esperar a que Peer.js esté listo antes de unirse a la sala de voz
    peer.on('open', (id) => {
      console.log('[FRONT] Peer.js conectado con ID:', id);

      // Unirse a la sala de voz
      voiceSocket.emit('join-voice-room', {
        meetingId,
        peerId: user.id,
        userId: user.id
      });
    });

    voiceSocket.on('voice-joined', (data: { peers: string[] }) => {
      console.log('[FRONT] Unido a sala de voz, peers existentes:', data.peers);

      // Conectar a todos los peers existentes
      setTimeout(() => {
        data.peers.forEach(peerId => {
          if (micOn && mediaStreamRef.current) {
            startCall.current(peerId);
          }
        });
      }, 1000);
    });

    voiceSocket.on('peer-joined', (peerId: string) => {
      console.log('[FRONT] Nuevo peer en la sala:', peerId);

      // Conectar al nuevo peer
      setTimeout(() => {
        if (micOn && mediaStreamRef.current) {
          startCall.current(peerId);
        }
      }, 1000);
    });

    voiceSocket.on('peer-disconnected', (peerId: string) => {
      console.log('[FRONT] Peer desconectado:', peerId);

      // Limpiar llamada
      const call = callsRef.current.get(peerId);
      if (call) {
        call.close();
        callsRef.current.delete(peerId);
      }

      // Limpiar audio
      const audio = audioElementsRef.current.get(peerId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audioElementsRef.current.delete(peerId);
      }
    });

    // Manejar llamadas entrantes
    peer.on('call', (call) => {
      console.log('[FRONT] Llamada entrante de:', call.peer);

      if (micOn && mediaStreamRef.current) {
        call.answer(mediaStreamRef.current);
        callsRef.current.set(call.peer, call);

        call.on('stream', (remoteStream: MediaStream) => {
          console.log('[FRONT] Stream recibido de llamada entrante:', call.peer);

          let audio = audioElementsRef.current.get(call.peer);
          if (!audio) {
            audio = new Audio();
            audioElementsRef.current.set(call.peer, audio);
          }

          audio.srcObject = remoteStream;
          audio.volume = 1.0;

          audio.play().catch(err => {
            console.warn('[FRONT] Error reproduciendo audio entrante:', err);
            audio.muted = true;
            audio.play().catch(e => console.error('[FRONT] Falló reproducción:', e));
          });
        });

        call.on('close', () => {
          console.log('[FRONT] Llamada entrante cerrada:', call.peer);
          callsRef.current.delete(call.peer);
        });
      } else {
        console.log('[FRONT] Micrófono apagado, rechazando llamada de:', call.peer);
        call.close();
      }
    });

    peer.on('error', (err) => {
      console.error('[FRONT] Error de Peer.js:', err);
    });

    return () => {
      console.log('[FRONT] Cleanup completo');

      // Limpiar todo
      socket.disconnect();
      voiceSocket.disconnect();
      peer.destroy();

      callsRef.current.forEach(call => call.close());
      callsRef.current.clear();

      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
      audioElementsRef.current.clear();

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [meetingId, token, user, navigate, micOn, showChat]);

  // ==================== GESTIÓN DE MEDIA ====================
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      try {
        // Siempre obtener audio (micrófono activado por defecto)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraOn,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        mediaStreamRef.current = stream;

        // Configurar video local si la cámara está activada
        if (cameraOn && localVideoRef.current && stream.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(console.error);
        }

        console.log('[FRONT] Media stream obtenido:', {
          audio: stream.getAudioTracks().length > 0,
          video: stream.getVideoTracks().length > 0
        });

      } catch (err: any) { // CORREGIDO: Especificar tipo 'any'
        console.error('[FRONT] Error al obtener medios:', err);

        if (err.name === 'NotAllowedError') {
          alert('Permiso denegado. Permite acceso al micrófono para usar la llamada de voz.');
        }

        setCameraOn(false);
        setMicOn(false);
      }
    }

    initMedia();

    // Cuando cambia la cámara
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = cameraOn;

        if (!cameraOn && localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        } else if (cameraOn && localVideoRef.current && mediaStreamRef.current) {
          localVideoRef.current.srcObject = mediaStreamRef.current;
          localVideoRef.current.play().catch(console.error);
        }
      }
    }

    return () => {
      mounted = false;
    };
  }, [cameraOn]);

  // ==================== FUNCIONES DE UI ====================
  const toggleChat = () => {
    setShowChat(!showChat);
    if (!showChat) setHasNewMessages(false);
  };

  const toggleCode = () => setShowCode(!showCode);

  const copyCode = () => {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId)
        .then(() => alert('Código copiado al portapapeles'))
        .catch((err: Error) => console.error('Error copiando código:', err)); // CORREGIDO: Especificar tipo
    }
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socketRef.current || meetingEnded) return;

    socketRef.current.emit('send-message', {
      meetingId,
      message: text,
      author: user?.name || 'Tú'
    });

    setMessages(prev => [...prev, {
      id: prev.length + 1,
      author: 'Tú',
      text
    }]);
    setChatInput('');
  };

  const hangup = async () => {
    // Finalizar reunión si es creador
    if (isCreator && meetingId && token) {
      try {
        await fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        socketRef.current?.emit('end-meeting', meetingId);
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }

    // Salir de la sala de voz
    if (user) {
      voiceSocketRef.current?.emit('leave-voice-room', {
        meetingId,
        peerId: user.id
      });
    }

    navigate('/realtime');
  };

  if (meetingEnded) {
    return (
      <main className="videocall-page" role="main" aria-label="Videollamada">
        <div className="vc-ended-message">
          <h2>La reunión ha terminado</h2>
          <p>Serás redirigido en unos segundos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="videocall-page" role="main" aria-label="Videollamada">
      <div className="vc-top-left-back" onClick={() => navigate('/realtime')} aria-hidden>
        ←
      </div>

      <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
        {participants.map((p) => (
          <div key={p.id} className="vc-tile" role="group" aria-label={p.name}>
            <div className="vc-card">
              {p.isLocal ? (
                cameraOn ? (
                  <video
                    ref={localVideoRef}
                    className="vc-local-video"
                    muted
                    playsInline
                    autoPlay
                  />
                ) : (
                  <div className="vc-avatar">
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )
              ) : (
                <div className="vc-avatar">
                  {p.name.split(' ').map(n => n[0]).join('')}
                  {/* Indicador de audio activo */}
                  <span className="vc-audio-indicator">🔊</span>
                </div>
              )}
            </div>
            <div className="vc-name">{p.name}</div>
          </div>
        ))}
      </section>

      <div className="vc-controls" role="region" aria-label="Controles de llamada">
        <button
          className={`vc-control ${cameraOn ? 'on' : 'vc-control-muted'}`}
          title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
          onClick={() => setCameraOn(!cameraOn)}
        >
          {cameraOn ? '📷' : '🚫'}
        </button>

        <button
          className={`vc-control ${micOn ? 'on' : 'vc-control-muted'}`}
          title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          onClick={() => setMicOn(!micOn)}
        >
          {micOn ? '🎙️' : '🔇'}
        </button>

        <button
          className={`vc-control vc-control-chat ${showChat ? 'active' : ''}`}
          title="Chat"
          onClick={toggleChat}
        >
          💬
          {hasNewMessages && !showChat && <span className="vc-chat-notification">●</span>}
        </button>

        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          onClick={toggleCode}
        >
          🔗
        </button>

        <button className="vc-control vc-control-hangup" title="Colgar" onClick={hangup}>
          📞
        </button>
      </div>

      {/* Modal de código */}
      {showCode && (
        <div className="vc-modal-overlay" onClick={toggleCode}>
          <div className="vc-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button className="vc-modal-close" onClick={toggleCode} aria-label="Cerrar">×</button>
            </header>
            <div className="vc-modal-body">
              <p>Comparte este código para que otros se unan:</p>
              <div className="vc-code-display">
                <input type="text" value={meetingId || ''} readOnly onClick={(e) => e.currentTarget.select()} />
                <button onClick={copyCode}>Copiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel de chat */}
      {showChat && <div className="vc-chat-overlay" onClick={toggleChat} />}

      <aside className={`vc-chat-panel ${showChat ? 'open' : ''}`} aria-hidden={!showChat}>
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={toggleChat} aria-label="Cerrar chat">×</button>
        </header>

        <div className="vc-chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`vc-chat-message ${m.author === 'Tú' ? 'me' : ''}`}>
              <div className="vc-chat-author">{m.author}</div>
              <div className="vc-chat-text">{m.text}</div>
            </div>
          ))}
        </div>

        <form className="vc-chat-input" onSubmit={sendMessage}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje..."
          />
          <button type="submit" disabled={!chatInput.trim()}>Enviar</button>
        </form>
      </aside>
    </main>
  );
}