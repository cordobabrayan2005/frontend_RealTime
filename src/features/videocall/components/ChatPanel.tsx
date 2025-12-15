import React from 'react';
import { ChatMessage } from '../types';

/**
 * Props for the ChatPanel component.
 *
 * @interface ChatPanelProps
 * @property {boolean} isOpen - Whether the chat panel is currently visible.
 * @property {ChatMessage[]} messages - Array of chat messages to display.
 * @property {string} chatInput - Current value of the chat input field.
 * @property {(value: string) => void} onChangeInput - Callback to update the chat input value.
 * @property {(event?: React.FormEvent) => void} onSendMessage - Callback to send a new message.
 * @property {() => void} onClose - Callback to close the chat panel.
 */
interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  chatInput: string;
  onChangeInput: (value: string) => void;
  onSendMessage: (event?: React.FormEvent) => void;
  onClose: () => void;
}

/**
 * ChatPanel component.
 *
 * Renders a side panel for meeting chat. Includes:
 * - Overlay that closes the panel when clicked.
 * - Header with a close button.
 * - Scrollable list of chat messages.
 * - Input field and send button for composing new messages.
 *
 * Accessibility features:
 * - `role="dialog"` and `aria-label="Chat de la reunión"` for screen readers.
 * - `aria-hidden` to indicate visibility state.
 *
 * @component
 * @param {ChatPanelProps} props - Component props.
 * @returns {JSX.Element | null} A chat panel if open, otherwise `null`.
 *
 * @example
 * <ChatPanel
 *   isOpen={true}
 *   messages={[
 *     { id: '1', author: 'Alice', text: 'Hello!' },
 *     { id: '2', author: 'Tú', text: 'Hi Alice!' }
 *   ]}
 *   chatInput="Typing..."
 *   onChangeInput={(val) => console.log(val)}
 *   onSendMessage={(e) => { e?.preventDefault(); console.log("Message sent"); }}
 *   onClose={() => console.log("Chat closed")}
 * />
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  messages,
  chatInput,
  onChangeInput,
  onSendMessage,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="vc-chat-overlay" onClick={onClose} />

      <aside className={`vc-chat-panel ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} role="dialog" aria-label="Chat de la reunión">
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={onClose} aria-label="Cerrar chat">
            ×
          </button>
        </header>

        <div className="vc-chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`vc-chat-message ${message.author === 'Tú' ? 'me' : ''}`}>
              <div className="vc-chat-author">{message.author}</div>
              <div className="vc-chat-text">{message.text}</div>
            </div>
          ))}
        </div>

        <form className="vc-chat-input" onSubmit={onSendMessage}>
          <input value={chatInput} onChange={(event) => onChangeInput(event.target.value)} placeholder="Escribe un mensaje..." />
          <button type="submit">Enviar</button>
        </form>
      </aside>
    </>
  );
};
