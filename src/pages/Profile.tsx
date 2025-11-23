import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Profile() {
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false); // Para alternar edición
  const [form, setForm] = useState({
    name: "",
    lastname: "",
    age: "",
  });
  const navigate = useNavigate();

  async function load() {
    try {
      const data = await api.me();
      setMe(data);
      setForm({
        name: data.name || "",
        lastname: data.lastname || "",
        age: data.age || "",
      });
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function save() {
    try {
      const updated = await api.updateMe({
        name: form.name,
        lastname: form.lastname,
        age: Number(form.age),
      });
      setMe(updated);
      setMsg("Perfil actualizado correctamente ✅");
      setEditing(false); // Salir de edición
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function kill() {
    const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;
    try {
      await api.deleteMe();
      api.logout();
      setMsg("Cuenta eliminada.");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (!localStorage.getItem("token")) return <p>Por favor inicia sesión primero.</p>;
  if (!me) return <p>Cargando perfil...</p>;

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
                <span>{editing ? "Guardar cambios" : "Editar perfil"}</span>
              </button>

              <div className="actions-list">
                <button className="action-item" onClick={kill}>
                  <span className="action-icon">🗑️</span>
                  <span>Eliminar cuenta</span>
                </button>

                <button className="action-item logout" onClick={() => { api.logout(); navigate('/login'); }}>
                  <span className="action-icon">🔌</span>
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <p id="profile-message" className="profile-message" role="status">
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}