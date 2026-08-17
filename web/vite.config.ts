import { lookup } from "node:dns/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:8080";
// Parse the host once (e.g. "backend" or "localhost"); the router re-resolves
// it per request so a backend container restart (new IP) never breaks the proxy.
const apiHost = new URL(apiTarget).hostname;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        // http-proxy calls router per request; re-resolve so Vite doesn't pin
        // a stale backend container IP across restarts.
        router: async () => {
          try {
            const { address } = await lookup(apiHost);
            return apiTarget.replace(apiHost, address);
          } catch {
            return apiTarget;
          }
        },
      },
    },
  },
});
