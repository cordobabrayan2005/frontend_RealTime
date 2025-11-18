/* The code snippet is importing necessary modules and functions from the React library and a custom
API service file. */
// src/pages/Forgot.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.forgot(email);
      setMsg("Si el correo existe, se ha enviado un enlace de recuperación.");
      setMsgType("success");
    } catch (e: any) {
      setMsg(e.message || "Error al enviar el enlace.");
      setMsgType("error");
    }
  }

  return (
    <main className="auth-wrapper" role="main" aria-labelledby="forgot-title">
      <section className="login-card forgot-card" aria-describedby="forgot-description">
        <div className="login-logo">
          <div className="logo-circle large">
            <img src="/RealTime.png" alt="RealTime" className="logo-image large" />
          </div>  
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="input-group">
            <label htmlFor="email" className="label">
              Ingrese su correo electrónico para recuperar su contraseña
            </label>
            <input
              id="email"
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Correo electrónico"
            />
          </div>

          <button type="submit" className="login-button">Enviar enlace</button>
        </form>

        <div className="login-links">
          <p className="signup-text">
            <Link to="/login" className="signup-link">Volver al inicio</Link>
          </p>
        </div>

        {msg && <p role="status" className={`login-message ${msgType}`}>{msg}</p>}
      </section>
    </main>
  );
}
