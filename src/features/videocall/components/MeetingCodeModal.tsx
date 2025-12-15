import React from 'react';

/**
 * Props for the MeetingCodeModal component.
 *
 * @interface MeetingCodeModalProps
 * @property {string} [meetingId] - Optional meeting identifier to display in the modal.
 * @property {boolean} isOpen - Whether the modal is currently visible.
 * @property {() => void} onClose - Callback to close the modal.
 * @property {() => void} onCopy - Callback to copy the meeting code to the clipboard.
 */
interface MeetingCodeModalProps {
  meetingId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
}

/**
 * MeetingCodeModal component.
 *
 * Displays a modal dialog containing the meeting code. Includes:
 * - Overlay that closes the modal when clicked.
 * - Header with a close button.
 * - Body with the meeting code in a read-only input field.
 * - Copy button to trigger the `onCopy` callback.
 *
 * Accessibility features:
 * - `aria-label="Cerrar"` for the close button.
 * - Overlay click handling to close the modal.
 *
 * @component
 * @param {MeetingCodeModalProps} props - Component props.
 * @returns {JSX.Element | null} A modal with the meeting code if open, otherwise `null`.
 *
 * @example
 * <MeetingCodeModal
 *   meetingId="ABC123"
 *   isOpen={true}
 *   onClose={() => console.log("Modal closed")}
 *   onCopy={() => console.log("Code copied")}
 * />
 */
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
