import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';  // Para obtener token y usuario

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const location = useLocation();
  const meetingId = (location.state as any)?.meetingId;  // ID de reunión desde RealTime
  const { token, user } = useAuthStore();  // Obtener token y usuario (asumiendo user.name y user.id)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);  // Si el usuario es el creador
  const [showCode, setShowCode] = useState(false);  // Para mostrar/ocultar el modal de código
  const [meetingEnded, setMeetingEnded] = useState(false);  // Si la reunión terminó

  // Start with a single participant (the current user). More participants can be simulated.
  /**
   * Participants list. Each participant has an { id: number, name: string } shape.
   * Starts with a single local participant.
   * @type {[{id:number,name:string}[], Function]}
   */
  const [participants, setParticipants] = useState(() => [ { id: 1, name: user?.name || 'Tú' } ]);

  /** Whether the local camera is enabled. */
  const [cameraOn, setCameraOn] = useState(false);

  /** Whether the local microphone is enabled. */
  const [micOn, setMicOn] = useState(false);

  /** Whether the chat panel is visible. */
  const [showChat, setShowChat] = useState(false);

  /** Current chat input value. */
  const [chatInput, setChatInput] = useState('');

  /**
   * Chat messages list. Each message has { id: number, author: string, text: string }.
   * Initialized with a system welcome message.
   */
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  // Conectar a Socket.IO y obtener reunión al montar
  useEffect(() => {
    if (!meetingId || !token) return;
    const chatBackendUrl = 'https://realtimechatbackend-87nm.onrender.com';  // URL de Render desplegado
    const newSocket = io(chatBackendUrl, {
      auth: { token },  // Enviar token para autenticación
    });
    setSocket(newSocket);

    // Obtener reunión para verificar si es creador
    fetch(`${chatBackendUrl}/api/meetings/${meetingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.meeting && data.meeting.creatorId === user?.id) {
          setIsCreator(true);
        }
      })
      .catch(err => console.error('Error obteniendo reunión:', err));

    // Unirse a la reunión
    newSocket.emit('join-meeting', meetingId);

    // Escuchar mensajes
    newSocket.on('receive-message', (data: { author: string; text: string; timestamp: string }) => {
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
    });

    // Escuchar terminación de reunión
    newSocket.on('meeting-ended', (message: string) => {
      setMeetingEnded(true);
      alert(message);
      setTimeout(() => navigate('/realtime'), 3000);  // Redirigir en 3 segundos
    });

    // Manejar errores
    newSocket.on('error', (msg: string) => {
      alert(`Error: ${msg}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [meetingId, token, user?.id]);

  /**
   * Adds a simulated participant to the call, up to a maximum number for layout purposes.
   * @returns {void}
   */
  function addParticipant() {
    setParticipants((prev) => {
      if (prev.length >= 10) return prev; // limit for layout (ajustado a 10)
      const nextId = prev.length + 1;
      return [...prev, { id: nextId, name: `Usuario ${nextId}` }];
    });
  }

  /**
   * Toggle the chat panel visibility.
   * @returns {void}
   */
  function toggleChat() {
    setShowChat((s) => !s);
  }

  /**
   * Toggle the code modal visibility.
   * @returns {void}
   */
  function toggleCode() {
    setShowCode((s) => !s);
  }

  /**
   * Copy the meeting code to clipboard.
   * @returns {void}
   */
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

  /**
   * Send the current chat input as a message.
   * If an event is provided, prevents default form submission behavior.
   *
   * @param {React.FormEvent} [e] - Optional form event.
   * @returns {void}
   */
  function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket || meetingEnded) return;
    const authorName = user?.name || 'Tú';  // Usar nombre real
    socket.emit('send-message', { meetingId, message: text, author: authorName });
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);  // Mostrar 'Tú' para el sender
    setChatInput('');
  }

  const navigate = useNavigate();

  // refs for local media
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  /** Ref that holds the current MediaStream for local audio/video. */
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Manage media (video/audio) according to cameraOn and micOn
  useEffect(() => {
    let mounted = true;

    /**
     * Ensure the local media stream matches the desired camera/mic state.
     * Requests getUserMedia when needed, reuses or replaces the existing stream,
     * and stops tracks when no longer required.
     *
     * @returns {Promise<void>}
     */
    async function ensureMedia() {
      try {
        const desiredVideo = !!cameraOn;
        const desiredAudio = !!micOn;
        const current = mediaStreamRef.current;

        // If nothing is desired, ensure we release any existing stream
        if (!desiredVideo && !desiredAudio) {
          if (current) {
            current.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            mediaStreamRef.current = null;
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
          }
          return;
        }

        // If there is no current stream, just request one with desired constraints
        if (!current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: desiredVideo, audio: desiredAudio });
          if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
          mediaStreamRef.current = stream;
          if (localVideoRef.current && stream.getVideoTracks().length) {
            try { localVideoRef.current.srcObject = stream; await localVideoRef.current.play(); } catch (e) { /* ignore */ }
          }
          return;
        }

        // There is a current stream. If its tracks already match desired constraints, just enable/disable them.
        const hasVideo = current.getVideoTracks().length > 0;
        const hasAudio = current.getAudioTracks().length > 0;

        if (hasVideo === desiredVideo && hasAudio === desiredAudio) {
          // Toggle enabled flags to reflect current desired state
          current.getVideoTracks().forEach(t => t.enabled = desiredVideo);
          current.getAudioTracks().forEach(t => t.enabled = desiredAudio);
          return;
        }

        // Otherwise, re-request a fresh stream with the exact desired constraints and replace the old one.
        const newStream = await navigator.mediaDevices.getUserMedia({ video: desiredVideo, audio: desiredAudio });
        if (!mounted) { newStream.getTracks().forEach(t => t.stop()); return; }

        // Stop old tracks
        try {
          current.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        } catch (e) { /* ignore */ }

        mediaStreamRef.current = newStream;
        if (localVideoRef.current) {
          try { localVideoRef.current.srcObject = newStream; if (newStream.getVideoTracks().length) await localVideoRef.current.play(); } catch (e) { /* ignore */ }
        }
      } catch (err: any) {
        console.error('getUserMedia error', err);
        if (err && /NotAllowedError|SecurityError/.test(err.name)) {
          alert('Permiso denegado para acceder a la cámara/micrófono.');
        }
        if (!navigator.mediaDevices) {
          setCameraOn(false);
          setMicOn(false);
        }
      }
    }

    ensureMedia();

    return () => { mounted = false; };
  }, [cameraOn, micOn]);

  // cleanup on unmount
  useEffect(() => {
    /**
     * Cleanup any active media tracks on component unmount.
     * @returns {void}
     */
    return () => {
      const s = mediaStreamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      if (socket) socket.disconnect();
    };
  }, [socket]);

  /**
   * Hang up the call: clears participants and chat, then navigates back to the realtime landing.
   * If the user is the creator, ends the meeting in the database and notifies others.
   * @returns {void}
   */
  async function hangup() {
    if (isCreator && meetingId && token) {
      try {
        const chatBackendUrl = 'https://realtimechatbackend-87nm.onrender.com';
        await fetch(`${chatBackendUrl}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        // Notificar a todos via Socket.IO
        socket?.emit('end-meeting', meetingId);
        console.log('Reunión finalizada por el creador');
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }
    // reset state if desired
    setParticipants([]);
    setShowChat(false);
    // navigate back to realtime landing
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
      <div className="vc-top-left-back" onClick={() => window.history.back()} aria-hidden>
        ←
      </div>

      <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
        {participants.map((p) => (
          <div key={p.id} className="vc-tile" role="group" aria-label={p.name}>
            <div className="vc-card">
              {p.id === 1 ? (
                // local participant: show local video if cameraOn
                cameraOn ? (
                  <video ref={localVideoRef} className="vc-local-video" muted playsInline />
                ) : (
                  <div className="vc-avatar">{p.name.split(' ').map(n=>n[0]).join('')}</div>
                )
              ) : (
                <div className="vc-avatar">{p.name.split(' ').map(n=>n[0]).join('')}</div>
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
          aria-pressed={!cameraOn}
          onClick={() => setCameraOn((s) => !s)}
        >
          {cameraOn ? '📷' : '🚫'}
        </button>

        <button
          className={`vc-control ${micOn ? 'on' : 'vc-control-muted'}`}
          title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          aria-pressed={!micOn}
          onClick={() => setMicOn((s) => !s)}
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
        </button>
        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCode}
        >
          🔗
        </button>
        <button className="vc-control vc-control-add" title="Agregar participante" onClick={addParticipant}>＋</button>
        <button className="vc-control vc-control-hangup" title="Colgar" onClick={hangup}>📞</button>
      </div>

      {/* Code modal (centered) */}
      {showCode && (
        <div className="vc-modal-overlay" onClick={() => setShowCode(false)}>
          <div className="vc-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button className="vc-modal-close" onClick={() => setShowCode(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="vc-modal-body">
              <p>Comparte este código para que otros se unan:</p>
              <div className="vc-code-display">
                <input type="text" value={meetingId || ''} readOnly />
                <button onClick={copyCode}>Copiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel (slides from right) */}
      {showChat && (
        <div className="vc-chat-overlay" onClick={() => setShowChat(false)} />
      )}

      <aside className={`vc-chat-panel ${showChat ? 'open' : ''}`} aria-hidden={!showChat} role="dialog" aria-label="Chat de la reunión">
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={() => setShowChat(false)} aria-label="Cerrar chat">×</button>
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
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe un mensaje..." />
          <button type="submit">Enviar</button>
        </form>
      </aside>
    </main>
  );
}