import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useVideoCall } from "../hooks/useVideoCall";

interface ChatMessage {
  id: number;
  author: string;
  text: string;
}

interface ParticipantTile {
  key: string;
  name: string;
  isLocal: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  stream?: MediaStream;
}

interface RemoteVideoProps {
  participant: ParticipantTile;
}

function RemoteVideo({ participant }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current
        .play()
        .catch((err) => console.error("[RemoteVideo] Cannot play stream", err));
    }
  }, [participant.stream]);

  return (
    <video
      ref={videoRef}
      className="vc-remote-video"
      playsInline
      muted={false}
      style={{ display: participant.isVideoEnabled ? "block" : "none" }}
    />
  );
}

const CHAT_BACKEND_FALLBACK = "https://realtimechatbackend-87nm.onrender.com";

export default function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const meetingId = (location.state as any)?.meetingId as string | undefined;
  const { user, token } = useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, author: "Sistema", text: "Bienvenido al chat de la reunión." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [meetingError, setMeetingError] = useState("");
  const [chatParticipantCount, setChatParticipantCount] = useState<number | null>(
    null
  );
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [chatConnected, setChatConnected] = useState(false);

  const chatSocketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const showChatRef = useRef(showChat);

  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  const chatBackendUrl = useMemo(() => {
    return (
      (import.meta.env.VITE_CHAT_BACKEND_URL as string | undefined) ||
      CHAT_BACKEND_FALLBACK
    );
  }, []);

  const {
    participants,
    localStream,
    localVideoRef,
    isAudioEnabled,
    isVideoEnabled,
    isConnected: avConnected,
    error: avError,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  } = useVideoCall(
    meetingId || "",
    user?.id || "",
    user?.name || "Usuario"
  );

  useEffect(() => {
    if (token) {
      localStorage.setItem("authToken", token);
    }
  }, [token]);

  const participantTiles = useMemo<ParticipantTile[]>(() => {
    const remoteParticipants = Array.from(participants.values()).map(
      (participant) => ({
        key: participant.socketId,
        name: participant.displayName,
        isLocal: false,
        isAudioEnabled: participant.isAudioEnabled,
        isVideoEnabled: participant.isVideoEnabled,
        stream: participant.stream,
      })
    );

    if (!user) {
      return remoteParticipants;
    }

    return [
      {
        key: user.id || "local",
        name: user.name || "Tú",
        isLocal: true,
        isAudioEnabled,
        isVideoEnabled,
        stream: localStream || undefined,
      },
      ...remoteParticipants,
    ];
  }, [participants, user, isAudioEnabled, isVideoEnabled, localStream]);

  const participantCount = Math.max(
    chatParticipantCount ?? 0,
    participantTiles.length
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let isActive = true;

    const validateMeeting = async () => {
      if (!meetingId || !user) {
        navigate("/realtime");
        return;
      }

      try {
        setLoadingMeeting(true);
        setMeetingError("");

        const response = await fetch(
          `${chatBackendUrl}/api/meetings/${meetingId}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : undefined,
          }
        );

        if (!response.ok) {
          throw new Error("Código no válido o reunión inactiva");
        }

        const data = await response.json();

        if (!data?.meeting || data.meeting.status !== "active") {
          throw new Error("Esta reunión ya no está activa");
        }

        if (isActive) {
          setMaxParticipants(data.meeting.maxParticipants ?? null);
          setLoadingMeeting(false);
          joinRoom();
          connectChat();
        }
      } catch (err: any) {
        console.error("[VideoCall] Meeting validation failed", err);
        if (!isActive) return;
        setMeetingError(err?.message || "Error validando la reunión");
        setLoadingMeeting(false);
        setTimeout(() => navigate("/realtime"), 2000);
      }
    };

    const connectChat = () => {
      if (!token || !meetingId || !user) {
        return;
      }

      const socket = io(chatBackendUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      chatSocketRef.current = socket;

      const handleConnect = () => {
        socket.emit("join-meeting", {
          meetingId,
          userId: user.id,
          name: user.name,
        });
        setChatConnected(true);
      };

      const handleReceiveMessage = (data: {
        author: string;
        text: string;
        timestamp?: string;
      }) => {
        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, author: data.author, text: data.text },
        ]);
        if (!showChatRef.current) {
          setHasNewMessages(true);
        }
      };

      const handleParticipantsList = (
        list: Array<{ userId: string; name: string }>
      ) => {
        setChatParticipantCount(list.length);
      };

      const handleUserJoined = (data: { participantCount?: number }) => {
        if (typeof data?.participantCount === "number") {
          setChatParticipantCount(data.participantCount);
        }
      };

      const handleUserLeft = (data: { participantCount?: number }) => {
        if (typeof data?.participantCount === "number") {
          setChatParticipantCount(data.participantCount);
        }
      };

      const handleMeetingEnded = (message: string) => {
        setMeetingEnded(true);
        setModalMessage(message || "La reunión ha finalizado");
        setModalVisible(true);
        setTimeout(() => navigate("/realtime"), 2000);
      };

      const handleSocketError = (msg: string) => {
        setModalMessage(`Error: ${msg}`);
        setModalVisible(true);
      };

      socket.on("connect", handleConnect);
      socket.on("receive-message", handleReceiveMessage);
      socket.on("participants-list", handleParticipantsList);
      socket.on("user-joined", handleUserJoined);
      socket.on("user-left", handleUserLeft);
      socket.on("meeting-ended", handleMeetingEnded);
      socket.on("error", handleSocketError);

      socket.on("disconnect", () => setChatConnected(false));

      const cleanup = () => {
        socket.off("connect", handleConnect);
        socket.off("receive-message", handleReceiveMessage);
        socket.off("participants-list", handleParticipantsList);
        socket.off("user-joined", handleUserJoined);
        socket.off("user-left", handleUserLeft);
        socket.off("meeting-ended", handleMeetingEnded);
        socket.off("error", handleSocketError);
        socket.disconnect();
      };

      if (!isActive) {
        cleanup();
      }
    };

    validateMeeting();

    return () => {
      isActive = false;
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      leaveRoom();
    };
  }, [
    meetingId,
    user,
    token,
    chatBackendUrl,
    joinRoom,
    leaveRoom,
    navigate,
  ]);

  const toggleChatPanel = () => {
    setShowChat((prev) => {
      if (!prev) {
        setHasNewMessages(false);
      }
      return !prev;
    });
  };

  const toggleCodeModal = () => setShowCode((prev) => !prev);

  const copyCode = () => {
    if (!meetingId) return;
    navigator.clipboard
      .writeText(meetingId)
      .then(() => {
        setModalMessage("Código copiado al portapapeles");
        setModalVisible(true);
        setTimeout(() => setModalVisible(false), 1500);
      })
      .catch(() => {
        setModalMessage("Error copiando código");
        setModalVisible(true);
        setTimeout(() => setModalVisible(false), 1500);
      });
  };

  const sendChatMessage = (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    const text = chatInput.trim();
    if (!text || meetingEnded) {
      return;
    }

    const socket = chatSocketRef.current;
    if (!socket) {
      return;
    }

    const authorName = user?.name || "Tú";
    socket.emit("send-message", {
      meetingId,
      message: text,
      author: authorName,
    });

    setMessages((prev) => [...prev, { id: prev.length + 1, author: "Tú", text }]);
    setChatInput("");
  };

  const handleEndCall = () => {
    chatSocketRef.current?.disconnect();
    chatSocketRef.current = null;
    leaveRoom();
    navigate("/realtime");
  };

  if (loadingMeeting) {
    return (
      <main className="videocall-page">
        <div className="vc-ended-message">
          <h2>Validando reunión...</h2>
        </div>
      </main>
    );
  }

  if (meetingError || avError) {
    return (
      <main className="videocall-page">
        <div className="vc-ended-message">
          <h2>{meetingError || avError}</h2>
        </div>
      </main>
    );
  }

  if (meetingEnded) {
    return (
      <main className="videocall-page">
        <div className="vc-ended-message">
          <h2>{modalMessage || "La reunión ha terminado"}</h2>
          <p>Serás redirigido en unos segundos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="videocall-page" role="main" aria-label="Videollamada">
      {modalVisible && (
        <div className="rt-toast show" role="status" aria-live="polite">
          {modalMessage}
        </div>
      )}

      <div className="vc-top-left-back" onClick={() => navigate(-1)} aria-hidden>
        ←
      </div>

      <header className="vc-header">
        <div>
          <span>Sala: {meetingId}</span>
        </div>
        <div className="vc-status">
          <span>
            Participantes: {participantCount}
            {maxParticipants ? `/${maxParticipants}` : ""}
          </span>
          <span className={chatConnected && avConnected ? "vc-status-ok" : "vc-status-warn"}>
            {chatConnected && avConnected ? "🟢 Conectado" : "🔴 Conectando..."}
          </span>
        </div>
      </header>

      <section
        className={`vc-grid ${participantTiles.length === 1 ? "single" : ""}`}
        aria-live="polite"
      >
        {participantTiles.map((participant) => (
          <div key={participant.key} className="vc-tile" role="group" aria-label={participant.name}>
            <div className="vc-card">
              {participant.isLocal ? (
                participant.isVideoEnabled ? (
                  <video
                    ref={localVideoRef}
                    className="vc-local-video"
                    muted
                    playsInline
                    style={{ display: participant.isVideoEnabled ? "block" : "none" }}
                  />
                ) : (
                  <div className="vc-avatar">Tú</div>
                )
              ) : participant.stream && participant.isVideoEnabled ? (
                <RemoteVideo participant={participant} />
              ) : (
                <div className="vc-avatar">
                  {participant.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
              )}
            </div>
            <div className="vc-name">
              {participant.name}
              {!participant.isAudioEnabled && " 🔇"}
              {!participant.isVideoEnabled && " 🎥"}
            </div>
          </div>
        ))}

        {participantTiles.length === 1 && (
          <div className="vc-placeholder">Esperando participantes...</div>
        )}
      </section>

      <div className="vc-controls" role="region" aria-label="Controles de llamada">
        <button
          className={`vc-control ${isVideoEnabled ? "on" : "vc-control-muted"}`}
          title={isVideoEnabled ? "Apagar cámara" : "Encender cámara"}
          aria-pressed={!isVideoEnabled}
          onClick={toggleVideo}
        >
          {isVideoEnabled ? "📷" : "🚫"}
        </button>

        <button
          className={`vc-control ${isAudioEnabled ? "on" : "vc-control-muted"}`}
          title={isAudioEnabled ? "Silenciar micrófono" : "Activar micrófono"}
          aria-pressed={!isAudioEnabled}
          onClick={toggleAudio}
        >
          {isAudioEnabled ? "🎙️" : "🔇"}
        </button>

        <button
          className={`vc-control vc-control-chat ${showChat ? "active" : ""}`}
          title="Chat"
          aria-pressed={showChat}
          onClick={toggleChatPanel}
        >
          💬
          {hasNewMessages && !showChat && <span className="vc-chat-notification">●</span>}
        </button>

        <button
          className={`vc-control vc-control-code ${showCode ? "active" : ""}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCodeModal}
        >
          🔗
        </button>

        <button
          className="vc-control vc-control-hangup"
          title="Colgar"
          onClick={handleEndCall}
        >
          📞
        </button>
      </div>

      {showCode && (
        <div className="vc-modal-overlay" onClick={toggleCodeModal}>
          <div className="vc-modal-content" onClick={(event) => event.stopPropagation()}>
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button className="vc-modal-close" onClick={toggleCodeModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="vc-modal-body">
              <p>Comparte este código para que otros se unan:</p>
              <div className="vc-code-display">
                <input type="text" value={meetingId || ""} readOnly />
                <button onClick={copyCode}>Copiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChat && <div className="vc-chat-overlay" onClick={toggleChatPanel} />}

      <aside
        className={`vc-chat-panel ${showChat ? "open" : ""}`}
        aria-hidden={!showChat}
        role="dialog"
        aria-label="Chat de la reunión"
      >
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={toggleChatPanel} aria-label="Cerrar chat">
            ×
          </button>
        </header>

        <div className="vc-chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`vc-chat-message ${message.author === "Tú" ? "me" : ""}`}
            >
              <div className="vc-chat-author">{message.author}</div>
              <div className="vc-chat-text">{message.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="vc-chat-input" onSubmit={sendChatMessage}>
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Escribe un mensaje..."
          />
          <button type="submit">Enviar</button>
        </form>
      </aside>
    </main>
  );
}