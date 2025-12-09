import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';  // To obtain token and username
import Peer from 'peerjs';

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const location = useLocation();
  const meetingId = (location.state as any)?.meetingId;  // Meeting ID from RealTime
  const { token, user } = useAuthStore();  // Obtain token and user (assuming user.name and user.id)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCreator, setIsCreator] = useState(false);  // If the user is the creator
  const [showCode, setShowCode] = useState(false);  // To show/hide the code modal
  const [meetingEnded, setMeetingEnded] = useState(false);  // If the meeting ended
  const [voiceSocket, setVoiceSocket] = useState<Socket | null>(null);  // Separate socket for voice
  const [peer, setPeer] = useState<Peer | null>(null);  // Peer.js instance for WebRTC
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const peerCallsRef = useRef<Map<string, any>>(new Map());  // Track active Peer calls

  // Start with a single participant (the current user). More participants can be simulated.
  /**
   * Participants list. Each participant has an { id: number, name: string } shape.
   * Starts with a single local participant.
   * @type {[{id:number,name:string}[], Function]}
   */
  const [participants, setParticipants] = useState(() => [{ id: user?.id || 'local', name: 'Tú', isLocal: true }]); // Local user always present

  /** Whether the local camera is enabled. */
  const [cameraOn, setCameraOn] = useState(false);

  /** Whether the local microphone is enabled. */
  const [micOn, setMicOn] = useState(true); // MODIFICADO: Mic activado por defecto

  /** Whether the chat panel is visible. */
  const [showChat, setShowChat] = useState(false);

  /** Current chat input value. */
  const [chatInput, setChatInput] = useState('');

  /** Add status for new message notifications */
  const [hasNewMessages, setHasNewMessages] = useState(false);

  /**
   * Chat messages list. Each message has { id: number, author: string, text: string }.
   * Initialized with a system welcome message.
   */
  const [messages, setMessages] = useState(() => [{ id: 1, author: 'Sistema', text: 'Bienvenido al chat de la reunión.' }]);

  const navigate = useNavigate();

  // refs for local media
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  /** Ref that holds the current MediaStream for local audio/video. */
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // URLs desde variables de entorno o defaults
  const CHAT_BACKEND_URL = import.meta.env.VITE_CHAT_BACKEND_URL || 'https://realtimechatbackend-87nm.onrender.com';
  const VOICE_BACKEND_URL = import.meta.env.VITE_VOICE_BACKEND_URL || 'https://realtimevoicebackend.onrender.com';
  const PEERJS_HOST = import.meta.env.VITE_PEERJS_HOST || 'realtimevoicebackend.onrender.com';
  const PEERJS_PATH = import.meta.env.VITE_PEERJS_PATH || '/peerjs';

  // ==================== PEDIR PERMISOS DE MICRÓFONO INMEDIATAMENTE ====================
  useEffect(() => {
    // Pedir permisos de micrófono inmediatamente al cargar el componente
    async function requestMicrophonePermission() {
      try {
        console.log('[FRONT] Solicitando permiso de micrófono...');

        // Solo pedir audio, no video (para no asustar al usuario)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false // No pedir cámara inicialmente
        });

        console.log('[FRONT] ✅ Permiso de micrófono concedido');

        // Cambiar: Mantener stream activo (para evitar pérdidas)
        mediaStreamRef.current = stream;

        // Agregar: Verificación de autoplay para reproducción (clave en proyectos funcionales)
        const testAudio = new Audio();
        testAudio.volume = 0; // Silenciar para test
        testAudio.play().then(() => {
          console.log('[FRONT] ✅ Autoplay permitido');
        }).catch(() => {
          console.warn('[FRONT] ⚠️ Autoplay bloqueado; requerirá interacción del usuario');
        });

        // El micrófono está activado por defecto
        setMicOn(true);

      } catch (err: any) {
        console.error('[FRONT] ❌ Error al obtener permiso de micrófono:', err);

        // Nuevo: Manejo específico para dispositivo no encontrado
        if (err.name === 'NotFoundError') {
          alert('No se encontró un dispositivo de micrófono. Verifica que tu dispositivo tenga audio habilitado y recarga la página.');
          console.warn('[FRONT] Micrófono no disponible - deteniendo intentos');
          setMicOn(false);
          return; // No intentar reconectar
        }

        if (err.name === 'NotAllowedError') {
          alert('Permiso denegado para micrófono. Haz clic en el ícono de candado y permite el acceso.');
        }

        setMicOn(false);
      }
    }

    // Solo pedir permisos si tenemos meetingId
    if (meetingId) {
      requestMicrophonePermission();
    }
  }, [meetingId]);

  // Connect to Socket.IO and get a meeting when mounting
  useEffect(() => {
    if (!meetingId || !token || !user) return;
    
    console.log('[FRONT] Inicializando videollamada para reunión:', meetingId);
    console.log('[FRONT] Configuración:', {
      chatBackend: CHAT_BACKEND_URL,
      voiceBackend: VOICE_BACKEND_URL,
      peerHost: PEERJS_HOST,
      peerPath: PEERJS_PATH
    });

    // 1. Socket de chat
    const newSocket = io(CHAT_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    // 2. Socket de voz
    const newVoiceSocket = io(VOICE_BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setVoiceSocket(newVoiceSocket);

    let connectionTimeout: NodeJS.Timeout;

    // 3. Peer.js - CONFIGURACIÓN CORREGIDA PARA RENDER
    console.log('[FRONT] Inicializando Peer.js para servidor en Render...');
    
    // CONFIGURACIÓN CORRECTA PARA RENDER:
    const newPeer = new Peer(user.id, {
      host: PEERJS_HOST,
      path: PEERJS_PATH,
      secure: true, // SIEMPRE HTTPS en Render
      port: 443, // IMPORTANTE: Render usa HTTPS en puerto 443
      debug: 1, // Reducir debug para menos logs
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    
    setPeer(newPeer);
    setPeerStatus('connecting');

    // Timeout de 20 segundos para conexión Peer.js
    connectionTimeout = setTimeout(() => {
      if (newPeer && !newPeer.disconnected) {
        console.log('[FRONT] ⏱️ Timeout de conexión Peer.js (20s)');
        setPeerStatus('error');
        
        // Intentar crear un nuevo Peer con ID diferente
        const newPeerWithTimeout = new Peer(`${user.id}_${Date.now()}`, {
          host: PEERJS_HOST,
          path: PEERJS_PATH,
          secure: true,
          port: 443,
          debug: 0,
          config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          }
        });
        
        setPeer(newPeerWithTimeout);
      }
    }, 20000);

    // Check if creator
    fetch(`${CHAT_BACKEND_URL}/api/meetings/${meetingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.meeting && data.meeting.creatorId === user.id) {
          setIsCreator(true);
        }
      })
      .catch(err => console.error('[FRONT] Error obteniendo reunión:', err));

    let hasJoined = false;

    // Chat socket events
    const handleConnect = () => {
      console.log('[FRONT] Socket conectado, uniéndose a reunión si no lo ha hecho');
      if (!hasJoined) {
        newSocket.emit('join-meeting', { meetingId, userId: user.id, name: user.name });
        hasJoined = true;
      }
    };
    newSocket.on('connect', handleConnect);

    newSocket.on('receive-message', (data: { author: string; text: string; timestamp: string }) => {
      console.log('[FRONT] Mensaje recibido:', data);
      setMessages((prev) => [...prev, { id: prev.length + 1, author: data.author, text: data.text }]);
      if (!showChat) setHasNewMessages(true);
    });

    newSocket.on('participants-list', (participantsList: { userId: string; name: string }[]) => {
      console.log('[FRONT] Lista de participantes recibida:', participantsList);
      setParticipants(participantsList.map(p => ({
        id: p.userId,
        name: p.userId === user.id ? 'Tú' : p.name,
        isLocal: p.userId === user.id
      })));
    });

    newSocket.on('meeting-ended', (message: string) => {
      console.log('[FRONT] Reunión terminada:', message);
      setMeetingEnded(true);
      alert(message);
      setTimeout(() => navigate('/realtime'), 3000);
    });

    newSocket.on('user-joined', (data: { userId: string; name: string }) => {
      console.log('[FRONT] Usuario unido:', data);
      setParticipants((prev) => {
        if (prev.some(p => p.id === data.userId) || prev.length >= 10) return prev;
        return [...prev, { id: data.userId, name: data.name, isLocal: false }];
      });
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      console.log('[FRONT] Usuario salió:', data);
      setParticipants((prev) => prev.filter(p => p.id !== data.userId));
    });

    newSocket.on('error', (msg: string) => {
      console.error('[FRONT] Error de socket:', msg);
      alert(`Error: ${msg}`);
    });

    // Voice socket events
    newVoiceSocket.on('connect', () => {
      console.log('[FRONT] Voice socket connected');
    });

    // Peer.js events
    newPeer.on('open', (id) => {
      clearTimeout(connectionTimeout);
      console.log('[FRONT] ✅ Peer.js conectado con ID:', id);
      setPeerStatus('connected');
      
      // Esperar 1 segundo antes de unirse a la sala
      setTimeout(() => {
        newVoiceSocket.emit('join-voice-room', { meetingId, peerId: user.id, userId: user.id });
      }, 1000);
    });

    newPeer.on('error', (err) => {
      console.error('[FRONT] ❌ Error de Peer.js:', err.type, err.message);

      // Si es error de WebSocket (código 1006)
      if (err.type === 'network' || err.type === 'disconnected' || err.message.includes('1006') || err.message.includes('Lost connection')) {
        console.log('[FRONT] 🔄 Error WebSocket detectado. Intentando solución...');
        setPeerStatus('error');

        // Esperar 5 segundos antes de reconectar
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            console.log('[FRONT] Reconectando Peer.js...');
            setPeerStatus('connecting');

            try {
              newPeer.reconnect();
            } catch (reconnectErr) {
              console.error('[FRONT] Error al reconectar:', reconnectErr);

              // Si falla, crear un nuevo Peer
              const newPeerInstance = new Peer(`${user.id}_${Date.now()}`, {
                host: PEERJS_HOST,
                path: PEERJS_PATH,
                secure: true,
                port: 443,
                debug: 0,
                config: {
                  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                }
              });

              setPeer(newPeerInstance);
            }
          }
        }, 5000); // Reducido de 10s
      }
    });

    // Voice socket events para señalización
    newVoiceSocket.on('voice-joined', (data: { peers: string[] }) => {
      console.log('[FRONT] Voice joined, connecting to peers:', data.peers);
      
      // Esperar un momento antes de conectar
      setTimeout(() => {
        // Connect to existing peers (si tenemos mic activado y stream)
        data.peers.forEach(peerId => {
          if (newPeer && micOn && mediaStreamRef.current) {
            initiateCall(newPeer, peerId);
          }
        });
      }, 1500);
    });

    newVoiceSocket.on('peer-joined', (peerId: string) => {
      console.log('[FRONT] Peer joined voice:', peerId);
      
      // Esperar antes de conectar
      setTimeout(() => {
        if (newPeer && micOn && mediaStreamRef.current) {
          initiateCall(newPeer, peerId);
        }
      }, 1500);
    });

    newVoiceSocket.on('peer-disconnected', (peerId: string) => {
      console.log('[FRONT] Peer disconnected:', peerId);
      const call = peerCallsRef.current.get(peerId);
      if (call) {
        call.close();
        peerCallsRef.current.delete(peerId);
      }
    });

    newVoiceSocket.on('voice-error', (msg: string) => {
      console.error('[FRONT] Voice error:', msg);
      alert(`Voice error: ${msg}`);
    });

    // Peer.js call handling
    newPeer.on('call', (call) => {
      if (!call.peer) {
        console.warn('[FRONT] Incoming call has no peer ID, ignoring');
        return;
      }
      console.log('[FRONT] Incoming call from:', call.peer);

      if (micOn && mediaStreamRef.current) {
        console.log('[FRONT] Answering call with stream');
        call.answer(mediaStreamRef.current);

        call.on('stream', (remoteStream) => {
          console.log('[FRONT] Received remote stream from:', call.peer);
          const audio = new Audio();
          audio.srcObject = remoteStream;

          // Nuevo: Manejo de autoplay (como en proyectos funcionales)
          audio.play().then(() => {
            console.log('[FRONT] ✅ Audio reproduciendo correctamente');
          }).catch(err => {
            console.error('[FRONT] ❌ Error de autoplay:', err);
            alert('Haz clic en la página para habilitar audio.');
            // Listener temporal para interacción
            const enable = () => {
              audio.play().catch(e => console.error('Aún fallando:', e));
              document.removeEventListener('click', enable);
            };
            document.addEventListener('click', enable, { once: true });
          });
        });

        call.on('close', () => {
          console.log('[FRONT] Call closed');
        });

        call.on('error', (err) => {
          console.error('[FRONT] Call error:', err);
        });

        peerCallsRef.current.set(call.peer, call);
      } else {
        console.log('[FRONT] Rejecting call - mic off or no stream');
        call.close();
      }
    });

    return () => {
      console.log('[FRONT] Cleanup: desconectando socket y el peer');
      clearTimeout(connectionTimeout);
      newSocket.off('connect', handleConnect);
      newSocket.disconnect();
      newVoiceSocket.disconnect();
      if (newPeer) newPeer.destroy();
    };
  }, [meetingId, token, user?.id]);

  // Función para iniciar llamadas
  const initiateCall = (peerInstance: Peer, peerId: string) => {
    if (!mediaStreamRef.current || peerId === user?.id) {
      console.log('[FRONT] No se puede llamar a:', peerId);
      return;
    }

    // Nuevo: Verificar tracks activos (como en proyectos funcionales)
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    if (!audioTracks.length || !audioTracks[0].enabled) {
      console.warn('[FRONT] No active audio tracks for calling peer:', peerId);
      return;
    }

    console.log('[FRONT] Calling peer:', peerId);

    try {
      const call = peerInstance.call(peerId, mediaStreamRef.current);

      call.on('stream', (remoteStream) => {
        console.log('[FRONT] Stream received from:', peerId);
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(err => {
          console.error('[FRONT] Error playing audio:', err);
          audio.muted = true;
          audio.play();
        });
      });

      call.on('close', () => {
        console.log('[FRONT] Call closed with:', peerId);
        peerCallsRef.current.delete(peerId);
      });

      call.on('error', (err) => {
        console.error('[FRONT] Call error with:', peerId, err);
        peerCallsRef.current.delete(peerId);
      });

      peerCallsRef.current.set(peerId, call);
    } catch (error) {
      console.error('[FRONT] Error initiating call:', error);
    }
  };

  /**
   * Toggle the chat panel visibility.
   * @returns {void}
   */
  function toggleChat() {
    setShowChat((s) => !s);
    if (!showChat) {  // If the chat opens, remove the notification.
      setHasNewMessages(false);
    }
  }

  /**
   * Toggle the code modal visibility.
   * @returns {void}
   */
  function toggleCode() {
    setShowCode((s) => !s);
  }

  /**
   * Copy the meeting code to clipboard.
   * @returns {void}
   */
  function copyCode() {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId).then(() => {
        alert('Código copiado al portapapeles');
      }).catch(err => {
        console.error('Error copiando código:', err);
        alert('Error copiando código');
      });
    }
  }

  /**
   * Send the current chat input as a message.
   * If an event is provided, prevents default form submission behavior.
   *
   * @param {React.FormEvent} [e] - Optional form event.
   * @returns {void}
   */
  function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket || meetingEnded) return;
    const authorName = user?.name || 'Tú';  // Usar nombre real
    socket.emit('send-message', { meetingId, message: text, author: authorName });
    setMessages((m) => [...m, { id: m.length + 1, author: 'Tú', text }]);  // Show 'You' to the sender
    setChatInput('');
  }

  // Manage media (video/audio) according to cameraOn and micOn
  useEffect(() => {
    let mounted = true;

    /**
     * Ensure the local media stream matches the desired camera/mic state.
     */
    async function ensureMedia() {
      try {
        const desiredVideo = !!cameraOn;
        const desiredAudio = !!micOn;
        const current = mediaStreamRef.current;

        // Si el micrófono está activado pero no tenemos stream, pedirlo
        if (desiredAudio && !current) {
          console.log('[FRONT] Obteniendo stream de audio...');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: desiredVideo, 
            audio: desiredAudio 
          });
          
          if (!mounted) { 
            stream.getTracks().forEach(t => t.stop()); 
            return; 
          }
          
          mediaStreamRef.current = stream;
          
          if (desiredVideo && localVideoRef.current && stream.getVideoTracks().length) {
            try { 
              localVideoRef.current.srcObject = stream; 
              await localVideoRef.current.play(); 
            } catch (e) { /* ignore */ }
          }
          
          return;
        }

        // Si tenemos stream, actualizar los tracks
        if (current) {
          const videoTrack = current.getVideoTracks()[0];
          const audioTrack = current.getAudioTracks()[0];
          
          if (videoTrack) {
            videoTrack.enabled = desiredVideo;
          }
          
          if (audioTrack) {
            audioTrack.enabled = desiredAudio;
          }
          
          // Si necesitamos video pero no tenemos track de video
          if (desiredVideo && !videoTrack) {
            const newStream = await navigator.mediaDevices.getUserMedia({ 
              video: true, 
              audio: desiredAudio 
            });
            
            if (!mounted) { 
              newStream.getTracks().forEach(t => t.stop()); 
              return; 
            }
            
            // Detener stream anterior y reemplazar
            current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = newStream;
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = newStream;
              localVideoRef.current.play().catch(console.error);
            }
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

    // Cuando el micrófono se activa/desactiva
    if (peer && voiceSocket && user && meetingId) {
      if (micOn && mediaStreamRef.current) {
        console.log('[FRONT] Mic activado, reconectando a sala de voz');
        // Re-emit join para reconectar
        voiceSocket.emit('join-voice-room', { meetingId, peerId: user.id, userId: user.id });
      } else {
        console.log('[FRONT] Mic desactivado, cerrando llamadas');
        // Cerrar todas las llamadas
        peerCallsRef.current.forEach(call => call.close());
        peerCallsRef.current.clear();
      }
    }

    return () => { mounted = false; };
  }, [cameraOn, micOn, peer, voiceSocket, meetingId, user]);

  // cleanup on unmount
  useEffect(() => {
    /**
     * Cleanup any active media tracks on component unmount.
     * @returns {void}
     */
    return () => {
      const s = mediaStreamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      if (socket) socket.disconnect();
      if (voiceSocket) voiceSocket.disconnect();
      if (peer) peer.destroy();
      peerCallsRef.current.forEach(call => call.close());
      peerCallsRef.current.clear();
    };
  }, [socket, voiceSocket, peer]);

  /**
   * Hang up the call: clears participants and chat, then navigates back to the realtime landing.
   * If the user is the creator, ends the meeting in the database and notifies others.
   * @returns {void}
   */
  async function hangup() {
    if (isCreator && meetingId && token) {
      try {
        const chatBackendUrl = CHAT_BACKEND_URL;
        await fetch(`${chatBackendUrl}/api/meetings/${meetingId}/end`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        // Notify everyone via Socket.IO
        socket?.emit('end-meeting', meetingId);
        console.log('Reunión finalizada por el creador');
      } catch (error) {
        console.error('Error finalizando reunión:', error);
      }
    }
    // Disconnect from voice room (new)
    if (user && voiceSocket) {
      voiceSocket.emit('leave-voice-room', { meetingId, peerId: user.id });
    }
    // reset state if desired
    setParticipants([]);
    setShowChat(false);
    // navigate back to realtime landing
    navigate('/realtime');
  }

  if (meetingEnded) {
    return (
      <main className="videocall-page" role="main" aria-label="Videollamada">
        <div className="vc-ended-message">
          <h2>La reunión ha terminado</h2>
          <p>Serás redirigido en unos segundos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="videocall-page" role="main" aria-label="Videollamada">
      <div className="vc-top-left-back" onClick={() => window.history.back()} aria-hidden>
        ←
      </div>

      <section className={`vc-grid ${participants.length === 1 ? 'single' : ''}`} aria-live="polite">
        {participants.map((p) => (
          <div key={p.id} className="vc-tile" role="group" aria-label={p.name}>
            <div className="vc-card">
              {p.isLocal ? (
                // Local participant: show local video if cameraOn
                cameraOn ? (
                  <video ref={localVideoRef} className="vc-local-video" muted playsInline />
                ) : (
                  <div className="vc-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
                )
              ) : (
                // Remote participants: always show avatar (no video for now)
                <div className="vc-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
              )}
            </div>
            <div className="vc-name">{p.name}</div>
          </div>
        ))}
      </section>

      <div className="vc-controls" role="region" aria-label="Controles de llamada">
        <button
          className={`vc-control ${cameraOn ? 'on' : 'vc-control-muted'}`}
          title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
          aria-pressed={!cameraOn}
          onClick={() => setCameraOn((s) => !s)}
        >
          {cameraOn ? '📷' : '🚫'}
        </button>

        <button
          className={`vc-control ${micOn ? 'on' : 'vc-control-muted'}`}
          title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          aria-pressed={!micOn}
          onClick={() => setMicOn((s) => !s)}
        >
          {micOn ? '🎙️' : '🔇'}
        </button>
        <button
          className={`vc-control vc-control-chat ${showChat ? 'active' : ''}`}
          title="Chat"
          aria-pressed={showChat}
          onClick={toggleChat}
        >
          💬
          {hasNewMessages && !showChat && <span className="vc-chat-notification">●</span>}  {/* Punto rojo */}
        </button>
        <button
          className={`vc-control vc-control-code ${showCode ? 'active' : ''}`}
          title="Código de reunión"
          aria-pressed={showCode}
          onClick={toggleCode}
        >
          🔗
        </button>
        {/* REMOVIDO: Botón de agregar participante */}
        <button className="vc-control vc-control-hangup" title="Colgar" onClick={hangup}>📞</button>
      </div>

      {/* Code modal (centered) */}
      {showCode && (
        <div className="vc-modal-overlay" onClick={() => setShowCode(false)}>
          <div className="vc-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="vc-modal-header">
              <strong>Código de reunión</strong>
              <button className="vc-modal-close" onClick={() => setShowCode(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="vc-modal-body">
              <p>Comparte este código para que otros se unan:</p>
              <div className="vc-code-display">
                <input type="text" value={meetingId || ''} readOnly />
                <button onClick={copyCode}>Copiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel (slides from right) */}
      {showChat && (
        <div className="vc-chat-overlay" onClick={() => setShowChat(false)} />
      )}

      <aside className={`vc-chat-panel ${showChat ? 'open' : ''}`} aria-hidden={!showChat} role="dialog" aria-label="Chat de la reunión">
        <header className="vc-chat-header">
          <strong>Chat de la reunión</strong>
          <button className="vc-chat-close" onClick={() => setShowChat(false)} aria-label="Cerrar chat">×</button>
        </header>

        <div className="vc-chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`vc-chat-message ${m.author === 'Tú' ? 'me' : ''}`}>
              <div className="vc-chat-author">{m.author}</div>
              <div className="vc-chat-text">{m.text}</div>
            </div>
          ))}
        </div>

        <form className="vc-chat-input" onSubmit={sendMessage}>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe un mensaje..." />
          <button type="submit">Enviar</button>
        </form>
      </aside>
    </main>
  );
}