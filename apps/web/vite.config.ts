// Vite del visor (spec 024): sirve apps/web y reenvía /api a la API local (022).
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  server: {
    // Puerto propio del proyecto (5173 lo suelen usar otros proyectos con Vite); si está ocupado, falla en vez de
    // cambiarse a otro en silencio.
    port: Number(process.env.DATAS_WORLD_WEB_PORT ?? 5180),
    strictPort: true,
    host: '127.0.0.1',
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.DATAS_WORLD_API_PORT ?? '8787'}`, changeOrigin: false } },
  },
});
