import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Browser talks to Caddy on :80; Caddy proxies to this dev server
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      clientPort: 80,
    },
  },
});
