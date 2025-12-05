import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';  // To obtain token and username
import Peer from 'peerjs';

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const location = useLocation();
  const meetingId = (location.state as any)?.meetingId;  // Meeting ID from RealTime
  const { token, user } = useAuthStore();  // Obtain token and user (assuming user.name and user.id)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);  // If the user is the creator
  const [showCode, setShowCode] = useState(false);  // To show/hide the code modal
  const [meetingEnded, setMeetingEnded] = useState(false);  // If the meeting ended
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);  // Separate socket for voice
  const [peer, setPeer] = useState<Peer | null>(null);  // Peer.js instance for WebRTC
  const peerCallsRef = useRef<Map<string, any>>(new Map());  // Track active Peer calls

  // Start with a single participant (the current user). More participants can be simulated.
  /**
   * Participants list. Each participant has an { id: number, name: string } shape.
   * Starts with a single local participant.
   * @type {[{id:number,name:string}[], Function]}
   */
  const [participants, setParticipants] = useState(() => [{ id: user?.id || 'local', name: 'Tú', isLocal: true }]); // Local user always present

  /** Whether the local camera is enabled. */
  const [cameraOn, setCameraOn] = useState(false);

  /** Whether the local microphone is enabled. */
  const [micOn, setMicOn] = useState(false);

  /** Whether the chat panel is visible. */
  const [showChat, setShowChat] = useState(false);

  /** Current chat input value. */
  const [chatInput, setChatInput] = useState('');

  /** Add status for new message notifications */
  const [hasNewMessages, setHasNewMessages] = useState(false);

  /**
   * Chat messages list. Each message has { id: number, author: string, text: string }.
   * Initialized with a system welcome message.
   */
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  // Connect to Socket.IO and get a meeting when mounting
  useEffect(() => {
    if (!meetingId || !token || !user) return;
    const chatBackendUrl = 'https://realtimechatbackend-87nm.onrender.com';  // Render URL deployed
    const newSocket = io(chatBackendUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    // Voice backend connection (new)
    const voiceBackendUrl = 'https://realtimevoicebackend.onrender.com';  // Replace with actual Render URL after deployment
    const newVoiceSocket = io(voiceBackendUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVoiceSocket(newVoiceSocket);

    // Initialize Peer.js for local user (new)
    const newPeer = new Peer(user.id, {
      host: voiceBackendUrl.replace('https://', '').replace('http://', ''),
      port: 443,  // Use 443 for HTTPS
      path: '/peerjs',
      secure: true,
    });
    setPeer(newPeer);

    // Check if creator
    fetch(`${chatBackendUrl}/api/meetings/${meetingId}`, {
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

    // Chat socket events
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

    // Voice socket and Peer.js events (new)
    newVoiceSocket.on('connect', () => {
      console.log('[FRONT] Voice socket connected');
      newVoiceSocket.emit('join-voice-room', { meetingId, peerId: user.id, userId: user.id });
    });

    newVoiceSocket.on('voice-joined', (data: { peers: string[] }) => {
      console.log('[FRONT] Voice joined, connecting to peers:', data.peers);
      // Connect to existing peers
      data.peers.forEach(peerId => {
        if (peer && micOn && mediaStreamRef.current && mediaStreamRef.current.getAudioTracks().length > 0) {
          console.log('[FRONT] Calling existing peer:', peerId, 'with audio stream');
          const call = peer.call(peerId, mediaStreamRef.current);
          peerCallsRef.current.set(peerId, call);
          call.on('stream', (remoteStream) => {
            console.log('[FRONT] Received remote stream from existing peer:', peerId);
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play().catch(err => console.error('Error playing remote audio:', err));
          });
          call.on('close', () => {
            console.log('[FRONT] Call closed with existing peer:', peerId);
            peerCallsRef.current.delete(peerId);
          });
          call.on('error', (err) => {
            console.error('[FRONT] Call error with existing peer:', peerId, err);
          });
        } else {
          console.warn('[FRONT] Cannot call existing peer:', peerId, 'micOn:', micOn, 'stream has audio:', (mediaStreamRef.current?.getAudioTracks()?.length ?? 0) > 0);
        }
      });
    });

    newVoiceSocket.on('peer-joined', (peerId: string) => {
      console.log('[FRONT] Peer joined voice:', peerId);
      if (peer && micOn && mediaStreamRef.current && mediaStreamRef.current.getAudioTracks().length > 0) {
        console.log('[FRONT] Attempting to call peer:', peerId, 'with stream:', mediaStreamRef.current.getAudioTracks().length > 0 ? 'has audio' : 'no audio');
        const call = peer.call(peerId, mediaStreamRef.current);
        peerCallsRef.current.set(peerId, call);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Received remote stream from:', peerId);
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play().catch(err => console.error('Error playing remote audio:', err));
        });
        call.on('close', () => {
          console.log('[FRONT] Call closed with:', peerId);
          peerCallsRef.current.delete(peerId);
        });
        call.on('error', (err) => {
          console.error('[FRONT] Call error with:', peerId, err);
        });
      } else {
        console.warn('[FRONT] Cannot call peer:', peerId, 'peer:', !!peer, 'micOn:', micOn, 'stream:', !!mediaStreamRef.current);
      }
    });

    newVoiceSocket.on('peer-disconnected', (peerId: string) => {
      console.log('[FRONT] Peer disconnected:', peerId);
      const call = peerCallsRef.current.get(peerId);
      if (call) call.close();
      peerCallsRef.current.delete(peerId);
    });

    newVoiceSocket.on('voice-error', (msg: string) => {
      console.error('[FRONT] Voice error:', msg);
      alert(`Voice error: ${msg}`);
    });

    // Peer.js events (new)
    newPeer.on('call', (call) => {
      if (!call.peer) {
        console.warn('[FRONT] Incoming call has no peer ID, ignoring');
        return;
      }
      console.log('[FRONT] Incoming call from:', call.peer);
      if (micOn && mediaStreamRef.current && (mediaStreamRef.current?.getAudioTracks()?.length ?? 0) > 0) {
        console.log('[FRONT] Answering call from:', call.peer, 'with stream:', mediaStreamRef.current.getAudioTracks().length > 0 ? 'has audio' : 'no audio');
        call.answer(mediaStreamRef.current);
        peerCallsRef.current.set(call.peer, call);
        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Received remote stream from:', call.peer);
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play().catch(err => console.error('Error playing remote audio:', err));
        });
        call.on('close', () => {
          console.log('[FRONT] Incoming call closed with:', call.peer);
          peerCallsRef.current.delete(call.peer);
        });
        call.on('error', (err) => {
          console.error('[FRONT] Incoming call error with:', call.peer, err);
        });
      } else {
        console.warn('[FRONT] Rejecting call from:', call.peer, 'micOn:', micOn, 'stream:', !!mediaStreamRef.current);
        call.close();  // Rechazar si no hay micrófono
      }
    });

    return () => {
      console.log('[FRONT] Cleanup: desconectando socket y el peer');
      newSocket.off('connect', handleConnect);
      newSocket.disconnect();
      newVoiceSocket.disconnect();
      newPeer.destroy();
    };
  }, [meetingId, token, user?.id]);


  /**
   * Toggle the chat panel visibility.
   * @returns {void}
   */
  function toggleChat() {
    setShowChat((s) => !s);
    if (!showChat) {  // If the chat opens, remove the notification.
      setHasNewMessages(false);
    }
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
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);  // Show 'You' to the sender
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
            current.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
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
          current.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
        } catch (e) { /* ignore */ }

        mediaStreamRef.current = newStream;
        if (localVideoRef.current) {
          try { localVideoRef.current.srcObject = newStream; if (newStream.getVideoTracks().length) await localVideoRef.current.play(); } catch (e) { /* ignore */ }
        }
      } catch (err: any) {
        console.error('getUserMedia error', err);
        if (err && /NotAllowedError|SecurityError/.test(err.name)) {
          alert('Permiso denegado para acceder a la cámara/micrófono. Concede permisos y recarga.');
        }
        if (!navigator.mediaDevices) {
          setCameraOn(false);
          setMicOn(false);
        }
      }
    }

    ensureMedia();

    // Update Peer calls when mic changes (new)
    if (peer && mediaStreamRef.current && mediaStreamRef.current.getAudioTracks().length > 0) {
      if (micOn) {
        console.log('[FRONT] Mic activated, re-calling all peers with new stream');
        // Close existing calls
        peerCallsRef.current.forEach(call => call.close());
        peerCallsRef.current.clear();
        // Re-emit join to reconnect
        if (user) voiceSocket?.emit('join-voice-room', { meetingId, peerId: user.id, userId: user.id });
      } else {
        console.log('[FRONT] Mic deactivated, closing all calls');
        // Close all calls
        peerCallsRef.current.forEach(call => call.close());
        peerCallsRef.current.clear();
      }
    } else if (micOn) {
      console.warn('[FRONT] Mic is on but no valid audio stream available');
    }

    return () => { mounted = false; };
  }, [cameraOn, micOn, peer, voiceSocket, meetingId, user?.id]);

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
      if (voiceSocket) voiceSocket.disconnect();
      if (peer) peer.destroy();
      peerCallsRef.current.forEach(call => call.close());
      peerCallsRef.current.clear();
    };
  }, [socket, voiceSocket, peer]);

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
        // Notify everyone via Socket.IO
        socket?.emit('end-meeting', meetingId);
        console.log('Reunión finalizada por el creador');
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }
    // Disconnect from voice room (new)
    if (user) voiceSocket?.emit('leave-voice-room', { meetingId, peerId: user.id });
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
              {p.isLocal ? (
                // Local participant: show local video if cameraOn
                cameraOn ? (
                  <video ref={localVideoRef} className="vc-local-video" muted playsInline />
                ) : (
                  <div className="vc-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
                )
              ) : (
                // Remote participants: always show avatar (no video for now)
                <div className="vc-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
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
          {hasNewMessages && !showChat && <span className="vc-chat-notification">●</span>}  {/* Punto rojo */}
        </button>
        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCode}
        >
          🔗
        </button>
        {/* REMOVIDO: Botón de agregar participante */}
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