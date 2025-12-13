import React, { useEffect, useRef } from 'react';

interface ParticipantVideoProps {
  participantId: string;
  remoteVideoRefs: React.MutableRefObject<Map<string, MediaStream>>;
}

export const ParticipantVideo: React.FC<ParticipantVideoProps> = ({ participantId, remoteVideoRefs }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stream = remoteVideoRefs.current?.get(participantId);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [participantId, remoteVideoRefs]);

  return (
    <video ref={videoRef} className="vc-remote-video" playsInline />
  );
};
