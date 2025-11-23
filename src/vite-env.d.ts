/// <reference types="vite/client" />

// Extend ImportMetaEnv with known VITE_ variables used in the app
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // more env vars can be added here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
