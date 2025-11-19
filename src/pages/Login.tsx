/**
 * The `Login` component in TypeScript React handles user authentication by allowing users to input
 * their email and password to log in to their account.
 * @param e - In the code snippet you provided, the parameter `e` is used as an event object in the
 * `onSubmit` function. It represents the event that is being handled, specifically a `React.FormEvent`
 * in this case. This event object is used to prevent the default form submission behavior using `
 */

// src/pages/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";

type Props = { onAuth?: () => void };

export default function Login({ onAuth }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.login(email, password);
      onAuth?.();
      setMsg("Inicio de sesión exitoso.");
      setMsgType("success");
      navigate("/realtime");
    } catch (e: any) {
      setMsg(e.message || "Error al iniciar sesión.");
      setMsgType("error");
    }
  }

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

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
              required
              className="login-input"
            />
          </div>

          <button type="submit" className="login-button" aria-label="Ingresar a tu cuenta">
            Ingresar
          </button>
          
          <div className="social-row" aria-hidden>
            <button type="button" className="social-btn" aria-label="Iniciar sesión con Google">
              <img src="/google.png" alt="Google" />
              <span>Google</span>
            </button>

            <button type="button" className="social-btn" aria-label="Iniciar sesión con Facebook">
              <img src="/faceb.png" alt="Facebook" />
              <span>Facebook</span>
            </button>
            
            <button type="button" className="social-btn" aria-label="Iniciar sesión con GitHub">
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
