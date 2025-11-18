import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VideoCall() {
  // Start with a single participant (the current user). More participants can be simulated.
  const [participants, setParticipants] = useState(() => [ { id: 1, name: 'Tú' } ]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
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
              <div className="vc-avatar">{p.name.split(' ').map(n=>n[0]).join('')}</div>
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
