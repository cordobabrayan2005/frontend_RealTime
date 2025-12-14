import React from 'react';

interface MeetingCodeModalProps {
  meetingId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export const MeetingCodeModal: React.FC<MeetingCodeModalProps> = ({ meetingId, isOpen, onClose, onCopy }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="vc-modal-overlay" onClick={onClose}>
      <div className="vc-modal-content" onClick={(event) => event.stopPropagation()}>
        <header className="vc-modal-header">
          <strong>Código de reunión</strong>
          <button className="vc-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="vc-modal-body">
          <p>Comparte este código para que otros se unan:</p>
          <div className="vc-code-display">
            <input type="text" value={meetingId || ''} readOnly />
            <button onClick={onCopy}>Copiar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
