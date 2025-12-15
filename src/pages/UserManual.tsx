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
    { id: "authentication", title: "Autenticación y Acceso", icon: "🔐" },
    { id: "realtime-home", title: "Sala Principal", icon: "🕒" },
    { id: "videocall", title: "Videollamadas", icon: "🎥" },
    { id: "account-security", title: "Cuenta y Seguridad", icon: "👤" },
    { id: "troubleshooting", title: "Solución de Problemas", icon: "🛠️" },
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
              <p className="manual-subtitle">Guía para las funcionalidades actuales (autenticación, reuniones y videollamadas)</p>
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
                RealTime ofrece flujos completos de autenticación, un tablero para gestionar reuniones y una experiencia de videollamadas con chat en vivo.
                Todas las pantallas comparten la misma sesión, por lo que al iniciar sesión puedes crear reuniones, unirte como invitado o administrar tu perfil sin volver a autenticarte.
              </p>
            </article>

            <article className="content-block">
              <h3>Requisitos mínimos</h3>
              <ul>
                <li><strong>Navegador:</strong> Chrome, Edge o Firefox en su versión más reciente.</li>
                <li><strong>Permisos:</strong> Autoriza el uso de cámara y micrófono para participar en videollamadas.</li>
                <li><strong>Conexión:</strong> Se recomienda conexión estable a internet con 5 Mbps simétricos o más.</li>
                <li><strong>Cuenta activa:</strong> Se requiere registro previo para crear o unirse a reuniones protegidas.</li>
              </ul>
            </article>

            <article className="content-block">
              <h3>Flujo básico</h3>
              <ol>
                <li>Crea tu cuenta desde la pantalla de registro y confirma que cumples los requisitos de contraseña.</li>
                <li>Inicia sesión desde la ruta de acceso y, si lo prefieres, utiliza inicio de sesión con Google o GitHub.</li>
                <li>Una vez autenticado, ingresa al panel RealTime para crear o unirte a una reunión.</li>
                <li>Accede a la videollamada para compartir audio, video y chat con el resto de participantes.</li>
                <li>Administra tu información personal desde la sección Mi cuenta y cierra sesión cuando termines.</li>
              </ol>
            </article>
          </section>

          {/* Authentication Section */}
          <section id="authentication" className="manual-section" aria-labelledby="auth-title">
            <h2 id="auth-title">🔐 Autenticación y Acceso</h2>

            <article className="content-block">
              <h3>Registro</h3>
              <ol>
                <li>Abre la pantalla de registro y completa nombre, apellidos, edad (18+), correo y contraseña.</li>
                <li>Verifica que la contraseña cumpla las reglas indicadas (mínimo 6 caracteres, combinación de letras y números).</li>
                <li>Confirma la contraseña y selecciona Crear cuenta. Se mostrará un mensaje de confirmación antes de volver al inicio de sesión.</li>
              </ol>
            </article>

            <article className="content-block">
              <h3>Inicio de sesión</h3>
              <p>
                Introduce tu correo y contraseña registrados. El botón Ingresar permanece bloqueado mientras se procesa la solicitud.
                Si prefieres, puedes iniciar sesión con Google o GitHub; tras autorizar se reutiliza la misma sesión y accederás directamente al panel principal.
              </p>
            </article>

            <article className="content-block">
              <h3>Recuperar acceso</h3>
              <ul>
                <li><strong>¿Olvidaste la contraseña?</strong> Envía tu correo desde la pantalla de recuperación; recibirás (o en entornos de prueba verás en la consola) un enlace con token.</li>
                <li><strong>Restablecer contraseña:</strong> Abre el enlace con token, crea la nueva contraseña y confirma. Se mostrará un mensaje y serás redirigido a la pantalla de inicio de sesión.</li>
                <li><strong>Cambiar contraseña autenticado:</strong> Desde el menú, accede a Cambiar contraseña para proporcionar la contraseña actual y definir la nueva.</li>
              </ul>
            </article>
          </section>

          {/* RealTime Home Section */}
          <section id="realtime-home" className="manual-section" aria-labelledby="realtime-title">
            <h2 id="realtime-title">🕒 Sala Principal</h2>

            <article className="content-block">
              <h3>Crear reunión</h3>
              <ol>
                <li>Haz clic en Crear reunión. La aplicación contacta al backend de reuniones y genera un identificador único.</li>
                <li>Se muestra el código para compartir. Copia y envíalo a tus invitados.</li>
                <li>Serás redirigido automáticamente a la videollamada con el rol de anfitrión.</li>
              </ol>
            </article>

            <article className="content-block">
              <h3>Unirse con código</h3>
              <ol>
                <li>Selecciona Código de reunión para desplegar el campo de ingreso.</li>
                <li>Introduce el código alfanumérico compartido por el anfitrión y pulsa Unirse.</li>
                <li>La aplicación valida que la reunión siga activa y te conduce a la videollamada.</li>
              </ol>
              <p>Si el código no existe o la reunión terminó, se mostrará un aviso explicando el motivo para que solicites uno nuevo.</p>
            </article>

            <article className="content-block">
              <h3>Menú lateral y mapa del sitio</h3>
              <p>
                Desde la esquina superior izquierda puedes abrir el menú lateral para acceder a Mi cuenta, Sobre nosotros, Manual de usuario y cerrar sesión.
                En todas las pantallas excepto la videollamada verás un mapa del sitio con accesos directos útiles.
              </p>
            </article>
          </section>

          {/* Videocall Section */}
          <section id="videocall" className="manual-section" aria-labelledby="videocall-title">
            <h2 id="videocall-title">🎥 Videollamadas</h2>

            <article className="content-block">
              <h3>Antes de entrar</h3>
              <ul>
                <li>Autoriza el acceso a cámara y micrófono cuando lo solicite el navegador.</li>
                <li>Usa auriculares para reducir eco y mejorar la experiencia de los demás participantes.</li>
                <li>Hasta 10 participantes pueden estar activos simultáneamente por reunión.</li>
              </ul>
            </article>

            <article className="content-block">
              <h3>Controles principales</h3>
              <ul>
                <li><strong>📷 Cámara:</strong> Activa o desactiva tu video. Al apagarla se muestra tu avatar.</li>
                <li><strong>🎙️ Micrófono:</strong> Silénciate o reactiva tu audio. El estado se sincroniza con el resto de participantes.</li>
                <li><strong>💬 Chat:</strong> Abre el panel lateral para enviar mensajes. Un punto rojo indica mensajes nuevos.</li>
                <li><strong>🔗 Código:</strong> Muestra el identificador de la reunión y ofrece copiarlo al portapapeles.</li>
                <li><strong>📞 Colgar:</strong> Abandona la reunión. El anfitrión puede finalizarla para todos.</li>
              </ul>
            </article>

            <article className="content-block">
              <h3>Chat y participantes</h3>
              <p>
                El chat conserva los mensajes enviados durante la reunión. Los participantes se muestran en una cuadrícula dinámica que ajusta el tamaño de cada video.
                Cuando alguien entra o sale, la lista se actualiza en tiempo real e informa si eres anfitrión o invitado.
              </p>
            </article>

            <article className="content-block">
              <h3>Finalizar reunión</h3>
              <p>
                El anfitrión puede terminar la reunión desde la opción Colgar, lo que desconecta a los asistentes y les muestra un aviso. Todos son redirigidos a la sala principal después de unos segundos.
              </p>
            </article>
          </section>

          {/* Account & Security Section */}
          <section id="account-security" className="manual-section" aria-labelledby="account-title">
            <h2 id="account-title">👤 Cuenta y Seguridad</h2>

            <article className="content-block">
              <h3>Mi perfil</h3>
              <p>
                Desde Mi cuenta puedes editar nombre, apellidos, edad y consultar tu correo registrado. Activa el modo edición, ajusta los campos y guarda los cambios para sincronizarlos con el backend.
              </p>
            </article>

            <article className="content-block">
              <h3>Cambiar contraseña y cierre de sesión</h3>
              <p>
                Usa la opción Cambiar contraseña para actualizar tus credenciales mientras estás autenticado. El botón Cerrar sesión del menú lateral borra el token y te devuelve a la pantalla de inicio.
              </p>
            </article>

            <article className="content-block">
              <h3>Eliminar cuenta</h3>
              <p>
                En la pantalla de perfil puedes solicitar la eliminación definitiva de tu cuenta. Esta acción es irreversible y revoca inmediatamente el acceso a reuniones y datos almacenados.
              </p>
            </article>
          </section>

          {/* Troubleshooting Section */}
          <section id="troubleshooting" className="manual-section" aria-labelledby="troubleshooting-title">
            <h2 id="troubleshooting-title">🛠️ Solución de Problemas</h2>

            <article className="content-block">
              <h3>Incidencias frecuentes</h3>
              <ul>
                <li><strong>No puedo iniciar sesión:</strong> Revisa las credenciales y comprueba si la sesión anterior expiró. Si olvidaste la contraseña, utiliza la opción de recuperación.</li>
                <li><strong>Micrófono o cámara no se activan:</strong> Verifica permisos del navegador y que ninguna otra aplicación esté usando los dispositivos.</li>
                <li><strong>Código de reunión inválido:</strong> Confirmar con el anfitrión que la reunión siga activa; los códigos caducan cuando el anfitrión la finaliza.</li>
                <li><strong>Audio entrecortado:</strong> Cierra pestañas pesadas, usa conexión por cable si es posible y silencia tu micrófono cuando no hables para reducir carga.</li>
              </ul>
            </article>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="manual-section" aria-labelledby="faq-title">
            <h2 id="faq-title">❓ Preguntas Frecuentes</h2>

            <article className="content-block">
              <div className="faq-item">
                <h3>¿Cuántos usuarios pueden unirse?</h3>
                <p>Hasta diez participantes activos por reunión. Se muestran en la cuadrícula de video y se actualizan en tiempo real.</p>
              </div>

              <div className="faq-item">
                <h3>¿Se graban las videollamadas?</h3>
                <p>No. La versión actual solo realiza transmisión en vivo y no almacena audio ni video.</p>
              </div>

              <div className="faq-item">
                <h3>¿Qué pasa si cierro el navegador?</h3>
                <p>Perderás la conexión con la reunión. Al volver a abrir, inicia sesión nuevamente y usa el mismo código mientras la reunión siga activa.</p>
              </div>

              <div className="faq-item">
                <h3>¿Cómo reporto un problema?</h3>
                <p>Contacta al equipo de soporte o abre un ticket en el repositorio del proyecto adjuntando capturas y el mensaje mostrado en pantalla.</p>
              </div>
            </article>
          </section>

        </div>

        {/* Footer */}
        <footer className="manual-footer" role="contentinfo">
          <div className="footer-content">
            <p>
              <strong>¿Necesitas más ayuda?</strong> Este manual cubre las funcionalidades disponibles. Si detectas incidencias o tienes sugerencias, comunícate con el equipo de desarrollo.
            </p>
            <p className="version-info">
              Versión del Manual: 2.0 | Última Actualización: Diciembre 2025 | Plataforma RealTime v1.0.0
            </p>
          </div>
        </footer>

      </div>
    </main>
  );
}