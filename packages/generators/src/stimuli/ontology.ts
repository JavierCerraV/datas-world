// Ontología compartida de estímulos (spec 036 R-004; bloque MF2.1): las clases del catálogo `stimulus_classes` más
// una por tipo de lugar y por actividad de ocio, con los rasgos de su familia.
import { WORLD_STIMULI, createOntology } from '@datas-world/engine';
import type { Ontology, StimulusClass } from '@datas-world/engine';
import type { Catalogs } from '../catalogs/load.ts';
import type { Catalog } from '../catalogs/schema.ts';

type Attrs = { kind?: StimulusClass['kind']; features: number[]; primary?: 1 | -1 };

/** Clases derivadas de un catálogo: `<prefijo>.<clave>`, con los rasgos de `familia.<prefijo>.<categoría>`. */
function derived(catalog: Catalog, prefix: 'lugar' | 'actividad', kind: StimulusClass['kind'], families: ReadonlyMap<string, number[]>): StimulusClass[] {
  return catalog.entries.map((e) => {
    const family = `familia.${prefix}.${e.key.split('.')[0]}`;
    const features = families.get(family);
    if (!features) throw new Error(`stimulus_classes: falta ${family} (para ${e.key})`);
    return { key: `${prefix}.${e.key}`, kind, features };
  });
}

export function buildOntology(catalogs: Catalogs): Ontology {
  const families = new Map<string, number[]>();
  const classes: StimulusClass[] = [];
  for (const e of catalogs.stimulus_classes.entries) {
    const a = e.attrs as Attrs;
    if (e.key.startsWith('familia.')) families.set(e.key, a.features);
    else classes.push({ key: e.key, kind: a.kind ?? 'verbal_term', features: a.features, ...(a.primary ? { primary: a.primary } : {}) });
  }
  classes.push(...derived(catalogs.place_kinds, 'lugar', 'place_kind', families), ...derived(catalogs.leisure_activities, 'actividad', 'activity', families));
  const onto = createOntology(classes);
  for (const k of WORLD_STIMULI) if (!onto.classes.has(k)) throw new Error(`stimulus_classes: falta la clase ${k} que usan las reglas del motor`);
  return onto;
}
