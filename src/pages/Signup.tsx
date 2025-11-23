// src/pages/Signup.tsx
import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";

export default function Signup() {
  const [form, setForm] = useState({
    name: "",
    lastname: "",
    age: "",  // Cambiado de birthdate
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(form.age) < 18 || isNaN(Number(form.age))) {
      setMsg("Debes tener al menos 18 años para registrarte.");
      setMsgType("error");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMsg("Las contraseñas no coinciden.");
      setMsgType("error");
      return;
    }
    try {
      const formData = {
        name: form.name,
        lastname: form.lastname,
        age: Number(form.age),  // Enviar como número
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword
      };
      await api.signup(formData);
      setMsg("Cuenta creada. Ahora puedes iniciar sesión.");
      setMsgType("success");
    } catch (e: any) {
      setMsg(e.message || "Error al crear la cuenta.");
      setMsgType("error");
    }
  }

  return (
    <main className="auth-wrapper" role="main" aria-labelledby="signup-title" lang="es">
      <section className="login-card signup-card">
        <div className="login-logo">
          <img src="/RealTime.png" alt="RealTime logo" className="logo-image large" />
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <section aria-label="Información personal">
            <div className="form-group">
              <label htmlFor="name" className="sr-only">Nombre</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nombre"
                required
                className="login-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastname" className="sr-only">Apellido</label>
              <input
                id="lastname"
                type="text"
                value={form.lastname}
                onChange={(e) => set("lastname", e.target.value)}
                placeholder="Apellido"
                required
                className="login-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="age" className="sr-only">Edad</label>
              <input
                id="age"
                type="number"
                min={18}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                placeholder="Edad (mínimo 18 años)"
                required
                className="login-input"
              />
            </div>
          </section>

          <section aria-label="Credenciales de acceso">
            <div className="form-group">
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Correo electrónico"
                required
                aria-required="true"
                className="login-input"
              />
            </div>

            <div className="form-group">
              <PasswordField
                id="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                label=""
                placeholder="Contraseña"
                required
                className="login-input"
              />
            </div>

            <div className="form-group">
              <PasswordField
                id="confirmPassword"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                label=""
                placeholder="Confirmar contraseña"
                required
                className="login-input"
              />
            </div>
          </section>

          <button type="submit" className="login-button">Crear cuenta</button>
        </form>

        <nav className="login-links">
          <p className="signup-text">
            <a href="/login" className="signup-link">Volver al inicio</a>
          </p>
        </nav>

        {msg && (
          <p id="signup-status" role="status" className={`login-message ${msgType}`}>
            {msg}
          </p>
        )}
      </section>
    </main>
  );
}