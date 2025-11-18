import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function About() {
  useEffect(() => {
    document.body.classList.remove("login-page");
  }, []);

  return (
    <main className="about-page" role="main" aria-labelledby="about-title">
      <section className="about-hero">
        <div className="about-hero-inner">
          <img src="/RealTime.png" alt="RealTime" className="about-logo" />
          <h1 id="about-title">Sobre nosotros</h1>
          <p className="about-sub">Tu compañero perfecto para disfrutar de las mejores experiencias en tiempo real.</p>
        </div>
      </section>

      <section className="about-content container">
        <h2 className="section-title">¿Qué es RealTime?</h2>
        <p className="lead">RealTime es una interfaz de demostración centrada en la autenticación y la experiencia de usuario. Está creada como referencia de diseño para flujos de inicio de sesión, perfil y una demo de reunión. El objetivo es ofrecer una UI limpia y accesible que sirva como base para integraciones posteriores.</p>

        <h3 className="section-sub">Características principales</h3>
        <div className="features-grid">
          <article className="feature-card">
            <div className="feature-icon">🧩</div>
            <h4>Robusto</h4>
            <p>Construido bajo los principios de accesibilidad del W3C (WCAG 2.1), garantizando compatibilidad con lectores de pantalla, navegadores modernos y dispositivos de asistencia. Su estructura semántica y uso de roles ARIA aseguran una experiencia consistente y accesible para todos los usuarios.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">🔒</div>
            <h4>Autenticación</h4>
            <p>Flujos completos de login, registro, recuperación y cambio de contraseña.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">💬</div>
            <h4>Demo de reunión</h4>
            <p>Vista previa estilo Meet con chat y controles de cámara/mic (UI).</p>
          </article>

          {/* API de desarrollo: eliminado por petición del cliente */}
        </div>

        <h3 className="section-sub">Nuestra misión</h3>
        <p>Creemos que las herramientas de colaboración en tiempo real deben ser accesibles y fáciles de usar. RealTime nace como una plantilla UI pensada para integrar funcionalidad con rapidez manteniendo una experiencia coherente y pulida.</p>

        <div className="version-row">
          <div className="version-box">
            <h4>Versión actual</h4>
            <div className="version-badges">
              <span className="badge">v1.0.0</span>
              <span className="badge green">Estable</span>
            </div>
            <p className="muted">Construido con React + Vite + TypeScript + SASS. Sustituir `api.ts` por tu backend para producción.</p>
          </div>

          <div className="dev-box">
            <h4>Desarrollado por</h4>
            <div className="dev-badge">REALTIME</div>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <Link to="/realtime" className="primary-btn">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
