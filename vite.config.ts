import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("firebase")) {
            return "firebase";
          }
          if (id.includes("peerjs")) {
            return "peer";
          }
          if (id.includes("socket.io-client")) {
            return "socket";
          }
          if (id.includes("react-router-dom")) {
            return "router";
          }
          if (id.includes("react")) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
});
