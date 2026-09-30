// Acceso a los controles y a la charla (spec 022 R-004): usuario y contraseña del laboratorio en un formulario propio
// (no el `prompt` del navegador), guardados solo durante la sesión, y el envío de órdenes con reintento.
import { control } from './api.ts';

const KEY = 'dw-auth';
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

/** Muestra el formulario de acceso; `true` si se dieron usuario y contraseña. */
export function askAuth(): Promise<boolean> {
  const dialog = document.querySelector<HTMLDialogElement>('#login')!;
  const user = document.querySelector<HTMLInputElement>('#login-user')!;
  const pass = document.querySelector<HTMLInputElement>('#login-pass')!;
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
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
    user.focus();
  });
}

export type Command = 'pause' | 'resume' | 'speed' | 'step' | 'advance';

/** Envía una orden; si faltan credenciales, las pide y reintenta. Devuelve un mensaje para mostrar, o null si fue bien. */
export async function send(cmd: Command, arg?: number): Promise<string | null> {
  let code = await control(cmd, arg, credentials);
  if (code === 401) {
    if (!(await askAuth())) return 'Sin acceso a los controles.';
    code = await control(cmd, arg, credentials);
  }
  if (code === 200) return null;
  if (code === 503) return 'Controles desactivados: define DATAS_WORLD_USER y DATAS_WORLD_PASSWORD.';
  if (code === 401) return 'Usuario o contraseña incorrectos.';
  return `No se pudo (${code}).`;
}
