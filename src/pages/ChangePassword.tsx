/* src/pages/ChangePassword.tsx */
import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirmPassword) return setMsg("Las contraseñas no coinciden.");
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      setMsg("Contraseña cambiada ✓");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: any) {
      setMsg(e.message || "Error al cambiar contraseña.");
    }
  }

  if (!localStorage.getItem("token")) {
    return <div className="container">Inicia sesión para cambiar tu contraseña.</div>;
  }

  return (
    <div className="login-container" role="main" aria-labelledby="changepw-title" lang="es">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle large">
            <img src="/RealTime.png" alt="RealTime" className="logo-image large" />
          </div>
        </div>
        <h2 id="changepw-title" className="label">Cambiar contraseña</h2>
        <form onSubmit={onSubmit} className="login-form" aria-describedby="changepw-status">
          <div className="input-group">
            <label htmlFor="current" className="label">Contraseña actual</label>
            <PasswordField id="current" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="pwd" className="label">Nueva contraseña</label>
            <PasswordField id="pwd" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="confirm" className="label">Confirmar contraseña</label>
            <PasswordField id="confirm" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-button">Guardar</button>
        </form>
        {msg && <p id="changepw-status" role="status" className="login-message">{msg}</p>}
      </div>
    </div>
  );
}
