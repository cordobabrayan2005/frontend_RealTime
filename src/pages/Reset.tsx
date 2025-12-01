// src/pages/Reset.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";
import { validatePasswordRules } from "../utils/passwordRules";

/**
 * @typedef {Object} Participant
 * @property {number} id
 * @property {string} name
 *
 * @typedef {Object} ChatMessage
 * @property {number} id
 * @property {string} author
 * @property {string} text
 */

/**
 * Reset page component.
 *
 * Renders a password reset form that reads a token from the URL search params,
 * validates the new password and confirmation locally and calls the API to
 * perform the reset. Shows status messages and redirects to the login page
 * on success.
 *
 * @returns {JSX.Element} The reset password page.
 */
export default function Reset() {
  /**
   * URL search params hook. The reset token is expected in the "token" param.
   * @type {[URLSearchParams]}
   */
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get("token") || ""; // token comes from the emailed link

  /** New password input value. */
  const [password, setPassword] = useState("");
  /** Confirm password input value. */
  const [confirm, setConfirm] = useState("");
  /** Status / feedback message shown to the user. */
  const [msg, setMsg] = useState("");
  /** Message type controls styling: "success" | "error" | "info". */
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  /**
   * Add a page class for styling while the component is mounted.
   * Cleanup removes the class on unmount.
   */
  useEffect(() => {
    document.body.classList.add("login-page");
    return () => { document.body.classList.remove("login-page"); };
  }, []);

  /**
   * Form submit handler.
   *
  * Performs client-side validation:
  *  - ensures a token is present
  *  - valida que la contraseña cumpla letras, dígitos y símbolos requeridos
  *  - checks password and confirmation match
   *
   * On success it calls api.reset(token, password, confirm) and then redirects
   * to the login page after a short delay.
   *
   * Errors from the API are displayed in the status message.
   *
   * @param {React.FormEvent} e - The form submit event.
   * @returns {Promise<void>}
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setMsg("Falta token. Abre el enlace desde tu correo nuevamente.");
      setMsgType("error");
      return;
    }
    const { valid, message } = validatePasswordRules(password);
    if (!valid) {
      setMsg(message || "La contraseña no cumple los requisitos de seguridad.");
      setMsgType("error");
      return;
    }
    if (password !== confirm) {
      setMsg("Las contraseñas no coinciden.");
      setMsgType("error");
      return;
    }
    try {
      await api.reset(token, password);  // Changed: remove confirm
      setMsg("Contraseña actualizada. Redirigiendo al inicio de sesión…");
      setMsgType("success");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e: any) {
      setMsg(e.message || "Error al restablecer.");
      setMsgType("error");
    }
  }

  return (
    <div className="login-container" role="main" aria-labelledby="reset-title" lang="es">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle large">
            {/* En Vite, /public se sirve desde la raíz */}
            <img src="/RealTime.png" alt="RealTime" className="logo-image large" />
          </div>
          {/* brand text removed per request */}
        </div>


        <form onSubmit={onSubmit} className="login-form" aria-describedby="reset-status">
          <div className="input-group">
            <label htmlFor="password" className="label">Nueva contraseña</label>
            <PasswordField
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
              className="login-input"
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirm" className="label">Confirmar contraseña</label>
            <PasswordField
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar contraseña"
              required
              className="login-input"
            />
          </div>

          <button type="submit" className="login-button">
            Cambiar contraseña
          </button>
        </form>

        <div className="login-links">
          <p className="signup-text">
            <a href="/login" className="signup-link">Volver al inicio</a>
          </p>
        </div>

        {msg && (
          <p id="reset-status" role="status" className={`login-message ${msgType}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
