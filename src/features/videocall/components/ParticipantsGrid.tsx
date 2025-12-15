import React from 'react';
import { Participant } from '../types';
import { ParticipantVideo } from './ParticipantVideo';

/**
 * Props for the ParticipantsGrid component.
 *
 * @interface ParticipantsGridProps
 * @property {Participant[]} participants - List of participants in the call.
 * @property {React.MutableRefObject<HTMLVideoElement | null>} localVideoRef - Ref for the local video element.
 * @property {boolean} cameraOn - Indicates whether the local camera is enabled.
 * @property {React.MutableRefObject<Map<string, MediaStream>>} remoteVideoRefs - Map of participant IDs to their remote MediaStreams.
 * @property {number} remoteStreamsVersion - Version number used to trigger re-renders when remote streams change.
 */
interface ParticipantsGridProps {
  participants: Participant[];
  localVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  remoteVideoRefs: React.MutableRefObject<Map<string, MediaStream>>;
  remoteStreamsVersion: number;
}

/**
 * Utility function to generate initials from a participant's name.
 *
 * @function getInitials
 * @param {string} name - Full name of the participant.
 * @returns {string} Initials (up to 2 characters).
 *
 * @example
 * getInitials("John Doe"); // "JD"
 */
const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2);

/**
 * ParticipantsGrid component.
 *
 * Renders a grid of participant tiles for a video call. Each tile displays:
 * - Local participant: either the live video (if camera is on) or a placeholder avatar.
 * - Remote participant: either their video stream (if available) or initials avatar.
 *
 * Accessibility features:
 * - `aria-live="polite"` for dynamic updates.
 * - Each participant tile is labeled with their name.
 *
 * @component
 * @param {ParticipantsGridProps} props - Component props.
 * @returns {JSX.Element} A grid of participant tiles.
 *
 * @example
 * <ParticipantsGrid
 *   participants={[
 *     { id: '1', name: 'Alice', isLocal: true },
 *     { id: '2', name: 'Bob', isLocal: false }
 *   ]}
 *   localVideoRef={localVideoRef}
 *   cameraOn={true}
 *   remoteVideoRefs={remoteVideoRefs}
 *   remoteStreamsVersion={1}
 * />
 */
export const ParticipantsGrid: React.FC<ParticipantsGridProps> = ({
  participants,
  localVideoRef,
  cameraOn,
  remoteVideoRefs,
  remoteStreamsVersion,
}) => (
  <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
    {participants.map((participant) => (
      <div key={participant.id} className="vc-tile" role="group" aria-label={participant.name}>
        <div className="vc-card">
          {participant.isLocal ? (
            cameraOn ? (
              <video
                ref={(element) => {
                  localVideoRef.current = element;
                }}
                className="vc-local-video"
                muted
                playsInline
              />
            ) : (
              <div className="vc-avatar">Tú</div>
            )
          ) : remoteVideoRefs.current?.has(participant.id) ? (
            <ParticipantVideo
              participantId={participant.id}
              remoteVideoRefs={remoteVideoRefs}
              version={remoteStreamsVersion}
            />
          ) : (
            <div className="vc-avatar">{getInitials(participant.name)}</div>
          )}
        </div>
        <div className="vc-name">{participant.name}</div>
      </div>
    ))}
  </section>
);
