import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import Peer from 'peerjs';

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate(); // MOVIDO AQUÍ ARRIBA - Esto arregla el error
  const meetingId = (location.state as any)?.meetingId;
  const { token, user } = useAuthStore();

  // Estados añadidos para mejor gestión
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);

  // Ref para elementos de audio (mejora de gestión)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Los otros estados permanecen igual...
  const [participants, setParticipants] = useState(() => [{ id: user?.id || 'local', name: 'Tú', isLocal: true }]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  // Refs (añadido uno para audioElements)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerCallsRef = useRef<Map<string, any>>(new Map());
  const peerRef = useRef<Peer | null>(null);

  // URLs de backend
  const CHAT_BACKEND_URL = 'https://realtimechatbackend-87nm.onrender.com';
  const VOICE_BACKEND_URL = 'https://realtimevoicebackend.onrender.com';

  // ==================== FUNCIÓN MEJORADA PARA INICIAR LLAMADAS ====================

  const initiateCall = useCallback((peerId: string) => {
    if (!peerRef.current || !mediaStreamRef.current || peerId === user?.id) return;

    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') {
      console.warn('[FRONT] No hay track de audio válido para llamar a:', peerId);
      return;
    }

    // Verificar si ya hay una llamada activa
    if (peerCallsRef.current.has(peerId)) {
      console.log('[FRONT] Ya hay llamada activa con:', peerId);
      return;
    }

    console.log('[FRONT] Iniciando llamada a:', peerId);

    try {
      const call = peerRef.current.call(peerId, mediaStreamRef.current);

      call.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream recibido de:', peerId);

        // Reutilizar o crear elemento de audio
        let audio = audioElementsRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audioElementsRef.current.set(peerId, audio);
        }

        audio.srcObject = remoteStream;
        audio.volume = 1.0;

        audio.play().catch(err => {
          console.warn('[FRONT] Error reproduciendo audio, intentando silenciado:', err);
          audio.muted = true;
          audio.play().then(() => {
            audio.muted = false;
          }).catch(e => console.error('[FRONT] Falló reproducción:', e));
        });
      });

      call.on('close', () => {
        console.log('[FRONT] Llamada cerrada con:', peerId);
        cleanupPeerConnection(peerId);
      });

      call.on('error', (err) => {
        console.error('[FRONT] Error en llamada con:', peerId, err);
        cleanupPeerConnection(peerId);
      });

      peerCallsRef.current.set(peerId, call);

    } catch (error) {
      console.error('[FRONT] Error iniciando llamada:', error);
    }
  }, [user?.id]);

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const call = peerCallsRef.current.get(peerId);
    if (call) {
      try { call.close(); } catch (e) { }
      peerCallsRef.current.delete(peerId);
    }

    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(peerId);
    }
  }, []);

  // ==================== CONEXIÓN MEJORADA ====================

  useEffect(() => {
    if (!meetingId || !token || !user) return;

    // Chat socket (manteniendo la configuración original)
    const newSocket = io(CHAT_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    // Voice socket con configuración mejorada
    const newVoiceSocket = io(VOICE_BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true
    });
    setVoiceSocket(newVoiceSocket);

    // Peer.js CONFIGURACIÓN CORREGIDA
    const newPeer = new Peer(user.id, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      },
      debug: 2, // Solo errores
      host: 'realtimevoicebackend.onrender.com',
      secure: true,
      path: '/peerjs',
      port: 443
    });

    newPeer.on('open', (id) => {
      console.log('[FRONT] Peer.js conectado con ID:', id);
      setConnectionStatus('connected');

      // Notificar al servidor
      if (newVoiceSocket && meetingId) {
        newVoiceSocket.emit('join-voice-room', {
          meetingId,
          peerId: id,
          userId: user.id
        });
      }
    });

    newPeer.on('error', (err) => {
      console.error('[FRONT] Peer.js error:', err);
      setConnectionStatus('disconnected');

      // Reconexión automática
      if (err.type === 'network' || err.type === 'disconnected') {
        setTimeout(() => {
          if (newPeer && !newPeer.disconnected) {
            newPeer.reconnect();
          }
        }, 2000);
      }
    });

    newPeer.on('disconnected', () => {
      console.log('[FRONT] Peer.js desconectado, reconectando...');
      setConnectionStatus('disconnected');
      newPeer.reconnect();
    });

    // Manejo de llamadas entrantes (MEJORADO)
    newPeer.on('call', (call) => {
      if (!call.peer) {
        console.warn('[FRONT] Llamada sin peer ID, ignorando');
        return;
      }

      console.log('[FRONT] Llamada entrante de:', call.peer);

      if (micOn && mediaStreamRef.current) {
        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'live') {
          console.log('[FRONT] Contestando llamada con audio');
          call.answer(mediaStreamRef.current);

          call.on('stream', (remoteStream) => {
            console.log('[FRONT] Stream remoto recibido de:', call.peer);

            // Reutilizar elemento de audio
            let audio = audioElementsRef.current.get(call.peer);
            if (!audio) {
              audio = new Audio();
              audioElementsRef.current.set(call.peer, audio);
            }

            audio.srcObject = remoteStream;
            audio.volume = 1.0;

            audio.play().catch(err => {
              console.warn('[FRONT] Error reproduciendo audio, intentando silenciado:', err);
              audio.muted = true;
              audio.play().then(() => {
                audio.muted = false;
              }).catch(e => console.error('[FRONT] Falló reproducción:', e));
            });
          });

          call.on('close', () => {
            console.log('[FRONT] Llamada cerrada con:', call.peer);
            cleanupPeerConnection(call.peer);
          });

          call.on('error', (err) => {
            console.error('[FRONT] Error en llamada:', call.peer, err);
            cleanupPeerConnection(call.peer);
          });

          peerCallsRef.current.set(call.peer, call);
        } else {
          console.warn('[FRONT] Sin stream de audio válido, rechazando llamada');
          call.close();
        }
      } else {
        console.warn('[FRONT] Micrófono apagado, rechazando llamada');
        call.close();
      }
    });

    setPeerInstance(newPeer);
    peerRef.current = newPeer;

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
      .catch(err => console.error('Error obteniendo reunión:', err));

    let hasJoined = false;

    // Eventos del chat (igual que antes)
    const handleConnect = () => {
      console.log('[FRONT] Socket conectado, uniéndose a reunión si no lo ha hecho');
      if (!hasJoined) {
        newSocket.emit('join-meeting', { meetingId, userId: user.id, name: user.name });
        hasJoined = true;
      }
    };
    newSocket.on('connect', handleConnect);

    newSocket.on('receive-message', (data: { author: string; text: string; timestamp: string }) => {
      console.log('[FRONT] Mensaje recibido:', data);
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
      if (!showChat) setHasNewMessages(true);
    });

    newSocket.on('participants-list', (participantsList: { userId: string; name: string }[]) => {
      console.log('[FRONT] Lista de participantes recibida:', participantsList);
      setParticipants(participantsList.map(p => ({
        id: p.userId,
        name: p.userId === user.id ? 'Tú' : p.name,
        isLocal: p.userId === user.id
      })));
    });

    newSocket.on('meeting-ended', (message: string) => {
      console.log('[FRONT] Reunión terminada:', message);
      setMeetingEnded(true);
      alert(message);
      setTimeout(() => navigate('/realtime'), 3000);
    });

    newSocket.on('user-joined', (data: { userId: string; name: string }) => {
      console.log('[FRONT] Usuario unido:', data);
      setParticipants((prev) => {
        if (prev.some(p => p.id === data.userId) || prev.length >= 10) return prev;
        return [...prev, { id: data.userId, name: data.name, isLocal: false }];
      });
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      console.log('[FRONT] Usuario salió:', data);
      setParticipants((prev) => prev.filter(p => p.id !== data.userId));
    });

    newSocket.on('error', (msg: string) => {
      console.error('[FRONT] Error de socket:', msg);
      alert(`Error: ${msg}`);
    });

    // Eventos de voz (MEJORADOS)
    newVoiceSocket.on('connect', () => {
      console.log('[FRONT] Voice socket connected');
      setConnectionStatus('connecting');
    });

    newVoiceSocket.on('voice-joined', (data: { peers: string[] }) => {
      console.log('[FRONT] Voice joined, peers:', data.peers);

      // Conectar a peers existentes después de un delay
      setTimeout(() => {
        data.peers.forEach(peerId => {
          if (peerId !== user.id && peerRef.current && micOn && mediaStreamRef.current) {
            initiateCall(peerId);
          }
        });
      }, 1000);
    });

    newVoiceSocket.on('peer-joined', (peerId: string) => {
      console.log('[FRONT] Nuevo peer:', peerId);

      // Esperar a que el peer esté listo
      setTimeout(() => {
        if (peerId !== user.id && peerRef.current && micOn && mediaStreamRef.current) {
          initiateCall(peerId);
        }
      }, 1000);
    });

    newVoiceSocket.on('peer-disconnected', (peerId: string) => {
      console.log('[FRONT] Peer desconectado:', peerId);
      cleanupPeerConnection(peerId);
    });

    newVoiceSocket.on('voice-error', (msg: string) => {
      console.error('[FRONT] Voice error:', msg);
    });

    newVoiceSocket.on('disconnect', (reason) => {
      console.log('[FRONT] Desconectado de voz:', reason);
      setConnectionStatus('disconnected');
    });

    // Cleanup mejorado
    return () => {
      console.log('[FRONT] Cleanup completo');

      newSocket.off('connect', handleConnect);
      newSocket.disconnect();
      newVoiceSocket.disconnect();

      if (newPeer) {
        newPeer.destroy();
      }

      // Limpiar todas las llamadas
      peerCallsRef.current.forEach(call => {
        try { call.close(); } catch (e) { }
      });
      peerCallsRef.current.clear();

      // Limpiar elementos de audio
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
      audioElementsRef.current.clear();

      // Limpiar media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [meetingId, token, user, micOn, initiateCall, cleanupPeerConnection, navigate, showChat]);

  // ==================== GESTIÓN DE MEDIA MEJORADA ====================

  useEffect(() => {
    let mounted = true;

    async function ensureMedia() {
      try {
        const desiredVideo = !!cameraOn;
        const desiredAudio = !!micOn;
        const current = mediaStreamRef.current;

        // Si no necesitamos nada, limpiar
        if (!desiredVideo && !desiredAudio) {
          if (current) {
            current.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
            mediaStreamRef.current = null;
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
          }
          return;
        }

        // Obtener constraints con mejor calidad de audio
        const constraints: MediaStreamConstraints = {
          video: desiredVideo,
          audio: desiredAudio ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : false
        };

        if (!current) {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          mediaStreamRef.current = stream;
          if (localVideoRef.current && stream.getVideoTracks().length) {
            try {
              localVideoRef.current.srcObject = stream;
              await localVideoRef.current.play();
            } catch (e) { /* ignore */ }
          }
          return;
        }

        const hasVideo = current.getVideoTracks().length > 0;
        const hasAudio = current.getAudioTracks().length > 0;

        if (hasVideo === desiredVideo && hasAudio === desiredAudio) {
          current.getVideoTracks().forEach(t => t.enabled = desiredVideo);
          current.getAudioTracks().forEach(t => t.enabled = desiredAudio);
          return;
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          newStream.getTracks().forEach(t => t.stop());
          return;
        }

        try {
          current.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
        } catch (e) { /* ignore */ }

        mediaStreamRef.current = newStream;
        if (localVideoRef.current) {
          try {
            localVideoRef.current.srcObject = newStream;
            if (newStream.getVideoTracks().length) await localVideoRef.current.play();
          } catch (e) { /* ignore */ }
        }
      } catch (err: any) {
        console.error('getUserMedia error', err);
        if (err.name === 'NotAllowedError') {
          alert('Permiso denegado. Concede permisos de micrófono/cámara.');
          setCameraOn(false);
          setMicOn(false);
        } else if (err.name === 'NotFoundError') {
          alert('Dispositivo no encontrado.');
          setCameraOn(false);
          setMicOn(false);
        }
      }
    }

    ensureMedia();

    // Cuando el micrófono se activa/desactiva
    if (micOn && mediaStreamRef.current && peerRef.current && voiceSocket && meetingId && user) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === 'live') {
        console.log('[FRONT] Mic activado, reconectando a sala de voz');

        // Limpiar llamadas existentes
        peerCallsRef.current.forEach(call => {
          try { call.close(); } catch (e) { }
        });
        peerCallsRef.current.clear();

        // Limpiar audio
        audioElementsRef.current.forEach(audio => {
          audio.pause();
          audio.srcObject = null;
        });
        audioElementsRef.current.clear();

        // Reconectar
        voiceSocket.emit('join-voice-room', {
          meetingId,
          peerId: user.id,
          userId: user.id
        });
      } else {
        console.warn('[FRONT] Mic activado pero sin track de audio válido');
      }
    } else if (!micOn) {
      console.log('[FRONT] Mic desactivado, cerrando llamadas');
      peerCallsRef.current.forEach(call => {
        try { call.close(); } catch (e) { }
      });
      peerCallsRef.current.clear();
    }

    return () => { mounted = false; };
  }, [cameraOn, micOn, voiceSocket, meetingId, user]);

  // ==================== FUNCIONES RESTANTES (sin cambios) ====================

  function toggleChat() {
    setShowChat((s) => !s);
    if (!showChat) {
      setHasNewMessages(false);
    }
  }

  function toggleCode() {
    setShowCode((s) => !s);
  }

  function copyCode() {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId).then(() => {
        alert('Código copiado al portapapeles');
      }).catch(err => {
        console.error('Error copiando código:', err);
        alert('Error copiando código');
      });
    }
  }

  function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket || meetingEnded) return;
    const authorName = user?.name || 'Tú';
    socket.emit('send-message', { meetingId, message: text, author: authorName });
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);
    setChatInput('');
  }

  async function hangup() {
    if (isCreator && meetingId && token) {
      try {
        await fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        socket?.emit('end-meeting', meetingId);
        console.log('Reunión finalizada por el creador');
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }

    if (user && voiceSocket) {
      voiceSocket.emit('leave-voice-room', { meetingId, peerId: user.id });
    }

    setParticipants([]);
    setShowChat(false);
    navigate('/realtime');
  }

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
      {/* Indicador de estado de conexión - AÑADIDO */}
      <div className={`vc-connection-status ${connectionStatus}`}>
        {connectionStatus === 'connecting' && 'Conectando...'}
        {connectionStatus === 'connected' && '✓ Conectado'}
        {connectionStatus === 'disconnected' && '⚠ Reconectando...'}
      </div>

      <div className="vc-top-left-back" onClick={() => window.history.back()} aria-hidden>
        ←
      </div>

      <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
        {participants.map((p: any) => ( // TypeScript: usar 'any' temporalmente o definir interfaz
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
                    {p.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                )
              ) : (
                <div className="vc-avatar">
                  {p.name.split(' ').map((n: string) => n[0]).join('')}
                  {/* Indicador de audio activo - AÑADIDO */}
                  {connectionStatus === 'connected' && (
                    <span className="vc-audio-indicator">🔊</span>
                  )}
                </div>
              )}
            </div>
            <div className="vc-name">
              {p.name}
              {/* Badge de estado - AÑADIDO */}
              {p.isLocal && connectionStatus !== 'connected' && (
                <span className="vc-connection-badge">
                  {connectionStatus === 'connecting' ? '🔄' : '🔌'}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="vc-controls" role="region" aria-label="Controles de llamada">
        <button
          className={`vc-control ${cameraOn ? 'on' : 'vc-control-muted'}`}
          title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
          aria-pressed={cameraOn}
          onClick={() => setCameraOn((s) => !s)}
          disabled={connectionStatus === 'disconnected'}
        >
          {cameraOn ? '📷' : '🚫'}
        </button>

        <button
          className={`vc-control ${micOn ? 'on' : 'vc-control-muted'} ${connectionStatus === 'disconnected' ? 'disabled' : ''}`}
          title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          aria-pressed={micOn}
          onClick={() => {
            if (connectionStatus !== 'disconnected') {
              setMicOn((s) => !s);
            }
          }}
        >
          {micOn ? '🎙️' : '🔇'}
        </button>

        <button
          className={`vc-control vc-control-chat ${showChat ? 'active' : ''}`}
          title="Chat"
          aria-pressed={showChat}
          onClick={toggleChat}
        >
          💬
          {hasNewMessages && !showChat && <span className="vc-chat-notification">●</span>}
        </button>

        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCode}
        >
          🔗
        </button>

        <button className="vc-control vc-control-hangup" title="Colgar" onClick={hangup}>
          📞
        </button>

        {/* Botón de reconexión - AÑADIDO */}
        {connectionStatus === 'disconnected' && (
          <button
            className="vc-control vc-control-refresh"
            title="Reconectar"
            onClick={() => {
              if (voiceSocket && peerRef.current) {
                voiceSocket.connect();
                if (peerRef.current.disconnected) {
                  peerRef.current.reconnect();
                }
              }
            }}
          >
            🔄
          </button>
        )}
      </div>

      {/* Code modal */}
      {showCode && (
        <div className="vc-modal-overlay" onClick={() => setShowCode(false)}>
          <div className="vc-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button className="vc-modal-close" onClick={() => setShowCode(false)} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="vc-modal-body">
              <p>Comparte este código para que otros se unan:</p>
              <div className="vc-code-display">
                <input type="text" value={meetingId || ''} readOnly onClick={(e) => e.currentTarget.select()} />
                <button onClick={copyCode}>Copiar</button>
              </div>
              {/* Información de conexión - AÑADIDO */}
              <div className="vc-connection-info">
                <p><strong>Estado:</strong> {connectionStatus}</p>
                <p><strong>Peers conectados:</strong> {peerCallsRef.current.size}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && (
        <div className="vc-chat-overlay" onClick={() => setShowChat(false)} />
      )}

      <aside className={`vc-chat-panel ${showChat ? 'open' : ''}`} aria-hidden={!showChat} role="dialog" aria-label="Chat de la reunión">
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={() => setShowChat(false)} aria-label="Cerrar chat">
            ×
          </button>
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
            disabled={connectionStatus === 'disconnected' || !socket?.connected}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || connectionStatus === 'disconnected' || !socket?.connected}
          >
            Enviar
          </button>
        </form>
      </aside>
    </main>
  );
}