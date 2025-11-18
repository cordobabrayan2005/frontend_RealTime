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