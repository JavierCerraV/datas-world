// Vista de solo lectura del mundo para los sistemas (spec 021 R-007, CA-005). Siempre de solo lectura por
// tipos; con `guard`, además, un Proxy que lanza ante cualquier escritura (solo en pruebas: tiene coste).
import type { World } from '../world.ts';
import type { WorldView } from './system.ts';

const cache = new WeakMap<object, object>();

function guarded<T extends object>(target: T, path: string): T {
  const hit = cache.get(target);
  if (hit) return hit as T;
  const deny = (what: string) => (): never => {
    throw new TypeError(`021 R-007: un sistema intentó ${what} ${path}; debe devolver parches`);
  };
  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      const value = Reflect.get(t, key, receiver === proxy ? t : receiver) as unknown;
      // Lo ya congelado (p. ej. la configuración del mundo) no se puede modificar: se devuelve tal cual, como exige
      // el invariante de Proxy para las propiedades no configurables y no escribibles.
      const desc = Reflect.getOwnPropertyDescriptor(t, key);
      if ((desc && !desc.configurable && !desc.writable) || (value !== null && typeof value === 'object' && Object.isFrozen(value)))
        return value;
      if (typeof value === 'function') {
        // Métodos de Map y de arreglos tipados: se llaman sobre el objeto real, pero los mutadores se bloquean.
        const name = String(key);
        if (['set', 'delete', 'clear', 'fill', 'copyWithin', 'reverse', 'sort', 'push', 'pop', 'shift', 'unshift', 'splice'].includes(name))
          return deny(`modificar (${name})`);
        const fn = value as (...a: unknown[]) => unknown;
        return (...args: unknown[]) => {
          const out = fn.apply(t, args);
          return out !== null && typeof out === 'object' && !(out instanceof Promise) ? guarded(out as object, `${path}.${name}()`) : out;
        };
      }
      return value !== null && typeof value === 'object' ? guarded(value as object, `${path}.${String(key)}`) : value;
    },
    set: deny('escribir en'),
    defineProperty: deny('definir en'),
    deleteProperty: deny('borrar en'),
  });
  cache.set(target, proxy);
  return proxy;
}

/** La vista que recibe un sistema. `guard` = congelar en tiempo de ejecución (modo prueba). */
export function viewOf(world: World, guard: boolean): WorldView {
  return (guard ? guarded(world, 'world') : world) as WorldView;
}
