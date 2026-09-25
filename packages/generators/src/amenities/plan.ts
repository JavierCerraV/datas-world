// Dotación urbana (spec 033 R-001 a R-003): qué lugares corresponden a una población y dónde van.
// Sin azar: todo sale de las reglas `amenity` del catálogo y del orden de la plantilla.
import type { Catalog } from '../catalogs/schema.ts';
import { COMMERCIAL_LOT, plots } from '../geography/template.ts';
import type { MapTemplate, PlotTemplate } from '../geography/template.ts';

export interface AmenityRule {
  scope: 'local' | 'regional';
  minPopulation: number;
  perInhabitants?: number;
  max?: number;
  law?: string;
  /** `template`: sitio fijo de la plantilla; `com`: parcela comercial libre. */
  placement?: 'template' | 'com';
  /** Repartir las instancias entre barrios (tiendas de barrio). */
  spread?: boolean;
}

export interface AmenityPlan {
  population: number;
  /** Tipos locales y cuántas instancias, en el orden del catálogo. */
  local: { kind: string; count: number; placement: 'template' | 'com' }[];
  /** Tipos regionales: en la ciudad de referencia (033 R-001). */
  regional: string[];
}

const ruleOf = (attrs: unknown): AmenityRule | undefined => (attrs as { amenity?: AmenityRule } | undefined)?.amenity;

/**
 * 033 R-001: un tipo existe si la población llega a `minPopulation`, con `max(1, ⌊población / perInhabitants⌋)`
 * instancias (hasta `max`). Un tipo regional que no llega a su mínimo va a la ciudad de referencia; si llega,
 * pasa a ser local (R-008).
 */
export function amenityPlan(placeKinds: Catalog, population: number): AmenityPlan {
  const plan: AmenityPlan = { population, local: [], regional: [] };
  for (const e of placeKinds.entries) {
    const rule = ruleOf(e.attrs);
    if (!rule) continue;
    if (population < rule.minPopulation) {
      if (rule.scope === 'regional') plan.regional.push(e.key);
      continue;
    }
    const n = rule.perInhabitants ? Math.max(1, Math.floor(population / rule.perInhabitants)) : 1;
    plan.local.push({ kind: e.key, count: Math.min(n, rule.max ?? n), placement: rule.placement ?? 'template' });
  }
  return plan;
}

export interface ResolvedPlots {
  plots: PlotTemplate[];
  /** Instancias que no cupieron en las parcelas comerciales de la plantilla. */
  unplaced: { kind: string; count: number }[];
}

/**
 * 033 R-003: los tipos `template` deben tener su sitio en la plantilla (INV-003); los `com` llenan las parcelas
 * comerciales en orden. Los que se reparten (`spread`) rotan entre barrios. Los de vida nocturna no van a
 * manzanas con viviendas de los estratos prohibidos. Las parcelas comerciales sobrantes pasan a vivienda.
 */
export function resolvePlots(template: MapTemplate, plan: AmenityPlan, placeKinds: Catalog): ResolvedPlots {
  const base = plots(template);
  for (const { kind, placement } of plan.local) {
    if (placement === 'template' && !base.some((p) => p.kind === kind))
      throw new Error(`La plantilla ${template.id} no tiene sitio para ${kind} (033 INV-003)`);
  }
  const districtOf = (p: PlotTemplate) => template.districts.findIndex((d) => p.rect.y >= d.rows[0] && p.rect.y < d.rows[1]);
  const blockHasResidential = (p: PlotTemplate, strata: readonly number[]) =>
    base.some(
      (q) =>
        q.row === p.row &&
        q.col === p.col &&
        q.kind === 'vivienda.edificio' &&
        strata.includes(template.districts[districtOf(q)]!.stratum),
    );
  const free = base.filter((p) => p.kind === COMMERCIAL_LOT);
  const taken = new Map<PlotTemplate, string>();
  const unplaced: ResolvedPlots['unplaced'] = [];
  let rotation = 0;
  type ComAttrs = { noResidentialStratum?: number[]; amenity?: AmenityRule } | undefined;
  const attrsOf = (kind: string) => placeKinds.entries.find((e) => e.key === kind)?.attrs as ComAttrs;
  // Primero los que se reparten entre barrios (tiendas), para que cada barrio tenga los suyos; luego el resto.
  const demands = plan.local
    .filter((d) => d.placement === 'com')
    .sort((a, b) => Number(Boolean(attrsOf(b.kind)?.amenity?.spread)) - Number(Boolean(attrsOf(a.kind)?.amenity?.spread)));
  for (const { kind, count } of demands) {
    const attrs = attrsOf(kind);
    const allowed = (p: PlotTemplate) =>
      !taken.has(p) && !(attrs?.noResidentialStratum && blockHasResidential(p, attrs.noResidentialStratum));
    let missing = 0;
    for (let i = 0; i < count; i++) {
      let slot: PlotTemplate | undefined;
      if (attrs?.amenity?.spread) {
        // Rota por barrios: el primer hueco libre del siguiente barrio que tenga uno.
        for (let k = 0; k < template.districts.length && !slot; k++) {
          const d = (rotation + k) % template.districts.length;
          slot = free.find((p) => allowed(p) && districtOf(p) === d);
          if (slot) rotation = d + 1;
        }
      } else slot = free.find(allowed);
      if (slot) taken.set(slot, kind);
      else missing++;
    }
    if (missing > 0) unplaced.push({ kind, count: missing });
  }
  const resolved = base.map((p) =>
    p.kind === COMMERCIAL_LOT ? { ...p, kind: taken.get(p) ?? 'vivienda.edificio' } : p,
  );
  return { plots: resolved, unplaced };
}
