import { useCallback } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { usePeer as useFeaturePeer } from '../features/videocall/services/peer';

export function usePeer(
  meetingId: string | undefined,
  voiceSocket: any,
  videoSocket: any,
  audioStreamRef: RefObject<MediaStream | null>,
  videoStreamRef: RefObject<MediaStream | null>,
  cameraOn: boolean,
  micOn: boolean,
  remoteVideoRefs: MutableRefObject<Map<string, MediaStream>>,
  bumpRemoteStreamsVersion: () => void,
) {
  const {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateVoiceCall,
    initiateVideoCall,
    sendMuteToPeers,
    syncVideoTrack,
  } = useFeaturePeer(
    meetingId,
    voiceSocket,
    videoSocket,
    audioStreamRef,
    videoStreamRef,
    cameraOn,
    micOn,
    remoteVideoRefs,
    bumpRemoteStreamsVersion,
  );

  const initiateCall = useCallback((peerId: string) => {
    if (peerId.endsWith('_voice')) {
      initiateVoiceCall(peerId);
      return;
    }
    if (peerId.endsWith('_video')) {
      initiateVideoCall(peerId);
      return;
    }
    console.warn('[FRONT] Peer desconocido:', peerId);
  }, [initiateVoiceCall, initiateVideoCall]);

  return {
    peerVoice,
    peerVideo,
    peerStatus,
    peerCallsRef,
    initiateCall,
    sendMuteToPeers,
    syncVideoTrack,
  };
}