
/* The `import React, { useEffect, useState } from "react";` statement is importing the necessary
modules from the React library. Specifically, it is importing the `useEffect` and `useState` hooks
from React, which are essential for managing side effects and state in functional components. */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

/**
 * The `Profile` function in TypeScript React handles user profile management including loading,
 * updating, and deleting user information with error handling and user feedback.
 * @returns The `Profile` component is being returned. It includes a form for editing user profile
 * information such as first name, last name, age, and email. It also has buttons for saving changes,
 * logging out, and deleting the account. Additionally, there are messages displayed based on actions
 * taken, such as updating the profile, logging out, or deleting the account.
 */
export default function Profile() {
  /* The code snippet `const [me, setMe] = useState<any>(null);` and `const [msg, setMsg] =
  useState("");` in the Profile component is utilizing the `useState` hook from React to manage
  state within a functional component. */
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  /**
   * The function `load` asynchronously fetches user data from an API and sets the retrieved data to
   * the state variable `me`, while handling any errors by setting an error message in the state
   * variable `msg`.
   */
  async function load() {
    try {
      const data = await api.me();
      setMe(data);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  /* The `useEffect(() => { load(); }, []);` code snippet in the `Profile` component is utilizing the
  `useEffect` hook from React. This hook is used to perform side effects in functional components. */
  useEffect(() => {
    load();
  }, []);

  /**
   * The function `save` updates user profile information using an API call and displays a success
   * message if the update is successful, or an error message if there is an error.
   */
  async function save() {
    try {
      const updated = await api.updateMe({
        name: me.firstName,
        lastname: me.lastName,
        age: me.age,
        email: me.email,
      });
      setMe(updated);
      setMsg("Perfil actualizado correctamente ✅");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  /**
   * The function `kill` attempts to delete a user account using an API call and displays a success
   * message if successful, or an error message if an exception occurs.
   */
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

  /* The code snippet `if (!localStorage.getItem("token")) return <p>Por favor inicia sesión
  primero.</p>; if (!me) return <p>Cargando perfil...</p>;` in the `Profile` component is performing
  two checks: */
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
              <div className="field-label">Nombres</div>
              <div className="field-value">{me.firstName}</div>
            </div>

            <div className="profile-field">
              <div className="field-label">Apellidos</div>
              <div className="field-value">{me.lastName}</div>
            </div>

            <div className="profile-field">
              <div className="field-label">Edad</div>
              <div className="field-value">{me.age}</div>
            </div>

            <div className="profile-field">
              <div className="field-label">Correo electronico</div>
              <div className="field-value">{me.email}</div>
            </div>

            <div className="profile-field">
              <div className="field-label">Cambiar contraseña</div>
              <div className="field-value">__________</div>
            </div>

            <div className="profile-field">
              <div className="field-label">Confirmar contraseña</div>
              <div className="field-value">__________</div>
            </div>
          </div>

          <div className="profile-divider" aria-hidden="true" />

          <div className="profile-right">
            <div className="actions-card">
              <button className="btn primary save-btn" onClick={save}>
                <span>Guardar cambios</span>
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
