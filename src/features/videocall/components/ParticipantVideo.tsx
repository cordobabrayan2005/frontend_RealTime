import React, { useEffect, useRef } from 'react';

/**
 * Props for the ParticipantVideo component.
 *
 * @interface ParticipantVideoProps
 * @property {string} participantId - Unique identifier of the participant whose video stream will be rendered.
 * @property {React.MutableRefObject<Map<string, MediaStream>>} remoteVideoRefs - Map of participant IDs to their remote MediaStreams.
 * @property {number} version - Version number used to trigger re-renders when remote streams change.
 */
interface ParticipantVideoProps {
  participantId: string;
  remoteVideoRefs: React.MutableRefObject<Map<string, MediaStream>>;
  version: number;
}

/**
 * ParticipantVideo component.
 *
 * Renders a video element for a remote participant in a call.
 * - Retrieves the participant's MediaStream from `remoteVideoRefs`.
 * - Assigns the stream to the video element's `srcObject`.
 * - Automatically plays the video when available.
 *
 * Accessibility:
 * - Uses `playsInline` to ensure proper playback on mobile devices.
 *
 * @component
 * @param {ParticipantVideoProps} props - Component props.
 * @returns {JSX.Element} A video element displaying the participant's stream.
 *
 * @example
 * <ParticipantVideo
 *   participantId="user123"
 *   remoteVideoRefs={remoteVideoRefs}
 *   version={1}
 * />
 */
export const ParticipantVideo: React.FC<ParticipantVideoProps> = ({ participantId, remoteVideoRefs, version }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stream = remoteVideoRefs.current?.get(participantId);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [participantId, remoteVideoRefs, version]);

  return (
    <video ref={videoRef} className="vc-remote-video" playsInline />
  );
};
