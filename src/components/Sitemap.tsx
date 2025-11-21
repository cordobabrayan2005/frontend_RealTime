/**
 * Sitemap component
 *
 * This React functional component renders the footer section of the RealTime demo application.
 * It provides a structured "site map" with navigation links to key pages and authentication flows.
 *
 * ## Behavior
 * - Displays grouped navigation links for general pages and authentication-related routes.
 * - Uses semantic HTML (`<footer>`, `<h3>`, `<ul>`, `<li>`) to improve readability and accessibility.
 * - Includes ARIA attributes (`role="contentinfo"`, `aria-label="Mapa del sitio"`) for screen reader support.
 *
 * ## Structure
 * - **Title:** "Mapa del sitio" heading.
 * - **Columns:**
 *   - Pages: Links to main sections such as Home, About, User Manual, Videocall demo, and Profile.
 *   - Authentication: Links to login, signup, password recovery, reset, and change password flows.
 * - **Footer note:** Copyright notice.
 *
 * ## Accessibility
 * - `role="contentinfo"` identifies the footer as a landmark region.
 * - `aria-label="Mapa del sitio"` provides a descriptive label for assistive technologies.
 *
 * @function Sitemap
 * @returns {JSX.Element} The rendered footer component containing navigation links and copyright.
 *
 */
import React from 'react';
import { Link } from 'react-router-dom';

const Sitemap: React.FC = () => {
  return (
    <footer className="sitemap" role="contentinfo" aria-label="Mapa del sitio">
      <div className="sitemap-container">
        <h3 className="sitemap-title">Mapa del sitio</h3>

        <div className="sitemap-columns">
          <div className="sitemap-col">
            <h4>Páginas</h4>
            <ul>
              <li><Link to="/realtime">Inicio</Link></li>
              <li><Link to="/about">Sobre nosotros</Link></li>
              <li><Link to="/user-manual">Manual de usuario</Link></li>
              <li><Link to="/videocall">Videollamada (demo)</Link></li>
              <li><Link to="/profile">Perfil</Link></li>
            </ul>
          </div>

          <div className="sitemap-col">
            <h4>Autenticación</h4>
            <ul>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/signup">Registro</Link></li>
              <li><Link to="/forgot">Recuperar contraseña</Link></li>
              <li><Link to="/reset">Restablecer contraseña</Link></li>
              <li><Link to="/change-password">Cambiar contraseña</Link></li>
            </ul>
          </div>
        </div>

        <div className="sitemap-footer">
          <p>&copy; 2025 RealTime. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Sitemap;