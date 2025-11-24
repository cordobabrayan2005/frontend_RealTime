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
 * - Obtiene datos del usuario autenticado vía `api.me()`.
 * - Muestra un estado de carga centrado con spinner mientras se consulta el backend.
 * - Permite editar y actualizar (PUT) los campos básicos del perfil.
 * - Permite eliminar la cuenta y cerrar sesión.
 * - Usa el store (`useAuthStore`) para mostrar datos inmediatamente si ya están en memoria.
 *
 * Estados:
 * - `me`: Datos del perfil actuales (o null mientras carga).
 * - `form`: Datos temporales para edición.
 * - `editing`: Flag que habilita modo edición.
 * - `msg`: Mensaje de retroalimentación (éxito / error).
 *
 * Accesibilidad:
 * - Spinner con `role="status"` y `aria-live` para usuarios de lector.
 * - Labels visibles asociadas a cada campo editable.
 *
 * Errores:
 * - Si falla la carga inicial se coloca el mensaje en `msg`.
 * - Si no hay token se solicita inicio de sesión.
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
   * Carga los datos de perfil desde el backend y sincroniza el formulario.
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
    // Si ya tenemos usuario en store, mostrarlo inmediatamente para evitar flash.
    if (user && !me) {
      setMe(user);
      setForm({
        name: user.name || "",
        lastname: user.lastname || "",
        age: String(user.age || ""),
        email: user.email || ""
      });
    }
    // Siempre intentar sincronizar con backend evitando datos stale.
    load();
  }, []);

  /**
   * Actualiza un campo específico del formulario de edición.
   * @template K
   * @param {K} key Clave del campo a actualizar.
   * @param {any} value Nuevo valor del campo.
   */
  function set<K extends keyof typeof form>(key: K, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Envía cambios del formulario al backend (PUT /profile).
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
      setMsg("Perfil actualizado correctamente ✅");
      setEditing(false);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  /**
   * Elimina la cuenta del usuario actual (DELETE /profile) tras confirmación.
   * Limpia sesión y redirige a /login.
   * @async
   * @returns {Promise<void>}
   */
  async function kill() {
    const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;
    try {
      await api.deleteMe();
      api.logout();
      setMsg("Cuenta eliminada.");
      navigate("/login");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const hasToken = !!localStorage.getItem("token") || !!token;
  if (!hasToken && !isAuthed) {
    console.warn('[Profile] No token encontrado en localStorage ni store');
    return (
      <div className="profile-loading">
        <p>Por favor inicia sesión primero.</p>
      </div>
    );
  }
  if (!me) return (
    <div className="profile-loading" role="status" aria-live="polite" aria-label="Cargando perfil">
      <div className="spinner" aria-hidden="true" />
      <p>Cargando perfil...</p>
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