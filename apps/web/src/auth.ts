// Acceso a los controles y a la charla (spec 022 R-004): usuario y contraseña del laboratorio en un formulario propio
// (no el `prompt` del navegador), guardados solo durante la sesión, y el envío de órdenes con reintento.
import { control } from './api.ts';

const KEY = 'dw-auth';
const MAX_TRIES = 3;
let credentials: string | null = read();

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Credenciales en base64 para `Authorization: Basic`, o ninguna. */
export const auth = (): string | null => credentials;

/** Olvida las credenciales guardadas (porque la API las rechazó). */
function forget(): void {
  credentials = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: nada que olvidar */
  }
}

/**
 * Muestra el formulario de acceso; `true` si se dieron usuario y contraseña. Enter en la contraseña entra: el botón
 * «Cancelar» es de tipo `button` para que no sea el que envía el formulario por defecto.
 */
export function askAuth(error?: string): Promise<boolean> {
  const dialog = document.querySelector<HTMLDialogElement>('#login')!;
  const user = document.querySelector<HTMLInputElement>('#login-user')!;
  const pass = document.querySelector<HTMLInputElement>('#login-pass')!;
  const note = document.querySelector<HTMLElement>('#login-error')!;
  note.textContent = error ?? '';
  note.hidden = !error;
  return new Promise((resolve) => {
    const stop = new AbortController();
    document.querySelector('#login-cancel')!.addEventListener('click', () => dialog.close('cancel'), { signal: stop.signal });
    dialog.addEventListener(
      'close',
      () => {
        stop.abort();
        if (dialog.returnValue !== 'ok' || !user.value || !pass.value) return resolve(false);
        credentials = btoa(`${user.value}:${pass.value}`);
        pass.value = '';
        try {
          sessionStorage.setItem(KEY, credentials);
        } catch {
          /* sin almacenamiento: se pedirá otra vez */
        }
        resolve(true);
      },
      { once: true },
    );
    dialog.returnValue = '';
    dialog.showModal();
    (error ? pass : user).focus();
  });
}

/**
 * Hace una petición protegida (la devuelve con su `status`). Si la API responde 401, pide las credenciales; si las
 * que se dieron son incorrectas, las olvida y las vuelve a pedir diciéndolo, hasta tres veces.
 */
export async function withAuth<T extends { status: number }>(request: () => Promise<T>): Promise<T> {
  let r = await request();
  for (let n = 0; r.status === 401 && n < MAX_TRIES; n++) {
    const wrong = credentials !== null;
    if (wrong) forget();
    if (!(await askAuth(wrong ? 'Usuario o contraseña incorrectos.' : undefined))) break;
    r = await request();
  }
  return r;
}

export type Command = 'pause' | 'resume' | 'speed' | 'step' | 'advance';

/** Envía una orden; si faltan credenciales, las pide y reintenta. Devuelve un mensaje para mostrar, o null si fue bien. */
export async function send(cmd: Command, arg?: number): Promise<string | null> {
  const { status: code } = await withAuth(async () => ({ status: await control(cmd, arg, credentials) }));
  if (code === 200) return null;
  if (code === 401) return 'Sin acceso a los controles.';
  if (code === 503) return 'Controles desactivados: define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD.';
  return `No se pudo (${code}).`;
}
