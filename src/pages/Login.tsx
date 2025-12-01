/**
 * The `Login` component in TypeScript React handles user authentication by allowing users to input
 * their email and password to log in to their account.
 * @param e - In the code snippet you provided, the parameter `e` is used as an event object in the
 * `onSubmit` function. It represents the event that is being handled, specifically a `React.FormEvent`
 * in this case. This event object is used to prevent the default form submission behavior using `
 */

// src/pages/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuthStore } from '../stores/authStore';  // Nuevo
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";

/**
 * Props for the Login component.
 * @typedef {Object} Props
 * @property {Function} [onAuth] - Optional callback invoked after a successful authentication.
 */

/**
 * Login component.
 *
 * Renders an email/password form, social auth buttons and handles authentication via the `api` service and Zustand store.
 *
 * @param {Props} props - Component props.
 * @returns {JSX.Element} A login form UI.
 */
type Props = { onAuth?: () => void };

export default function Login({ onAuth }: Props) {
  /**
   * Email input state.
   * @type {string}
   */
  const [email, setEmail] = useState("");

  /**
   * Password input state.
   * @type {string}
   */
  const [password, setPassword] = useState("");

  /**
   * Status message shown to the user (success / error / info).
   * @type {string}
   */
  const [msg, setMsg] = useState("");

  /**
   * Message type used for styling: "success" | "error" | "info".
   * @type {"success" | "error" | "info"}
   */
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const navigate = useNavigate();
  const location = useLocation();
  const { login, socialLogin, isLoading, error } = useAuthStore();  // Nuevo

  /**
   * Form submit handler.
   *
   * Calls store.login with the provided credentials. On success invokes the optional
   * onAuth callback, shows a success message and navigates to the realtime page.
   * On failure displays an error message returned from the API.
   *
   * @param {React.FormEvent} e - Form submit event.
   * @returns {Promise<void>}
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);  // Usa store
      onAuth?.();
      setMsg("Inicio de sesión exitoso.");
      setMsgType("success");
      navigate("/realtime", { state: { flash: { type: "success", text: "Bienvenido a RealTime" } } });
    } catch (e: any) {
      setMsg(e.message || "Error al iniciar sesión.");
      setMsgType("error");
    }
  }

  /**
   * Social login handler.
   *
   * Calls store.socialLogin with the provider. On success navigates to realtime.
   *
   * @param {string} provider - 'google' or 'github'
   * @returns {Promise<void>}
   */
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      await socialLogin(provider);  // Usa store
      onAuth?.();
      setMsg("Inicio de sesión exitoso.");
      setMsgType("success");
      navigate("/realtime", { state: { flash: { type: "success", text: "Bienvenido a RealTime" } } });
    } catch (e: any) {
      setMsg(e.message || "Error en login social.");
      setMsgType("error");
    }
  };

  /**
   * Add a page-level class while the component is mounted for styling.
   */
  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  // Display success message if we are coming from a log
  useEffect(() => {
    const state = location.state as any;
    if (state?.flash) {
      setMsg(state.flash.text || "Cuenta creada sin problemas. Inicia sesión para continuar.");
      setMsgType(state.flash.type || "success");
      // Clear the navigation state to prevent it from re-displaying when going back.
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  return (
    <main className="auth-wrapper" role="main" aria-labelledby="login-title">
      <section className="login-card" aria-describedby="login-description">
        <div className="login-logo">
          <img src="/RealTime.png" alt="RealTime logo" className="logo-image large" />
        </div>

        <form onSubmit={onSubmit} className="login-form" aria-label="Formulario de inicio de sesión">
          <div className="form-group">
            <label htmlFor="email" className="sr-only form-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electronico"
              required
              className="login-input"
              aria-required="true"
            />
          </div>

          <div className="form-group">
            <PasswordField
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label=""
              placeholder="Contraseña"
              required
              className="login-input"
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading} aria-label="Ingresar a tu cuenta">
            Ingresar
          </button>
          
          <div className="social-row" aria-hidden>
            <button className="social-btn" onClick={() => handleSocialLogin('google')} disabled={isLoading} aria-label="Iniciar sesión con Google">
              <img src="/google.png" alt="Google" />
              <span>Google</span>
            </button>

            <button className="social-btn" onClick={() => handleSocialLogin('github')} disabled={isLoading} aria-label="Iniciar sesión con GitHub">
              <img src="/github.png" alt="GitHub" />
              <span>GitHub</span>
            </button>
          </div>
        </form>

        <nav className="login-links" aria-label="Enlaces de ayuda">
          <p className="forgot-text">
            <Link to="/forgot" className="forgot-link">Olvido su contraseña?</Link>
          </p>

          <p className="signup-text">
            No tiene una cuenta ? {" "}
            <Link to="/signup" className="signup-link">Registrarse aquí</Link>
          </p>
        </nav>

        {msg && (
          <p role="status" aria-live="polite" className={`login-message ${msgType}`}>
            {msg}
          </p>
        )}
      </section>
    </main>
  );
}