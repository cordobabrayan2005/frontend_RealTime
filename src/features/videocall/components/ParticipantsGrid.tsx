import React from 'react';
import { Participant } from '../types';
import { ParticipantVideo } from './ParticipantVideo';

interface ParticipantsGridProps {
  participants: Participant[];
  localVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  remoteVideoRefs: React.MutableRefObject<Map<string, MediaStream>>;
  remoteStreamsVersion: number;
}

const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2);

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
