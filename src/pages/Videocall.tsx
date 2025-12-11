import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useMedia } from '../services/media';
import { usePeer } from '../services/peer';
import { useSockets } from '../services/sockets';
import { setupWebRTCHandlers } from '../services/webrtc';

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const location = useLocation();
  const meetingId = (location.state as any)?.meetingId;
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const remoteVideoRefs = useRef(new Map<string, MediaStream>());

  const {
    audioStreamRef,  // Nuevo: Usar audioStreamRef para voz
    videoStreamRef,  // Nuevo: Usar videoStreamRef para video
    localVideoRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn
  } = useMedia();

  const {
    socket,
    voiceSocket,
    videoSocket,
    isCreator,
    CHAT_BACKEND_URL
  } = useSockets(meetingId);

  const {
    peerVoice,
    peerVideo,
    peerCallsRef,
    initiateCall
  } = usePeer(meetingId, voiceSocket, videoSocket, audioStreamRef, videoStreamRef, cameraOn, micOn, remoteVideoRefs);

  const [showCode, setShowCode] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [participants, setParticipants] = useState(() => [{ id: user?.id || 'local', name: 'Tú', isLocal: true }]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  // 🔔 Modal no bloqueante
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');


  // ==================== SOCKET HANDLERS ====================
  useEffect(() => {
    if (!socket || !voiceSocket || !videoSocket || !user || !meetingId) return;

    let hasJoined = false;

    const handleConnect = () => {
      console.log('[FRONT] Socket conectado, uniéndose a reunión si no lo ha hecho');
      if (!hasJoined) {
        socket.emit('join-meeting', { meetingId, userId: user.id, name: user.name });
        hasJoined = true;
      }
    };

    const handleReceiveMessage = (data: { author: string; text: string; timestamp: string }) => {
      console.log('[FRONT] Mensaje recibido:', data);
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
      if (!showChat) setHasNewMessages(true);
    };

    const handleParticipantsList = (participantsList: { userId: string; name: string }[]) => {
      console.log('[FRONT] Lista de participantes recibida:', participantsList);
      setParticipants(participantsList.map(p => ({
        id: p.userId,
        name: p.userId === user.id ? 'Tú' : p.name,
        isLocal: p.userId === user.id
      })));
    };

    const cleanupMedia = () => {
      console.log('[FRONT] Limpieza forzada de medios');
      peerCallsRef.current?.forEach((call) => {
        try {
          call.close();
        } catch { }
      });
      peerCallsRef.current?.clear();
      // FORZAR apagado del micrófono y cámara
      if (audioStreamRef.current) {  // Corregido: Usar audioStreamRef
        audioStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {  // Agregado tipo
          try {
            track.enabled = false;
            track.stop();
          } catch { }
        });
        audioStreamRef.current = null;
      }
      if (videoStreamRef.current) {  // Corregido: Usar videoStreamRef
        videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {  // Agregado tipo
          try {
            track.enabled = false;
            track.stop();
          } catch { }
        });
        videoStreamRef.current = null;
      }
      // Destruir peers de voz y video
      try {
        peerVoice?.destroy();
        peerVideo?.destroy();
      } catch { }
      // Forzar desconexión de sockets
      try {
        voiceSocket?.disconnect();
        videoSocket?.disconnect();
      } catch { }
    };

    const handleForceDisconnect = () => {
      console.log('[FRONT] Forzado a desconectar por el servidor');
      cleanupMedia();

      if (voiceSocket) {
        voiceSocket.removeAllListeners();
        voiceSocket.close();
      }
      if (videoSocket) {
        videoSocket.removeAllListeners();
        videoSocket.close();
      }

      setMeetingEnded(true);
      setModalMessage('Has sido desconectado por el anfitrión.');
      setModalVisible(true);
      setTimeout(() => navigate('/realtime'), 1500);
    };

    const handleMeetingEnded = (message: string) => {
      console.log('[FRONT] Reunión terminada:', message);
      cleanupMedia();
      setMeetingEnded(true);
      setModalMessage(message);
      setModalVisible(true);
      setTimeout(() => navigate('/realtime'), 2000);
    };

    const handleUserJoined = (data: { userId: string; name: string }) => {
      console.log('[FRONT] Usuario unido:', data);
      setParticipants((prev) => {
        if (prev.some(p => p.id === data.userId) || prev.length >= 10) return prev;
        return [...prev, { id: data.userId, name: data.name, isLocal: false }];
      });
    };

    const handleUserLeft = (data: { userId: string }) => {
      console.log('[FRONT] Usuario salió:', data);
      setParticipants((prev) => prev.filter(p => p.id !== data.userId));
    };

    const handleSocketError = (msg: string) => {
      console.error('[FRONT] Error de socket:', msg);
      setModalMessage(`Error: ${msg}`);
      setModalVisible(true);
    };

    const handleVoiceJoined = (data: { peers: string[] }) => {
      console.log('[FRONT] Voice joined, connecting to peers:', data.peers);
      data.peers.forEach(peerId => {
        if (micOn) initiateCall(peerId);
      });
    };

    const handlePeerJoined = (peerId: string) => {
      console.log('[FRONT] Peer joined voice:', peerId);
      if (micOn) initiateCall(peerId);
    };

    const handlePeerDisconnected = (peerId: string) => {
      const pc = peerCallsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerCallsRef.current.delete(peerId);
      }
    };

    const handleVoiceError = (msg: string) => {
      console.error('[FRONT] Voice error:', msg);
      setModalMessage(`Voice error: ${msg}`);
      setModalVisible(true);
    };

    const handleVideoJoined = (data: { peers: string[] }) => {
      console.log('[FRONT] Video joined, connecting to peers:', data.peers);
      data.peers.forEach(peerId => {
        if (cameraOn) initiateCall(peerId);
      });
    };

    const handlePeerJoinedVideo = (peerId: string) => {
      console.log('[FRONT] Peer joined video:', peerId);
      if (cameraOn) initiateCall(peerId);
    };

    const handleVideoError = (msg: string) => {
      console.error('[FRONT] Video error:', msg);
      setModalMessage(`Video error: ${msg}`);
      setModalVisible(true);
    };

    // Eliminar listeners previos para evitar duplicados
    socket.removeAllListeners('connect');
    socket.removeAllListeners('receive-message');
    socket.removeAllListeners('participants-list');
    socket.removeAllListeners('meeting-ended');
    socket.removeAllListeners('user-joined');
    socket.removeAllListeners('user-left');
    socket.removeAllListeners('error');

    voiceSocket.removeAllListeners('connect');
    voiceSocket.removeAllListeners('voice-joined');
    voiceSocket.removeAllListeners('peer-joined');
    voiceSocket.removeAllListeners('peer-disconnected');
    voiceSocket.removeAllListeners('voice-error');
    voiceSocket.removeAllListeners('force-disconnect');

    videoSocket.removeAllListeners('connect');
    videoSocket.removeAllListeners('video-joined');
    videoSocket.removeAllListeners('peer-joined');
    videoSocket.removeAllListeners('peer-disconnected');
    videoSocket.removeAllListeners('video-error');
    videoSocket.removeAllListeners('force-disconnect');

    // Registrar handlers
    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('participants-list', handleParticipantsList);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('error', handleSocketError);

    voiceSocket.on('connect', () => console.log('[FRONT] Voice socket connected'));
    voiceSocket.on('voice-joined', handleVoiceJoined);
    voiceSocket.on('peer-joined', handlePeerJoined);
    voiceSocket.on('peer-disconnected', handlePeerDisconnected);
    voiceSocket.on('voice-error', handleVoiceError);
    voiceSocket.on('force-disconnect', handleForceDisconnect);

    videoSocket.on('connect', () => console.log('[FRONT] Video socket connected'));
    videoSocket.on('video-joined', handleVideoJoined);
    videoSocket.on('peer-joined', handlePeerJoinedVideo);
    videoSocket.on('peer-disconnected', handlePeerDisconnected);
    videoSocket.on('video-error', handleVideoError);
    videoSocket.on('force-disconnect', handleForceDisconnect);

    const cleanupWebRTC = setupWebRTCHandlers(voiceSocket, peerCallsRef, audioStreamRef);  // Corregido: Pasar audioStreamRef

    return () => {
      cleanupWebRTC();
    };
  }, [socket, voiceSocket, videoSocket, user, meetingId, micOn, cameraOn, audioStreamRef, videoStreamRef, initiateCall, navigate]);  // Corregido: Agregar audioStreamRef y videoStreamRef

  // ==================== UI ====================
  const toggleChat = () => {
    setShowChat((s) => !s);
    if (!showChat) setHasNewMessages(false);
  };

  const toggleCode = () => {
    setShowCode((s) => !s);
  };

  const copyCode = () => {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId)
        .then(() => {
          setModalMessage('Código copiado al portapapeles');
          setModalVisible(true);
          setTimeout(() => setModalVisible(false), 1500);
        })
        .catch(() => {
          setModalMessage('Error copiando código');
          setModalVisible(true);
          setTimeout(() => setModalVisible(false), 1500);
        });
    }
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket || meetingEnded) return;
    const authorName = user?.name || 'Tú';
    socket.emit('send-message', { meetingId, message: text, author: authorName });
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);
    setChatInput('');
  };

  const hangup = async () => {
    if (isCreator && meetingId) {
      try {
        const { token } = useAuthStore.getState();
        await fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        socket?.emit('end-meeting', meetingId);
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }

    if (user && voiceSocket) {
      voiceSocket.emit('leave-voice-room', { meetingId, peerId: user.id });
    }
    if (user && videoSocket) {
      videoSocket.emit('leave-video-room', { meetingId, peerId: user.id });
    }

    setParticipants([]);
    setShowChat(false);
    navigate('/realtime');
  };

  if (meetingEnded) {
    return (
      <main className="videocall-page">
        <div className="vc-ended-message">
          <h2>La reunión ha terminado</h2>
          <p>Serás redirigido en unos segundos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="videocall-page" role="main" aria-label="Videollamada">
      {modalVisible && (
        <div className="rt-toast show">
          {modalMessage}
        </div>
      )}

      <div className="vc-top-left-back" onClick={() => window.history.back()} aria-hidden>
        ←
      </div>

      <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
        {participants.map((p) => (
          <div key={p.id} className="vc-tile" role="group" aria-label={p.name}>
            <div className="vc-card">
              {p.isLocal ? (
                cameraOn ? (
                  <video
                    ref={(el) => {
                      if (el && videoStreamRef.current) {  // Corregido: Usar videoStreamRef para video local
                        el.srcObject = videoStreamRef.current;
                        el.play().catch(console.error);
                      }
                    }}
                    className="vc-local-video"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="vc-avatar">
                    {'Tú'}
                  </div>
                )
              ) : (
                remoteVideoRefs.current.has(p.id) ? (
                  <video
                    ref={(el) => {
                      if (el && remoteVideoRefs.current.get(p.id)) {
                        el.srcObject = remoteVideoRefs.current.get(p.id) || null;
                        el.play().catch(console.error);
                      }
                    }}
                    className="vc-remote-video"
                    playsInline
                  />
                ) : (
                  <div className="vc-avatar">
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )
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
          {hasNewMessages && !showChat && (
            <span className="vc-chat-notification">●</span>
          )}
        </button>

        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCode}
        >
          🔗
        </button>

        <button
          className="vc-control vc-control-hangup"
          title="Colgar"
          onClick={hangup}
        >
          📞
        </button>
      </div>

      {showCode && (
        <div className="vc-modal-overlay" onClick={() => setShowCode(false)}>
          <div
            className="vc-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button
                className="vc-modal-close"
                onClick={() => setShowCode(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
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

      {showChat && (
        <div
          className="vc-chat-overlay"
          onClick={() => setShowChat(false)}
        />
      )}

      <aside
        className={`vc-chat-panel ${showChat ? 'open' : ''}`}
        aria-hidden={!showChat}
        role="dialog"
        aria-label="Chat de la reunión"
      >
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button
            className="vc-chat-close"
            onClick={() => setShowChat(false)}
            aria-label="Cerrar chat"
          >
            ×
          </button>
        </header>

        <div className="vc-chat-messages">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`vc-chat-message ${m.author === 'Tú' ? 'me' : ''}`}
            >
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
          <button type="submit">Enviar</button>
        </form>
      </aside>
    </main>
  );

}