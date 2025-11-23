import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

/**
 * Firebase configuration object.
 * 
 * Values are injected from environment variables defined in `.env` file.
 * These variables are prefixed with `VITE_` for use in Vite-based projects.
 * 
 * @constant
 * @property {string} apiKey - API key for Firebase project.
 * @property {string} authDomain - Authentication domain for Firebase project.
 * @property {string} projectId - Unique Firebase project ID.
 * @property {string} storageBucket - Cloud storage bucket for Firebase project.
 * @property {string} messagingSenderId - Sender ID for Firebase Cloud Messaging.
 * @property {string} appId - Unique app identifier for Firebase project.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Initializes the Firebase application with the provided configuration.
 * 
 * @constant
 * @type {import('firebase/app').FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication instance.
 * Used to manage user authentication state and operations.
 * 
 * @constant
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

/**
 * Google authentication provider.
 * Used for signing in users with their Google accounts.
 * 
 * @constant
 * @type {import('firebase/auth').GoogleAuthProvider}
 */
export const googleProvider = new GoogleAuthProvider();

/**
 * GitHub authentication provider.
 * Used for signing in users with their GitHub accounts.
 * 
 * @constant
 * @type {import('firebase/auth').GithubAuthProvider}
 */
export const githubProvider = new GithubAuthProvider();