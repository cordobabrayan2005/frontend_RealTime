import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from '../stores/authStore';  // Corregido: ../stores/authStore
import { api } from "../services/api";  // Corregido: ../services/api

/**
 * RealTime page component.
 *
 * Provides actions to create a new meeting or join an existing one by code.
 * Removes the "login-page" body class on mount.
 *
 * @returns {JSX.Element} The RealTime landing page.
 */
export default function RealTime() {
  useEffect(() => {
    document.body.classList.remove("login-page");
  }, []);

  /** Whether the "join by code" input is visible. */
  const [showCodeInput, setShowCodeInput] = useState(false);
  /** Current room code typed by the user. */
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [flash, setFlash] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const { token } = useAuthStore();  // Obtener token JWT

  // Read welcome flash message from navigation state (once)
  useEffect(() => {
    const state = location.state as any;
    if (state?.flash) {
      setFlash(state.flash);
      // Clear state so it doesn't persist on back/forward
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Toggle visibility of the room code input.
   *
   * @returns {void}
   */
  function handleToggleCode() {
    setShowCodeInput((s) => !s);
  }

  /**
   * Create a new meeting by calling the chat backend API.
   *
   * @returns {Promise<void>}
   */
  async function handleCreateMeeting() {
    if (!token) {
      alert("Debes iniciar sesión para crear una reunión.");
      return;
    }
    try {
      const chatBackendUrl = 'https://realtimechatbackend-87nm.onrender.com';  // URL de Render desplegado
      const response = await fetch(`${chatBackendUrl}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Error creando reunión');
      const data = await response.json();
      const meetingId = data.meeting.id;
      // Show the sharing code
      alert(`Reunión creada. Comparte este código: ${meetingId}`);
      // Navigate to video call using the meeting ID
      navigate('/videocall', { state: { meetingId } });
    } catch (error: any) {
      console.error('Error creando reunión:', error);
      alert('Error creando reunión. Inténtalo de nuevo.');
    }
  }

  /**
   * Attempt to join a meeting using the current roomCode.
   *
   * Validates the code with the backend and navigates if valid.
   *
   * @returns {Promise<void>}
   */
  async function handleJoinWithCode() {
    if (!roomCode.trim()) {
      alert("Por favor ingresa un código de reunión.");
      return;
    }
    if (!token) {
      alert("Debes iniciar sesión para unirte a una reunión.");
      return;
    }
    try {
      const chatBackendUrl = 'https://realtimechatbackend-87nm.onrender.com';  // URL de Render desplegado
      const response = await fetch(`${chatBackendUrl}/api/meetings/${roomCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Código de reunión inválido o reunión no encontrada');
      const data = await response.json();
      if (data.meeting.status !== 'active') {
        alert('La reunión ya ha finalizado.');
        return;
      }
      // Navigate to video call using the meeting ID
      navigate('/videocall', { state: { meetingId: roomCode } });
    } catch (error: any) {
      console.error('Error uniendo a reunión:', error);
      alert('Código inválido o error al unirte. Verifica e intenta de nuevo.');
    }
    // reset
    setRoomCode("");
    setShowCodeInput(false);
  }

  return (
    <main className="realtime-container" role="main" aria-labelledby="rt-title">
      <button
        className="hamburger"
        aria-label="Abrir menú"
        title="Menú"
        onClick={() => window.dispatchEvent(new Event('toggleSidebar'))}
      >
        <span />
        <span />
        <span />
      </button>
      <section className="realtime-card" aria-describedby="rt-actions">
        {flash?.text && (
          <p role="status" aria-live="polite" className={`rt-flash ${flash.type}`}>
            {flash.text}
          </p>
        )}
        <div className="logo-box">
          <img src="/RealTime.png" alt="RealTime" className="logo-image large" />
        </div>

        <nav id="rt-actions" className="realtime-actions" aria-label="Acciones de reunión">
          <button className="btn primary" type="button" onClick={handleCreateMeeting}>
            Crear reunión
          </button>

          {!showCodeInput ? (
            <button className="btn ghost" type="button" onClick={handleToggleCode}>
              Código de reunión
            </button>
          ) : (
            <div className="rt-code-row">
              <input
                className="rt-code-input"
                type="text"
                placeholder="Ingresa el código"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                aria-label="Código de reunión"
              />
              <button className="btn primary" type="button" onClick={handleJoinWithCode}>
                Unirse
              </button>
            </div>
          )}
        </nav>
      </section>
    </main>
  );
}