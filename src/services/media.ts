import { useRef, useState, useEffect } from 'react';

export function useMedia() {
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoReadyVersion, setVideoReadyVersion] = useState(0);

  // Pedir permisos de micrófono inmediatamente
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

  // Manejar mute/enable de audio
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

  // Manejar stream de video por separado
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
          setVideoReadyVersion((prev) => prev + 1);
        } catch (err: any) {
          console.error('[FRONT] ❌ Error obteniendo video:', err);
          setCameraOn(false);
        }
      } else if (!cameraOn && videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
        setVideoReadyVersion((prev) => prev + 1);
      }
    }
    ensureVideo();
  }, [cameraOn]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
      videoStreamRef.current = null;
      setVideoReadyVersion((prev) => prev + 1);
    };
  }, []);

  return {
    audioStreamRef,
    videoStreamRef,
    localVideoRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn,
    videoReadyVersion
  };
}
