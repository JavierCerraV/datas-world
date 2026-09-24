// Carga y validación de perfiles de país (spec 029). Los archivos viven en packages/generators/profiles/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkProfile } from '@datas-world/engine';
import type { CountryProfile, ProfileEntry } from '@datas-world/engine';
import { z } from 'zod';

export const PROFILES_DIR = join(import.meta.dirname, '..', '..', 'profiles');
export const DEFAULT_PROFILE = 'CO-2026.09';
export const PROTOTYPE_PROFILE = 'prototipo';

const entrySchema = z
  .object({
    key: z.string().regex(/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/),
    value: z.union([z.number(), z.string(), z.array(z.number()), z.record(z.string(), z.number())]),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string().min(1),
    status: z.enum(['oficial', 'estimado', 'por_confirmar']),
    scope: z.enum(['nacional', '13ciudades', 'cabecera', 'rural', 'rural_disperso']).optional(),
  })
  .strict();

const profileSchema = z
  .object({
    id: z.string().min(1),
    country: z.string().length(2),
    currency: z.object({ code: z.string().length(3), minorUnit: z.number().int().positive() }).strict(),
    entries: z.array(entrySchema).min(1),
  })
  .strict();

/** Valida un perfil ya leído: forma (Zod) e invariantes de la 029 (`checkProfile` del motor). */
export function parseProfile(data: unknown, label = 'perfil'): CountryProfile {
  const r = profileSchema.safeParse(data);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
    throw new Error(`${label} inválido: ${issues}`);
  }
  const p = r.data as CountryProfile;
  const bad = checkProfile(p);
  if (bad) throw new Error(`${label} inválido: ${bad}`);
  // Orden canónico (clave, alcance, vigencia): el perfil entra en el hash del mundo (ADR-006 §4).
  const order = (e: ProfileEntry) => `${e.key}|${e.scope ?? ''}|${e.validFrom}`;
  p.entries = [...p.entries].sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));
  return p;
}

export function loadProfile(id = DEFAULT_PROFILE, dir = PROFILES_DIR): CountryProfile {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`Id de perfil inválido: ${id}`);
  const p = parseProfile(JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), `${id}.json`);
  if (p.id !== id) throw new Error(`${id}.json declara el id ${p.id}`);
  return p;
}

/** Entradas pendientes de fuente, para `world:info` y `world:report` (029 CA-003). */
export const pendingEntries = (p: CountryProfile): ProfileEntry[] =>
  p.entries.filter((e) => e.status === 'por_confirmar');
