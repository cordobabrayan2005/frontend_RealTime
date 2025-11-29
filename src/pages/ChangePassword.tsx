// ...existing code...
/* src/pages/ChangePassword.tsx */
import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import PasswordField from "../components/PasswordField";
import { validatePasswordRules } from "../utils/passwordRules";

/**
 * ChangePassword component.
 *
 * Provides a UI for authenticated users to change their account password.
 * Performs client-side validation (minimum length and confirmation match)
 * and calls api.changePassword to update the password on the server.
 *
 * If the user is not authenticated (no token in localStorage) a message is shown.
 *
 * @returns {JSX.Element} The change password page.
 */
export default function ChangePassword() {
  /**
   * Current password input value.
   * @type {string}
   */
  const [currentPassword, setCurrentPassword] = useState("");

  /**
   * New password input value.
   * @type {string}
   */
  const [newPassword, setNewPassword] = useState("");

  /**
   * Confirmation for the new password.
   * @type {string}
   */
  const [confirmPassword, setConfirmPassword] = useState("");

  /**
   * Status / feedback message shown to the user.
   * @type {string}
   */
  const [msg, setMsg] = useState("");

  /**
   * Add a page-level CSS class while the component is mounted for styling.
   * Cleans up the class on unmount.
   */
  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  /**
   * Form submit handler.
   *
   * Performs client-side validation:
   *  - new password must have at least 6 characters
   *  - new password and confirmation must match
   *
   * On success calls api.changePassword(currentPassword, newPassword, confirmPassword)
   * and clears the inputs. Errors from the API are shown in the status message.
   *
   * @param {React.FormEvent} e - The form submit event.
   * @returns {Promise<void>}
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { valid, message } = validatePasswordRules(newPassword);
    if (!valid) {
      setMsg(message || "La contraseña no cumple los requisitos de seguridad.");
      return;
    }
    if (newPassword !== confirmPassword) return setMsg("Las contraseñas no coinciden.");
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      setMsg("Contraseña cambiada ✓");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: any) {
      setMsg(e.message || "Error al cambiar contraseña.");
    }
  }

  // If not authenticated, prompt the user to log in first.
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
