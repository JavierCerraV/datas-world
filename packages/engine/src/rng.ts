// Azar reproducible del motor (spec 023). xoshiro128** con flujos derivados por nombre.
// Toda la aritmética es de 32 bits sin signo (Math.imul, >>>), idéntica en cualquier plataforma.

const U32 = 4294967296;

export interface Rng {
  /** Uniforme en [0, 1). */
  next(): number;
  /** Entero uniforme en [minIncl, maxIncl], sin sesgo (muestreo por rechazo). */
  int(minIncl: number, maxIncl: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  /** Box–Muller; consume dos valores por llamada. */
  normal(mean: number, sd: number): number;
  /** Flujo derivado estable: depende solo de la clave de este flujo y del nombre, no consume de él. */
  fork(name: string | number): Rng;
  state(): RngState;
}

export interface RngState {
  key: [number, number];
  s: [number, number, number, number];
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** splitmix32: el mismo núcleo que `sm32` del prototipo. Devuelve el siguiente uint32 y el nuevo estado. */
function splitmix32(a: number): [number, number] {
  a = (a + 0x9e3779b9) | 0;
  let t = a ^ (a >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  return [(t ^ (t >>> 15)) >>> 0, a];
}

/** Clave de 64 bits del flujo hijo (variante de cyrb53 sobre las unidades UTF-16 del nombre). */
function hash64(key: readonly [number, number], name: string): [number, number] {
  let h1 = (key[0] ^ 0xdeadbeef) >>> 0;
  let h2 = (key[1] ^ 0x41c6ce57) >>> 0;
  for (let i = 0; i < name.length; i++) {
    const ch = name.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

function seedState(key: readonly [number, number]): [number, number, number, number] {
  const [s0, a1] = splitmix32(key[0]);
  const [s1] = splitmix32(a1);
  const [s2, b1] = splitmix32(key[1] ^ 0x5bd1e995);
  const [s3] = splitmix32(b1);
  // xoshiro no admite el estado todo ceros; splitmix32 no lo produce en la práctica, pero se garantiza.
  return (s0 | s1 | s2 | s3) === 0 ? [1, s1, s2, s3] : [s0, s1, s2, s3];
}

class Xoshiro128ss implements Rng {
  readonly #key: [number, number];
  #s0: number;
  #s1: number;
  #s2: number;
  #s3: number;

  constructor(key: readonly [number, number], s: readonly [number, number, number, number]) {
    if ((s[0] | s[1] | s[2] | s[3]) === 0) throw new Error('Rng: el estado de xoshiro128** no puede ser todo ceros');
    this.#key = [key[0] >>> 0, key[1] >>> 0];
    [this.#s0, this.#s1, this.#s2, this.#s3] = [s[0] >>> 0, s[1] >>> 0, s[2] >>> 0, s[3] >>> 0];
  }

  #uint32(): number {
    const result = Math.imul(rotl(Math.imul(this.#s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.#s1 << 9) >>> 0;
    this.#s2 = (this.#s2 ^ this.#s0) >>> 0;
    this.#s3 = (this.#s3 ^ this.#s1) >>> 0;
    this.#s1 = (this.#s1 ^ this.#s2) >>> 0;
    this.#s0 = (this.#s0 ^ this.#s3) >>> 0;
    this.#s2 = (this.#s2 ^ t) >>> 0;
    this.#s3 = rotl(this.#s3, 11);
    return result;
  }

  next(): number {
    return this.#uint32() / U32;
  }

  int(minIncl: number, maxIncl: number): number {
    if (!Number.isSafeInteger(minIncl) || !Number.isSafeInteger(maxIncl) || maxIncl < minIncl) {
      throw new RangeError(`Rng.int: rango inválido [${minIncl}, ${maxIncl}]`);
    }
    const range = maxIncl - minIncl + 1;
    if (range > U32) throw new RangeError(`Rng.int: el rango supera 2^32 (${range})`);
    const limit = U32 - (U32 % range); // valores >= limit introducirían sesgo
    let u = this.#uint32();
    while (u >= limit) u = this.#uint32();
    return minIncl + (u % range);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('Rng.pick: arreglo vacío');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) {
      if (!Number.isFinite(w) || w < 0) throw new RangeError(`Rng.weighted: peso inválido ${w}`);
      total += w;
    }
    if (total <= 0) throw new RangeError('Rng.weighted: la suma de pesos debe ser > 0');
    let r = this.next() * total;
    let last: T | undefined;
    for (const [item, w] of items) {
      if (w === 0) continue;
      if (r < w) return item;
      r -= w;
      last = item;
    }
    return last as T; // solo por redondeo de coma flotante
  }

  normal(mean: number, sd: number): number {
    const u = 1 - this.next(); // (0, 1]: evita log(0)
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  fork(name: string | number): Rng {
    const key = hash64(this.#key, String(name));
    return new Xoshiro128ss(key, seedState(key));
  }

  state(): RngState {
    return { key: [this.#key[0], this.#key[1]], s: [this.#s0, this.#s1, this.#s2, this.#s3] };
  }
}

/** Flujo raíz de un mundo. La semilla se interpreta como uint32 (spec 001, `WorldConfig.seed`). */
export function createRng(seed: number): Rng {
  if (!Number.isSafeInteger(seed)) throw new RangeError(`createRng: semilla inválida ${seed}`);
  const key: [number, number] = [seed >>> 0, 0x9e3779b9];
  return new Xoshiro128ss(key, seedState(key));
}

/** Reconstruye un flujo desde `state()`: misma clave y mismo punto de la secuencia. */
export function restoreRng(state: RngState): Rng {
  return new Xoshiro128ss(state.key, state.s);
}
