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
    const url = `${BASE}${path}`;
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
    const message = (data && typeof data === 'object' && (data.message || data.error)) || res.statusText || (typeof data === 'string' ? data : undefined);
    console.error('[api] ERROR RESPONSE', { url: `${BASE}${path}`, status: res.status, data });
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
  signup: async (data: AnyObj) => request('/api/register', { method: 'POST', body: JSON.stringify(data) }),
  login: async (email: string, password: string) => {
    const result = await request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result?.token) localStorage.setItem('token', result.token);
    return result;
  },
  logout: () => {
    localStorage.removeItem('token');
    return { ok: true };
  },
  me: async () => request('/api/profile', { method: 'GET' }),
  updateMe: async (data: AnyObj) => request('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
  deleteMe: async () => request('/api/profile', { method: 'DELETE' }),
  forgot: async (email: string) => request('/api/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  reset: async (token: string, password: string) =>
    request('/api/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) }),
  changePassword: async (currentPassword: string, newPassword: string, token?: string) => {
    if (token) {
      return request('/api/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
    }
    throw new Error('El endpoint para cambiar contraseña con la sesión no está implementado en el backend');
  },
  socialLogin: async (idToken: string, provider: string) => {
    const result = await request('/api/login-social', { 
      method: 'POST', 
      body: JSON.stringify({ idToken, provider }) 
    });
    if (result?.token) localStorage.setItem('token', result.token);
    return result;
  },
};

export default api;