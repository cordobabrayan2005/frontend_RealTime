import { useRef, useState, useEffect } from 'react';

export function useMedia() {
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);

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
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            }
          });

          console.log('[FRONT] ✅ Stream de video obtenido', {
            tracks: stream.getVideoTracks().length,
            trackEnabled: stream.getVideoTracks()[0]?.enabled
          });

          videoStreamRef.current = stream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(err =>
              console.error('[FRONT] Error al reproducir video local:', err)
            );
          }

          // Actualizar todas las llamadas de video existentes con el nuevo stream
          // Esto se manejará en Videocall.tsx mediante sendVideoStateToPeers
        } catch (err: any) {
          console.error('[FRONT] ❌ Error obteniendo video:', err.name, err.message);
          setCameraOn(false);
        }
      } else if (!cameraOn && videoStreamRef.current) {
        console.log('[FRONT] Apagando cámara, deteniendo stream...');
        // No detener los tracks, solo deshabilitarlos
        videoStreamRef.current.getTracks().forEach(track => {
          track.enabled = false;
        });

        // Mantener la referencia al stream para poder reactivarlo
        // No lo ponemos a null para poder reutilizarlo
      }
    }

    ensureVideo();
  }, [cameraOn]);

  // Función para reemplazar tracks en llamadas existentes
  const replaceVideoTrack = (newStream: MediaStream | null) => {
    // Esta función será llamada desde Videocall.tsx cuando cambie el estado de la cámara
    console.log('[FRONT] Reemplazando video track en llamadas existentes');
  };

  // Limpiar al desmontar
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
