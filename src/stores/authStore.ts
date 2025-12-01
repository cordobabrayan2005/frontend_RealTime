import { create } from 'zustand';
import { api } from '../services/api';
import { auth, googleProvider, githubProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

/**
 * Represents a user object returned from the backend.
 * 
 * @interface User
 * @property {string} id - Unique identifier of the user.
 * @property {string} email - User's email address.
 * @property {string} name - User's first name.
 * @property {string} lastname - User's last name.
 * @property {number} age - User's age.
 * 
 * @note Password and confirmPassword are intentionally excluded
 *       since they are not returned in API responses.
 */
interface User {
  id: string;
  email: string;
  name: string;
  lastname: string;
  age: number; 
  // It does not include password/confirmPassword, as these are not returned in responses
}

/**
 * Authentication state and actions managed by Zustand.
 * 
 * @interface AuthState
 * @property {User | null} user - Currently authenticated user, or null if not logged in.
 * @property {string | null} token - JWT or session token stored in localStorage.
 * @property {boolean} isLoading - Indicates if an authentication request is in progress.
 * @property {string | null} error - Error message from failed authentication attempts.
 * @property {boolean} isAuthed - Flag to protect routes, true if user is authenticated.
 * @property {(email: string, password: string) => Promise<void>} login - Logs in with email/password.
 * @property {(provider: 'google' | 'github') => Promise<void>} socialLogin - Logs in using a social provider.
 * @property {() => void} logout - Logs out and clears local state.
 * @property {() => void} checkAuth - Verifies token on app load and updates state.
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthed: boolean;  // Para proteger rutas
  login: (email: string, password: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'github') => Promise<void>;
  logout: () => void;
  checkAuth: () => void;  // Verify token when loading app
}

/**
 * Zustand store for authentication.
 * 
 * Provides login, social login, logout, and token validation functionality.
 * Persists token in localStorage and updates state accordingly.
 * 
 * @returns {AuthState} Authentication state and actions.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,
  isAuthed: !!localStorage.getItem('token'),  // Token-based

   /**
   * Logs in a user with email and password.
   * 
   * @async
   * @function login
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   * @returns {Promise<void>} Resolves when login completes.
   */
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.login(email, password);
      let user = result.user;
      // Si el backend no devuelve user en login, intentar obtenerlo vía /profile
      if (!user) {
        try {
          user = await api.me();
        } catch (e) {
          /* ignorar error de perfil, se puede reintentar en Profile */
        }
      }
      set({ user: user || null, token: result.token, isAuthed: true, isLoading: false });
    } catch (err: any) {
      // Propaga el error para que la UI no navegue como si fuera éxito
      set({ error: err.message, isLoading: false, isAuthed: false });
      throw err;
    }
  },

  /**
   * Logs in a user using a social provider (Google or GitHub).
   * 
   * @async
   * @function socialLogin
   * @param {'google' | 'github'} provider - Social provider to use.
   * @returns {Promise<void>} Resolves when login completes.
   */
  socialLogin: async (provider: 'google' | 'github') => {
    set({ isLoading: true, error: null });
    try {
      const firebaseProvider = provider === 'google' ? googleProvider : githubProvider;
      const result = await signInWithPopup(auth, firebaseProvider);
      const idToken = await result.user.getIdToken();
      
      // Envía idToken al backend
      const backendResult = await api.socialLogin(idToken, provider);
      set({ user: backendResult.user, token: backendResult.token, isAuthed: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false, isAuthed: false });
      throw err;
    }
  },

  /**
   * Logs out the current user.
   * 
   * @function logout
   * @returns {void}
   */
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthed: false, error: null });
  },

  /**
   * Checks authentication status by verifying token in localStorage.
   * Optionally calls `api.me()` to validate and set user data.
   * 
   * @function checkAuth
   * @returns {void}
   */
  checkAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      // Opcional: Llama a api.me() para validar y setear user
      set({ token, isAuthed: true });
    } else {
      set({ isAuthed: false });
    }
  },
}));