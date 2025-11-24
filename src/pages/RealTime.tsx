import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
   * Attempt to join a meeting using the current roomCode.
   *
   * Performs basic client-side validation and presents simple UI feedback
   * (alerts / console) until real join logic is implemented.
   *
   * @returns {void}
   */
  function handleJoinWithCode() {
    if (!roomCode.trim()) {
      // small UI feedback for empty code
      alert("Por favor ingresa un código de reunión.");
      return;
    }
    // For now just log — integrate with API/logic later
    console.log("Intentando unirse con código:", roomCode);
    alert(`Intentando unirse a la reunión: ${roomCode}`);
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
        <div className="logo-box" style={{ background: '#fff', padding: '2.25rem', borderRadius: 8, boxShadow: '0 6px 20px rgba(16,24,40,0.04)', marginBottom: 24 }}>
          <img src="/RealTime.png" alt="RealTime" className="logo-image large" />
        </div>

        <nav id="rt-actions" className="realtime-actions" aria-label="Acciones de reunión">
          <button className="btn primary" type="button" onClick={() => navigate('/videocall')}>
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
