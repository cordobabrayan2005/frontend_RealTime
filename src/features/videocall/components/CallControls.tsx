import React from 'react';

/**
 * Props for the CallControls component.
 *
 * @interface CallControlsProps
 * @property {boolean} cameraOn - Indicates whether the local camera is enabled.
 * @property {boolean} micOn - Indicates whether the local microphone is enabled.
 * @property {boolean} hasNewMessages - Whether there are unread chat messages.
 * @property {boolean} showChat - Whether the chat panel is currently visible.
 * @property {boolean} showCode - Whether the meeting code panel is currently visible.
 * @property {() => void} onToggleCamera - Callback to toggle the camera state.
 * @property {() => void} onToggleMic - Callback to toggle the microphone state.
 * @property {() => void} onToggleChat - Callback to toggle the chat panel.
 * @property {() => void} onToggleCode - Callback to toggle the meeting code panel.
 * @property {() => void | Promise<void>} onHangup - Callback to end the call.
 */
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

/**
 * CallControls component.
 *
 * Renders a set of interactive buttons for managing a video call:
 * - Toggle camera (on/off).
 * - Toggle microphone (mute/unmute).
 * - Toggle chat panel (with notification indicator for new messages).
 * - Toggle meeting code panel.
 * - Hang up the call.
 *
 * Accessibility features:
 * - `role="region"` and `aria-label="Controles de llamada"` for screen readers.
 * - `aria-pressed` attributes to indicate toggle states.
 *
 * @component
 * @param {CallControlsProps} props - Component props.
 * @returns {JSX.Element} A control bar with call management buttons.
 *
 * @example
 * <CallControls
 *   cameraOn={true}
 *   micOn={false}
 *   hasNewMessages={true}
 *   showChat={false}
 *   showCode={false}
 *   onToggleCamera={() => console.log("Camera toggled")}
 *   onToggleMic={() => console.log("Mic toggled")}
 *   onToggleChat={() => console.log("Chat toggled")}
 *   onToggleCode={() => console.log("Code toggled")}
 *   onHangup={() => console.log("Call ended")}
 * />
 */
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
