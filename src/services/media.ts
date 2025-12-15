import { useRef, useState, useEffect } from 'react';

/**
 * Custom hook for managing audio and video media streams in a WebRTC context.
 *
 * Features:
 * - Requests microphone permission immediately on mount.
 * - Provides state and controls for toggling microphone and camera.
 * - Automatically attaches video stream to a local video element when camera is enabled.
 * - Cleans up audio and video tracks when disabled or on component unmount.
 *
 * @function useMedia
 * @returns {{
 *   audioStreamRef: React.MutableRefObject<MediaStream | null>,
 *   videoStreamRef: React.MutableRefObject<MediaStream | null>,
 *   localVideoRef: React.MutableRefObject<HTMLVideoElement | null>,
 *   cameraOn: boolean,
 *   setCameraOn: React.Dispatch<React.SetStateAction<boolean>>,
 *   micOn: boolean,
 *   setMicOn: React.Dispatch<React.SetStateAction<boolean>>
 * }} Object containing media stream references, state, and setters.
 *
 * @example
 * const {
 *   audioStreamRef,
 *   videoStreamRef,
 *   localVideoRef,
 *   cameraOn,
 *   setCameraOn,
 *   micOn,
 *   setMicOn,
 * } = useMedia();
 *
 * // Attach local video
 * <video ref={localVideoRef} autoPlay muted playsInline />
 *
 * // Toggle camera
 * <button onClick={() => setCameraOn(prev => !prev)}>
 *   {cameraOn ? "Turn Off Camera" : "Turn On Camera"}
 * </button>
 *
 * // Toggle microphone
 * <button onClick={() => setMicOn(prev => !prev)}>
 *   {micOn ? "Mute Mic" : "Unmute Mic"}
 * </button>
 */
export function useMedia() {
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);

  // Request microphone permission immediately
  useEffect(() => {
    async function requestMicrophonePermission() {
      try {
        console.log('[FRONT] Solicitando permiso de micrófono...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        console.log('[FRONT] ✅ Permiso de micrófono concedido');
        audioStreamRef.current = stream;
        setMicOn(true);

        const testAudio = new Audio();
        testAudio.volume = 0;
        testAudio.play().then(() => console.log('[FRONT] ✅ Autoplay audio permitido')).catch(() => console.warn('[FRONT] ⚠️ Autoplay bloqueado'));
      } catch (err: any) {
        console.error('[FRONT] ❌ Error obteniendo micrófono:', err);
        setMicOn(false);
      }
    }
    requestMicrophonePermission();
  }, []);

  // Handle audio mute/enable
  useEffect(() => {
    console.log('[FRONT] Muting audio:', !micOn);
    if (audioStreamRef.current) {
      audioStreamRef.current.getAudioTracks().forEach(track => {
        console.log('[FRONT] Track enabled before:', track.enabled);
        track.enabled = micOn;
        console.log('[FRONT] Track enabled after:', track.enabled);
      });
    }
  }, [micOn]);

  // Manage video streams separately
  useEffect(() => {
    async function ensureVideo() {
      if (cameraOn && !videoStreamRef.current) {
        try {
          console.log('[FRONT] Obteniendo stream de video...');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          });
          videoStreamRef.current = stream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(console.error);
          }
        } catch (err: any) {
          console.error('[FRONT] ❌ Error obteniendo video:', err);
          setCameraOn(false);
        }
      } else if (!cameraOn && videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
      }
    }
    ensureVideo();
  }, [cameraOn]);

  // Clean when disassembling
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
      videoStreamRef.current = null;
    };
  }, []);

  return {
    audioStreamRef,
    videoStreamRef,
    localVideoRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn
  };
}
