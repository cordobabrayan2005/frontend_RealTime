#  RealTime Frontend

**Desarrollado por:** REALTIME

Este repositorio contiene el frontend del proyecto RealTime. Actualmente la aplicación está enfocada en las funcionalidades de autenticación y gestión de usuario, junto con una demo local de la experiencia "RealTime / Reunión" (videollamada) para desarrollo  la app usa stubs locales para simular el backend.

Resumen rápido del estado actual
- Autenticación: Login, Signup, Olvido/Reset de contraseña (stubs).
- Perfil: página de perfil con diseño tipo tarjeta/modal.
- Manual de usuario: `/user-manual` actualizado y accesible desde el menú.
- Robusto: construido teniendo en cuenta accesibilidad (WCAG 2.1). Compatibilidad con lectores de pantalla y roles ARIA.
- RealTime: landing post-login en `/realtime` con botón "Crear reunión" que abre la demo de videollamada en `/videocall`.
- Videocall demo: interfaz estilo Google Meet con un participante inicial, controles (cámara, micrófono, chat, colgar) y panel de chat.
- API: `src/services/api.ts` es un stub (no hace llamadas reales) para permitir desarrollo offline.
- Removed: funcionalidades multimedia avanzadas y endpoints externos fueron eliminados para dejar la app centrada en autenticación y demo local.

##  Tecnologías

- React + TypeScript
- Vite (dev server)
- Sass (`src/styles.scss`)
- React Router

## Páginas / Rutas principales

- `/login`  Inicio de sesión (redirige a `/realtime` tras login).
- `/signup`  Registro de usuario.
- `/forgot`  Solicitar recuperación de contraseña.
- `/reset`  Restablecer contraseña (ej.: `/reset?token=local`).
- `/realtime`  Landing post-login (crear reunión, código de reunión, abrir sidebar).
- `/videocall`  Demo de videollamada (grid de participantes, chat, controles).
- `/profile`  Página de perfil (diseño tipo tarjeta/modal).
- `/user-manual`  Manual de usuario actualizado.

## Cómo ejecutar (desarrollo)

1. Instala dependencias:
```powershell
npm install
```
2. Ejecuta el servidor de desarrollo:
```powershell
npm run dev
```
3. Abrir en el navegador (por defecto Vite usa `http://localhost:5173`):

- `http://localhost:5173/login`  para probar login y flujo auth
- `http://localhost:5173/realtime`  landing post-login
- `http://localhost:5173/videocall`  demo de videollamada

Nota: puedes conectar `src/services/api.ts` a un backend real reemplazando las funciones stub si lo deseas.

## API (modo stub)

`src/services/api.ts` exporta funciones con la misma interfaz esperada del backend pero que resuelven localmente (ej.: `login` guarda un token en `localStorage`). Esto permite desarrollo sin dependencia de un backend real.

## Estilos

- Toda la app usa `src/styles.scss` (Sass). He incluido variables de color y reglas específicas para auth, sidebar, perfil, manual y la demo de videollamada.

## Consideraciones y siguientes pasos posibles

- Integración con backend real: reemplazar `src/services/api.ts` por llamadas reales.
- Integración WebRTC / streams reales en `/videocall`.
- Persistencia del chat y sincronización multiusuario (requiere backend).
- Limpieza final de estilos (se dejaron bloques de seguridad antes de eliminar código totalmente).

## Scripts útiles

- `npm run dev`  servidor de desarrollo
- `npm run build`  build de producción
- `npm run preview`  preview local del build

## Contribuir

- Fork  rama  PR. Mantén los commits pequeños y enfocados.

## Licencia

MIT

