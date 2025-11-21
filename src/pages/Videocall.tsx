import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VideoCall() {
  // Start with a single participant (the current user). More participants can be simulated.
  const [participants, setParticipants] = useState(() => [ { id: 1, name: 'Tú' } ]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  function addParticipant() {
    setParticipants((prev) => {
      if (prev.length >= 9) return prev; // limit for layout
      const nextId = prev.length + 1;
      return [...prev, { id: nextId, name: `User ${nextId}` }];
    });
  }

  function toggleChat() {
    setShowChat((s) => !s);
  }

  function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);
    setChatInput('');
  }

  const navigate = useNavigate();

  // refs for local media
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Manage media (video/audio) according to cameraOn and micOn
  useEffect(() => {
    let mounted = true;

    async function ensureMedia() {
      try {
        const s = mediaStreamRef.current;

        // If no stream yet, request based on current needs
        if (!s) {
          const constraints = { video: !!cameraOn, audio: !!micOn };
          if (!constraints.video && !constraints.audio) return;
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          if (localVideoRef.current && stream.getVideoTracks().length) {
            try { localVideoRef.current.srcObject = stream; await localVideoRef.current.play(); } catch (e) { /* ignore */ }
          }
          return;
        }

        // If stream exists, enable/disable tracks as requested
        // Video
        const hasVideo = s.getVideoTracks().length > 0;
        if (cameraOn) {
          if (hasVideo) s.getVideoTracks().forEach(t => t.enabled = true);
          else {
            // request video-only and add tracks
            const vs = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            vs.getVideoTracks().forEach(t => s.addTrack(t));
            if (localVideoRef.current) localVideoRef.current.srcObject = s;
          }
        } else {
          // Stop and remove video tracks to fully release the camera device
          s.getVideoTracks().forEach(t => {
            try { t.stop(); } catch (e) { /* ignore */ }
            try { s.removeTrack(t); } catch (e) { /* ignore */ }
          });
          if (localVideoRef.current) {
            try { localVideoRef.current.srcObject = null; } catch (e) { /* ignore */ }
          }
        }

        // Audio
        const hasAudio = s.getAudioTracks().length > 0;
        if (micOn) {
          if (hasAudio) s.getAudioTracks().forEach(t => t.enabled = true);
          else {
            const as = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            as.getAudioTracks().forEach(t => s.addTrack(t));
          }
        } else {
          // Stop and remove audio tracks to release the microphone
          s.getAudioTracks().forEach(t => {
            try { t.stop(); } catch (e) { /* ignore */ }
            try { s.removeTrack(t); } catch (e) { /* ignore */ }
          });
        }

        // If the stream has no tracks left, release reference
        if (s.getTracks().length === 0) {
          try {
            mediaStreamRef.current = null;
          } catch (e) { /* ignore */ }
        }

      } catch (err: any) {
        console.error('getUserMedia error', err);
        if (err && /NotAllowedError|SecurityError/.test(err.name)) {
          alert('Permiso denegado para acceder a la cámara/micrófono.');
        }
        // reflect state
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
    return () => {
      const s = mediaStreamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  function hangup() {
    // reset state if desired
    setParticipants([]);
    setShowChat(false);
    // navigate back to realtime landing
    navigate('/realtime');
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
        <button className="vc-control vc-control-add" title="Agregar participante" onClick={addParticipant}>＋</button>
        <button className="vc-control vc-control-hangup" title="Colgar" onClick={hangup}>📞</button>
      </div>

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
