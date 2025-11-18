/**
 * UserManual Component
 * 
 * A comprehensive user manual for the RealTime platform, providing step-by-step
 * instructions for all features and functionality. This component is accessible
 * to all users regardless of authentication status.
 * 
 * @component
 * @returns Complete user manual with navigation, feature explanations, and troubleshooting
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function UserManual() {
  const [activeSection, setActiveSection] = useState("getting-started");

  /**
   * Navigation items for the user manual sections
   */
  const sections = [
    { id: "getting-started", title: "Primeros Pasos", icon: "🚀" },
    { id: "account-management", title: "Gestión de Cuenta", icon: "👤" },
    { id: "password-recovery", title: "Recuperar Contraseña", icon: "🔐" },
    { id: "profile-security", title: "Perfil y Seguridad", icon: "🔒" },
    { id: "troubleshooting", title: "Solución de Problemas", icon: "🔧" },
    { id: "faq", title: "Preguntas Frecuentes", icon: "❓" }
  ];

  /**
   * Handles section navigation
   * @param sectionId - The ID of the section to navigate to
   */
  const navigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="user-manual" role="main" aria-labelledby="manual-title">
      <div className="manual-container">
        
        {/* Header Section */}
        <header className="manual-header" role="banner">
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <img src="/sinFondo.png" alt="RealTime" style={{width: 84, height: 'auto'}} />
            <div>
              <h1 id="manual-title">Manual de Usuario de RealTime</h1>
              <p className="manual-subtitle">Guía para las funcionalidades actuales (autenticación)</p>
            </div>
          </div>
          <div style={{marginTop: 10}}>
            <Link to="/realtime" className="back-home-link">Volver al inicio</Link>
          </div>
        </header>

        {/* Navigation Sidebar */}
        <nav className="manual-navigation" role="navigation" aria-label="Manual sections">
          <h2 className="nav-title">Tabla de Contenidos</h2>
          <ul className="nav-list">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => navigateToSection(section.id)}
                  aria-current={activeSection === section.id ? 'page' : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{section.icon}</span>
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content Area */}
        <div className="manual-content" role="main">

          {/* Getting Started Section */}
          <section id="getting-started" className="manual-section" aria-labelledby="getting-started-title">
            <h2 id="getting-started-title">🚀 Primeros Pasos</h2>

            <article className="content-block">
              <h3>Sobre este proyecto</h3>
              <p>
                Esta versión de RealTime está enfocada en la gestión de cuentas y autenticación. Las
                funciones multimedia han sido retiradas en el modo actual de la aplicación para centrarse
                en el registro, inicio de sesión y recuperación de contraseña.
              </p>
            </article>

            <article className="content-block">
              <h3>Requisitos mínimos</h3>
              <ul>
                <li><strong>Navegador:</strong> Chrome, Firefox, Edge o Safari (actualizados)</li>
                <li><strong>JavaScript:</strong> Debe estar habilitado</li>
                <li><strong>Conexión:</strong> No se requieren APIs externas para funciones principales en modo local</li>
              </ul>
            </article>

            <article className="content-block">
              <h3>Flujo básico</h3>
              <ol>
                <li>Regístrate en la página de registro (`/signup`).</li>
                <li>Inicia sesión en `/login`.</li>
                <li>Si olvidas tu contraseña usa `/forgot` y sigue el correo de recuperación.</li>
                <li>Usa la página de restablecer (`/reset?token=...`) para cambiar la contraseña.</li>
              </ol>
            </article>
          </section>

          {/* Account Management Section */}
          <section id="account-management" className="manual-section" aria-labelledby="account-title">
            <h2 id="account-title">👤 Gestión de Cuenta</h2>

            <article className="content-block">
              <h3>Registro</h3>
              <p>Rellena el formulario en `/signup` con los datos requeridos y pulsa "Crear cuenta". En el modo local puedes registrarte sin verificación externa.</p>
            </article>

            <article className="content-block">
              <h3>Inicio de sesión</h3>
              <p>Accede en `/login` introduciendo tu correo y contraseña. En este entorno de desarrollo el inicio de sesión crea un token local para permitir navegación.</p>
            </article>

            <article className="content-block">
              <h3>Recuperación de contraseña</h3>
              <p>Si olvidaste tu contraseña, ve a `/forgot` e introduce tu correo. En modo local la acción simula envío y puedes usar `/reset?token=local` para probar el flujo.</p>
            </article>
          </section>

          {/* Password recovery Section */}
          <section id="password-recovery" className="manual-section" aria-labelledby="pwd-title">
            <h2 id="pwd-title">🔐 Recuperar Contraseña</h2>

            <article className="content-block">
              <h3>Olvidé mi contraseña</h3>
              <ol>
                <li>Accede a `/forgot` e introduce tu correo.</li>
                <li>Revisa la consola o el simulador de correo en modo desarrollo si aplica.</li>
                <li>Sigue el enlace de recuperación (en modo local puede ser `?token=local`).</li>
                <li>Abre `/reset?token=...` y establece una nueva contraseña.</li>
              </ol>
            </article>
          </section>

          {/* Troubleshooting Section */}
          <section id="troubleshooting" className="manual-section" aria-labelledby="troubleshooting-title">
            <h2 id="troubleshooting-title">🔧 Solución de Problemas</h2>

            <article className="content-block">
              <h3>Problemas comunes</h3>
              <ul>
                <li><strong>No puedo iniciar sesión:</strong> Verifica correo y contraseña; en modo local asegúrate de haberte registrado primero.</li>
                <li><strong>No recibo el correo de recuperación:</strong> En desarrollo el envío es simulado; revisa la consola o usa `/reset?token=local` para probar.</li>
                <li><strong>Error al guardar datos:</strong> Comprueba la consola del navegador para mensajes y confirma que no hay bloqueadores de scripts.</li>
              </ul>
            </article>
          </section>

          {/* Profile & Security Section */}
          <section id="profile-security" className="manual-section" aria-labelledby="profile-title">
            <h2 id="profile-title">🔒 Perfil y Seguridad</h2>

            <article className="content-block">
              <h3>Actualizar perfil</h3>
              <p>Desde la sección de perfil (si está habilitada), puedes actualizar tu nombre o correo. En modo local estas acciones son simuladas.</p>
            </article>

            <article className="content-block">
              <h3>Cambiar contraseña</h3>
              <p>Para cambiar tu contraseña estando autenticado, usa la opción de cambio de contraseña disponible cuando estés logueado (archivo `ChangePassword.tsx`).</p>
            </article>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="manual-section" aria-labelledby="faq-title">
            <h2 id="faq-title">❓ Preguntas Frecuentes</h2>

            <article className="content-block">
              <div className="faq-item">
                <h3>¿Qué funciones incluye esta versión?</h3>
                <p>Autenticación de usuarios: registro, inicio de sesión y recuperación de contraseña. Otras funciones multimedia están deshabilitadas.</p>
              </div>

              <div className="faq-item">
                <h3>¿Funcionará sin backend?</h3>
                <p>Sí: en modo local la app usa stubs para simular llamadas al API y facilitar el desarrollo.</p>
              </div>

              <div className="faq-item">
                <h3>¿Cómo reporto un problema?</h3>
                <p>Abre un issue en el repositorio o contacta al equipo de desarrollo. Revisa la consola del navegador para errores al depurar.</p>
              </div>
            </article>
          </section>

        </div>

        {/* Footer */}
        <footer className="manual-footer" role="contentinfo">
          <div className="footer-content">
            <p>
              <strong>¿Necesitas más ayuda?</strong> Este manual cubre todas las características actuales de RealTime. 
              Para soporte técnico o sugerencias, por favor contacta a nuestro equipo de desarrollo.
            </p>
            <p className="version-info">
              Versión del Manual: 1.0 | Última Actualización: Octubre 2025 | Plataforma RealTime v1.0.0
            </p>
          </div>
        </footer>

      </div>
    </main>
  );
}