import React from 'react';

interface CallControlsProps {
  cameraOn: boolean;
  micOn: boolean;
  hasNewMessages: boolean;
  showChat: boolean;
  showCode: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleChat: () => void;
  onToggleCode: () => void;
  onHangup: () => void | Promise<void>;
}

export const CallControls: React.FC<CallControlsProps> = ({
  cameraOn,
  micOn,
  hasNewMessages,
  showChat,
  showCode,
  onToggleCamera,
  onToggleMic,
  onToggleChat,
  onToggleCode,
  onHangup,
}) => (
  <div className="vc-controls" role="region" aria-label="Controles de llamada">
    <button
      className={`vc-control ${cameraOn ? 'on' : 'vc-control-muted'}`}
      title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
      aria-pressed={!cameraOn}
      onClick={onToggleCamera}
    >
      {cameraOn ? '📷' : '🚫'}
    </button>

    <button
      className={`vc-control ${micOn ? 'on' : 'vc-control-muted'}`}
      title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
      aria-pressed={!micOn}
      onClick={onToggleMic}
    >
      {micOn ? '🎙️' : '🔇'}
    </button>

    <button
      className={`vc-control vc-control-chat ${showChat ? 'active' : ''}`}
      title="Chat"
      aria-pressed={showChat}
      onClick={onToggleChat}
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
      onClick={onToggleCode}
    >
      🔗
    </button>

    <button
      className="vc-control vc-control-hangup"
      title="Colgar"
      onClick={onHangup}
    >
      📞
    </button>
  </div>
);
