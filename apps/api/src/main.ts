// Proceso de la API (spec 022): `pnpm api [--db data/world.db] [--port 8787]`. Sondea la base cada segundo (R-006).
import { parseArgs } from 'node:util';
import { buildApi } from './server.ts';

const { values: v } = parseArgs({
  options: {
    db: { type: 'string', default: 'data/world.db' },
    port: { type: 'string', default: process.env.DATAS_WORLD_API_PORT ?? '8787' },
  },
});
const user = process.env.DATAS_WORLD_USER;
const password = process.env.DATAS_WORLD_PASSWORD;
const api = buildApi({ db: v.db!, ...(user && password ? { auth: { user, password } } : {}) });
const timer = setInterval(api.poll, 1000);
// 043 R-019.5: charlas inactivas o cuyo tiempo disponible terminó.
const sweeper = setInterval(() => void api.sweep(), 30_000);
await api.app.listen({ port: Number(v.port), host: '127.0.0.1' });
console.log(`API de Datas World en http://127.0.0.1:${v.port} (base ${v.db}; controles ${user && password ? 'activos' : 'desactivados'})`);
const stop = async () => {
  clearInterval(timer);
  clearInterval(sweeper);
  await api.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
