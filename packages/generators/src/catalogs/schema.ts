// Esquema de los catálogos de datos (ADR-006). Se valida con Zod en el borde: al cargar el archivo.
import { z } from 'zod';

/** Clave jerárquica: `categoria.subcategoria.tipo`, en minúsculas y con guion bajo. */
export const CATALOG_KEY = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

/** Hito (M0–M9) o peldaño (P0–P9) desde el que se puede instanciar una entrada. */
export const SINCE = /^(M|P)\d$/;

export const catalogEntrySchema = z
  .object({
    key: z.string().regex(CATALOG_KEY),
    name: z.string().min(1),
    code: z.string().min(1).optional(), // código oficial (CIIU, CIUO, CINE, DIVIPOLA…)
    since: z.string().regex(SINCE),
    requires: z.array(z.string()).optional(), // capacidades del mundo (spec 001 R-007)
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const catalogSchema = z
  .object({
    name: z.string().regex(/^[a-z_]+$/),
    version: z.string().regex(/^\d{4}\.\d{2}\.\d+$/), // AAAA.MM.n
    source: z.string().min(1),
    entries: z.array(catalogEntrySchema).min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    c.entries.forEach((e, i) => {
      const prev = c.entries[i - 1];
      if (prev && prev.key >= e.key) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries', i, 'key'],
          message: `claves duplicadas o fuera de orden: ${prev.key} ≥ ${e.key}`,
        });
      }
    });
  });

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type Catalog = z.infer<typeof catalogSchema>;
