import { create } from 'zustand';
import { api } from '../services/api';
import { auth, googleProvider, githubProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

interface User {
  id: string;
  email: string;
  name: string;
  lastname: string;
  age: number; 
  // No incluye password/confirmPassword, ya que no se devuelven en respuestas
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthed: boolean;  // Para proteger rutas
  login: (email: string, password: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'github') => Promise<void>;
  logout: () => void;
  checkAuth: () => void;  // Verifica token al cargar app
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,
  isAuthed: !!localStorage.getItem('token'),  // Basado en token

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.login(email, password);
      set({ user: result.user, token: result.token, isAuthed: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

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
      set({ error: err.message, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthed: false, error: null });
  },

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