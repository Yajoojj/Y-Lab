import { defineConfig } from "vite";

// YLAB_WEB_PORT / YLAB_PORT permitem rodar uma segunda cópia ao lado da principal
const webPort = Number(process.env.YLAB_WEB_PORT) || 5173;
const hubPort = Number(process.env.YLAB_PORT) || 7077;

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    fs: { allow: [".."] },
    proxy: {
      "/api": { target: `http://127.0.0.1:${hubPort}`, changeOrigin: true },
    },
  },
});
