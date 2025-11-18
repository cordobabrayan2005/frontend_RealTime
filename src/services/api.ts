// src/services/api.ts
// Stubbed API for offline / development mode
// This file replaces real network calls with local, resolved Promises so the frontend
// can function without a backend. All methods keep the original API shape.

type AnyObj = Record<string, any>;

export const api = {
  // Auth básicas (stubs)
  signup: async (data: AnyObj) => {
    return Promise.resolve({ ok: true, user: { id: 'local-user', ...data } });
  },

  login: async (email: string, password: string) => {
    // create a local token so protected routes keep working in the frontend
    const token = 'local-dev-token';
    localStorage.setItem('token', token);
    return Promise.resolve({ token });
  },

  logout: () => {
    localStorage.removeItem('token');
    return { ok: true };
  },

  // Perfil
  me: async () => Promise.resolve({ id: 'local-user', name: 'Usuario Local', email: 'local@example.com' }),
  updateMe: async (data: AnyObj) => Promise.resolve({ id: 'local-user', ...data }),
  deleteMe: async () => Promise.resolve({ ok: true }),

  // Recuperación de contraseña (no-op)
  forgot: async (email: string) => Promise.resolve({ ok: true }),
  reset: async (token: string, password: string, confirmPassword: string) => Promise.resolve({ ok: true }),
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) =>
    Promise.resolve({ ok: true }),

};

export default api;
