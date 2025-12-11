import { useRef, useState, useEffect } from 'react';

/**
 * Hook para manejar medios (audio/video) en videollamadas
 */
export function useMedia() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);

  /**
   * Pedir permisos de micrófono inmediatamente al cargar el componente
   */
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
        mediaStreamRef.current = stream;

        const testAudio = new Audio();
        testAudio.volume = 0;
        testAudio.play().then(() => {
          console.log('[FRONT] ✅ Autoplay permitido');
        }).catch(() => {
          console.warn('[FRONT] ⚠️ Autoplay bloqueado; requerirá interacción del usuario');
        });

        setMicOn(true);

      } catch (err: any) {
        console.error('[FRONT] ❌ Error al obtener permiso de micrófono:', err);

        if (err.name === 'NotFoundError') {
          alert('No se encontró un dispositivo de micrófono. Verifica que tu dispositivo tenga audio habilitado y recarga la página.');
          setMicOn(false);
          return;
        }

        if (err.name === 'NotAllowedError') {
          alert('Permiso denegado para micrófono. Haz clic en el ícono de candado y permite el acceso.');
        }

        setMicOn(false);
      }
    }

    requestMicrophonePermission();
  }, []);

  async function requestMediaPermission() {  // Cambiado de requestMicrophonePermission
    try {
      console.log('[FRONT] Solicitando permisos de audio y video...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: true  // Agregado para video
      });

      console.log('[FRONT] ✅ Permisos concedidos');
      mediaStreamRef.current = stream;

      // Test de audio (igual)
      const testAudio = new Audio();
      testAudio.volume = 0;
      testAudio.play().then(() => console.log('[FRONT] ✅ Autoplay audio permitido')).catch(() => console.warn('[FRONT] ⚠️ Autoplay bloqueado'));

      setMicOn(true);
      setCameraOn(true);  // Nuevo

    } catch (err: any) {
      console.error('[FRONT] ❌ Error obteniendo permisos:', err);
      // ... (manejo de errores igual, pero agregar para video)
      setMicOn(false);
      setCameraOn(false);
    }
  }

  /**
   * Asegurar que el stream de medios coincida con el estado deseado de cámara/micrófono
   */
  useEffect(() => {
    let mounted = true;

    async function ensureMedia() {
      try {
        const desiredVideo = !!cameraOn;
        const desiredAudio = !!micOn;
        const current = mediaStreamRef.current;

        if (current) {
          // Solo ajustar tracks existentes, no recrear stream
          const videoTrack = current.getVideoTracks()[0];
          const audioTrack = current.getAudioTracks()[0];

          if (videoTrack) videoTrack.enabled = desiredVideo;
          if (audioTrack) audioTrack.enabled = desiredAudio;

          // Si se activa video pero no hay track, obtener uno nuevo
          if (desiredVideo && !videoTrack) {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: desiredAudio });
            if (!mounted) {
              newStream.getTracks().forEach(t => t.stop());
              return;
            }
            current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = newStream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = newStream;
              localVideoRef.current.play().catch(console.error);
            }
          }
        } else if (desiredAudio) {
          // Solo obtener stream si no hay ninguno y se necesita audio
          const stream = await navigator.mediaDevices.getUserMedia({ video: desiredVideo, audio: desiredAudio });
          if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          if (desiredVideo && localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(console.error);
          }
        }
      } catch (err: any) {
        console.error('[FRONT] Error en getUserMedia:', err);
        if (err.name === 'NotAllowedError') {
          alert('Permiso denegado para micrófono/cámara. Para usar la llamada de voz:\n\n1. Haz clic en el ícono de candado 🔒\n2. Busca "Micrófono" o "Cámara"\n3. Selecciona "Permitir"\n4. Recarga la página');
        }
        setCameraOn(false);
        setMicOn(false);
      }
    }

    ensureMedia();

    return () => { mounted = false; };
  }, [cameraOn, micOn]);

  /**
   * Limpiar tracks de medios al desmontar
   */
  useEffect(() => {
    return () => {
      const s = mediaStreamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  return {
    localVideoRef,
    mediaStreamRef,
    cameraOn,
    setCameraOn,
    micOn,
    setMicOn
  };
}