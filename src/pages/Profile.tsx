import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../stores/authStore";

/**
 * Shape of the profile data returned by the backend.
 * @typedef {Object} ProfileData
 * @property {string} [name]
 * @property {string} [lastname]
 * @property {string|number} [age]
 * @property {string} [email]
 */

/**
 * Profile page component.
 *
 * Responsibilities:
 * - Fetches the authenticated user's data via `api.me()`.
 * - Shows a centered loading state with a spinner while contacting the backend.
 * - Allows editing and updating (PUT) the basic profile fields.
 * - Allows deleting the account and logging out.
 * - Uses the auth store (`useAuthStore`) to immediately show data if already in memory.
 *
 * State:
 * - `me`: Current profile data (or null while loading).
 * - `form`: Temporary values for editing.
 * - `editing`: Flag to enable edit mode.
 * - `msg`: Feedback message (success / error).
 *
 * Accessibility:
 * - Spinner with `role="status"` and `aria-live` for screen reader users.
 * - Visible labels associated with each editable field.
 *
 * Errors:
 * - If the initial load fails, the error text is stored in `msg`.
 * - If there is no token, a sign-in prompt is shown.
 */
export default function Profile() {
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    lastname: "",
    age: "",
    email: ""
  });
  const navigate = useNavigate();
  const { user, token, isAuthed } = useAuthStore();

  /**
   * Loads the profile data from the backend and syncs the form state.
   * @async
   * @returns {Promise<void>}
   */
  async function load() {
    try {
      const data = await api.me();
      console.log("Datos recibidos:", data);
      setMe(data);
      setForm({
        name: data.name || "",
        lastname: data.lastname || "",
        age: data.age || "",
        email: data.email || ""
      });
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    // If we already have the user in the store, show it immediately to avoid a flash.
    if (user && !me) {
      setMe(user);
      setForm({
        name: user.name || "",
        lastname: user.lastname || "",
        age: String(user.age || ""),
        email: user.email || ""
      });
    }
    // Always attempt to sync with the backend to avoid stale data.
    load();
  }, []);

  /**
   * Updates a specific field in the edit form.
   * @template K
   * @param {K} key Field key to update.
   * @param {any} value New value for the field.
   */
  function set<K extends keyof typeof form>(key: K, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Submits form changes to the backend (PUT /profile).
   * @async
   * @returns {Promise<void>}
   */
  async function save() {
    try {
      const updated = await api.updateMe({
        name: form.name,
        lastname: form.lastname,
        age: Number(form.age),
        email: form.email,
      });
      setMe(updated);
      setMsg("Profile updated successfully ✅");
      setEditing(false);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  /**
   * Deletes the current user's account (DELETE /profile) after confirmation.
   * Clears the session and redirects to /login.
   * @async
   * @returns {Promise<void>}
   */
  async function kill() {
    const confirmDelete = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (!confirmDelete) return;
    try {
      await api.deleteMe();
      api.logout();
      setMsg("Account deleted.");
      navigate("/login");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const hasToken = !!localStorage.getItem("token") || !!token;
  if (!hasToken && !isAuthed) {
    console.warn('[Profile] No token found in localStorage or store');
    return (
      <div className="profile-loading">
        <p>Please sign in first.</p>
      </div>
    );
  }
  if (!me) return (
    <div className="profile-loading" role="status" aria-live="polite" aria-label="Cargando perfil">
      <div className="spinner" aria-hidden="true" />
      <p>Loading profile...</p>
    </div>
  );

  return (
    <section className="profile-page" role="region" aria-labelledby="profile-title" lang="es">
      <div className="profile-card modal-like">
        <button className="profile-close" aria-label="Cerrar" onClick={() => navigate('/realtime')}>×</button>

        <div className="profile-inner">
          <div className="profile-left">
            <h2 id="profile-title">Mi perfil</h2>

            <div className="profile-field">
              <label className="field-label">Nombres</label>
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="field-input"
                />
              ) : (
                <div className="field-value">{me.name}</div>
              )}
            </div>

            <div className="profile-field">
              <label className="field-label">Apellidos</label>
              {editing ? (
                <input
                  type="text"
                  value={form.lastname}
                  onChange={(e) => set("lastname", e.target.value)}
                  className="field-input"
                />
              ) : (
                <div className="field-value">{me.lastname}</div>
              )}
            </div>

            <div className="profile-field">
              <label className="field-label">Edad</label>
              {editing ? (
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  className="field-input"
                />
              ) : (
                <div className="field-value">{me.age}</div>
              )}
            </div>

            <div className="profile-field">
              <label className="field-label">Correo electrónico</label>
              <div className="field-value">{me.email}</div> {/* Solo lectura */}
            </div>
          </div>

          <div className="profile-divider" aria-hidden="true" />

          <div className="profile-right">
            <div className="actions-card">
              <button className="btn primary save-btn" onClick={editing ? save : () => setEditing(true)}>
                {editing ? "Guardar cambios" : "Editar perfil"}
              </button>

              <div className="actions-list">
                <button className="action-item" onClick={kill}>
                  🗑️ Eliminar cuenta
                </button>

                <button className="action-item logout" onClick={() => { api.logout(); navigate('/login'); }}>
                  🔌 Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>

        {msg && <p role="status" className="profile-message">{msg}</p>}
      </div>
    </section>
  );
};