// src/services/api.ts
// Stubbed API for offline / development mode
// This file replaces real network calls with local, resolved Promises so the frontend
// can function without a backend. All methods keep the original API shape.

type AnyObj = Record<string, any>;

// Require `VITE_API_URL` to be set. This avoids accidentally calling a local backend
// when you intended to use the URL from your `.env` or Vercel configuration.
const ENV_BASE = import.meta.env.VITE_API_URL;
if (!ENV_BASE) {
  // Fail-fast with a clear message so you set the env var instead of silently using localhost
  throw new Error('VITE_API_URL is not defined. Please set VITE_API_URL in your .env (or in Vercel environment variables).');
}
const BASE = ENV_BASE;

function friendlyError(status: number, data: any): string {
  const raw = (data && typeof data === 'object') ? (data.error || data.message) : (typeof data === 'string' ? data : '');
  const text = (raw || '').toString();
  // Normalize for comparisons
  const t = text.toLowerCase();

  // Common mappings from backend controller
  if (status === 400) {
    if (t.includes('todos los campos son requeridos')) return 'Completa todos los campos.';
    if (t.includes('contraseñas no coinciden')) return 'Las contraseñas no coinciden.';
    if (t.includes('email y contraseña son requeridos')) return 'Ingresa email y contraseña.';
    if (t.includes('token y nueva contraseña son requeridos')) return 'Falta información para restablecer la contraseña.';
    if (t.includes('email es requerido')) return 'Ingresa tu correo electrónico.';
    return 'Solicitud inválida. Revisa los datos ingresados.';
  }
  if (status === 401) {
    if (t.includes('usuario no autenticado')) return 'Tu sesión expiró. Inicia sesión nuevamente.';
    if (t.includes('credenciales inválidas') || t.includes('email o contraseña incorrectos')) return 'Email o contraseña incorrectos.';
    return 'No autorizado. Inicia sesión para continuar.';
  }
  if (status === 403) {
    if (t.includes('deshabilitada')) return 'Tu cuenta está deshabilitada.';
    if (t.includes('verificar tu correo')) return 'Verifica tu correo para iniciar sesión.';
    if (t.includes('no registrado')) return 'No hay una cuenta asociada a ese correo. Regístrate primero.';
    return 'Acceso denegado.';
  }
  if (status === 404) {
    if (t.includes('usuario no encontrado')) return 'No encontramos tu perfil.';
    return 'Recurso no encontrado.';
  }
  if (status === 409) {
    if (t.includes('correo ya está registrado') || t.includes('ya está registrado')) return 'Este correo ya está registrado.';
    return 'Conflicto con los datos enviados.';
  }
  if (status >= 500) {
    return 'Ocurrió un error del servidor. Inténtalo más tarde.';
  }
  return text || 'Error en la petición';
}

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  // Normalize headers: options.headers may be a Headers instance or object
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  let optHeaders: Record<string, string> = {};
  if (options.headers instanceof Headers) {
    optHeaders = Object.fromEntries(options.headers.entries());
  } else if (options.headers && typeof options.headers === 'object') {
    optHeaders = options.headers as Record<string, string>;
  }

  const headers: Record<string, string> = { ...baseHeaders, ...optHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    // Corrección: Asegurar que la URL tenga / entre BASE y path
    const url = `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    // mask Authorization when logging
    const headersToLog = { ...headers } as Record<string, any>;
    if (headersToLog.Authorization) headersToLog.Authorization = '***';
    console.log('[api] REQUEST', { method: options.method ?? 'GET', url, headers: headersToLog, body: options.body });

    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    // Network-level error (CORS, DNS, server down, etc.)
    console.error('[api] NETWORK ERROR', { err });
    throw new Error('Network error: ' + (err?.message || String(err)));
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      // If response is not JSON, keep raw text so caller can inspect it
      data = text;
    }
  }

  if (!res.ok) {
    const message = friendlyError(res.status, data);
    console.error('[api] ERROR RESPONSE', { url: `${BASE}${path}`, status: res.status, data });
    if (res.status === 401) {
      // sesión no válida: limpiar token para forzar reautenticación
      try { localStorage.removeItem('token'); } catch {}
      // Emitir evento opcional para que la app pueda reaccionar si lo desea
      try { window.dispatchEvent(new CustomEvent('auth:unauthorized')); } catch {}
    }
    throw new Error(message || 'Error en la petición');
  }

  // Log successful response
  try {
    console.log('[api] RESPONSE', { url: `${BASE}${path}`, status: res.status, data });
  } catch (e) {
    /* ignore logging errors */
  }

  return data;
}

export const api = {
  // IMPORTANT: Since BASE already ends in /api, do not repeat /api in each path
  signup: async (data: AnyObj) => request('/register', { method: 'POST', body: JSON.stringify(data) }),
  login: async (email: string, password: string) => {
    const result = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result?.token) localStorage.setItem('token', result.token);
    return result;
  },
  logout: () => {
    localStorage.removeItem('token');
    return { ok: true };
  },
  me: async () => {
    const res = await request('/profile', { method: 'GET' });
    // Backend devuelve { user: { ... } }
    return (res && typeof res === 'object' && 'user' in res) ? (res as AnyObj).user : res;
  },
  updateMe: async (data: AnyObj) => {
    const res = await request('/profile', { method: 'PUT', body: JSON.stringify(data) });
    return (res && typeof res === 'object' && 'user' in res) ? (res as AnyObj).user : res;
  },
  deleteMe: async () => request('/profile', { method: 'DELETE' }),
  forgot: async (email: string) => request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  reset: async (token: string, password: string) =>
    request('/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) }),
  changePassword: async (currentPassword: string, newPassword: string, token?: string) => {
    if (token) {
      return request('/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
    }
    throw new Error('El endpoint para cambiar contraseña con la sesión no está implementado en el backend');
  },
  socialLogin: async (idToken: string, provider: string) => {
    const result = await request('/login-social', {
      method: 'POST',
      body: JSON.stringify({ idToken, provider })
    });
    if (result?.token) localStorage.setItem('token', result.token);
    return result;
  },
};

export default api;