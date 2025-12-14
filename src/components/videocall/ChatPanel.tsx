import React from 'react';
import { ChatMessage } from './types';

interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  chatInput: string;
  onChangeInput: (value: string) => void;
  onSendMessage: (event?: React.FormEvent) => void;
  onClose: () => void;
}

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
