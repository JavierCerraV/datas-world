// Piezas comunes del trabajo (spec 006): columnas, parámetros y los cambios de empleo como parches, para que
// dos despidos o contrataciones en la misma organización y el mismo día no se pisen.
import { defineColumn } from '../components.ts';
import { formatId } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { emotionPatches } from '../needs/emotions.ts';
import { profileEntry, profileValue } from '../profile.ts';
import type { CountryProfile } from '../profile.ts';
import type { DeepReadonly, Patch, SystemEvent, WorldView } from '../simulation/system.ts';
import type { Occupation, Position, World } from '../world.ts';

/** `work.lastLateEvt`: número del último `ARRIVED_LATE` a su trabajo (lo anota la movilidad); `work.lastLateMin`, sus minutos; `work.seenLateEvt`, el último procesado. */
export const WORK_COLUMNS = ['work.lastLateEvt', 'work.lastLateMin', 'work.seenLateEvt'] as const;

export function defineWorkColumns(world: World): void {
  for (const name of WORK_COLUMNS) if (!(name in world.components.i32)) defineColumn(world.components, 'i32', name, 0);
}

export interface WorkParams {
  warnLimit: number;
  lateTolerance: number;
  warnWindowDays: number;
  crisisDays: number;
  crisisStepDays: number;
  hireDailyP: number;
}

/** 006 §8: `WARN_LIMIT` = 3; tolerancia de 10 min (prototipo `arriveWork`); crisis a los 60 días; el resto [M]. */
const DEFAULTS: WorkParams = { warnLimit: 3, lateTolerance: 10, warnWindowDays: 30, crisisDays: 60, crisisStepDays: 30, hireDailyP: 0.2 };

export function workParams(profile: CountryProfile | DeepReadonly<CountryProfile> | undefined, date: string): WorkParams {
  const p = profile as CountryProfile | undefined;
  if (!p || !profileEntry(p, 'work.market', date)) return DEFAULTS;
  return { ...DEFAULTS, ...(profileValue(p, 'work.market', date) as Partial<WorkParams>) };
}

/** Cambios de empleo acumulados en una corrida: puestos por organización (copias) y parches de las personas. */
export class JobChanges {
  #positions = new Map<EntityId, Position[]>();
  readonly patches: Patch[] = [];
  readonly events: SystemEvent[] = [];
  readonly view: WorldView;
  constructor(view: WorldView) {
    this.view = view;
  }

  positionsOf(orgId: EntityId): Position[] {
    // Copia profunda por JSON: con la vista congelada (021) los objetos anidados son Proxies que no se pueden clonar.
    if (!this.#positions.has(orgId)) this.#positions.set(orgId, JSON.parse(JSON.stringify(this.view.organizations.get(orgId)!.positions)) as Position[]);
    return this.#positions.get(orgId)!;
  }

  /** Despido (006 R-006): libera el puesto, la persona queda desempleada desde ahora, y la tristeza y el miedo de 010 R-005. */
  fire(row: number, reason: string, causes: SystemEvent['causes']): void {
    const id = formatId('CIT', row);
    const occ = this.view.citizens.get(id)?.occupation;
    if (occ?.kind !== 'formal') return;
    const pos = this.positionsOf(occ.orgId).find((p) => p.id === occ.positionId);
    if (pos) delete pos.holderId;
    const now: Occupation = { kind: 'none', reason: 'unemployed', since: this.view.now };
    this.patches.push({ op: 'entity', id, fields: { occupation: now, jobRecord: { lates: [] } } });
    this.patches.push(...emotionPatchesIf(this.view, row, 'JOB_LOST'));
    this.events.push({ type: 'JOB_LOST', payload: { citizenId: id, reason }, participants: [{ id, role: 'empleado' }, { id: occ.orgId, role: 'empleador' }], causes });
  }

  /** Contratación (006 R-007) en un puesto libre, con su turno en la rutina (011: se levanta 85 min antes). */
  hire(row: number, orgId: EntityId, positionId: string, causes: SystemEvent['causes']): void {
    const id = formatId('CIT', row);
    const pos = this.positionsOf(orgId).find((p) => p.id === positionId)!;
    pos.holderId = id;
    this.patches.push({ op: 'entity', id, fields: { occupation: { kind: 'formal', orgId, positionId } as Occupation } });
    if ('routine.wakeW' in this.view.components.i32) {
      const wakeW = pos.shift.start - 85;
      this.patches.push({ op: 'set', type: 'i32', column: 'routine.wakeW', row, value: wakeW });
    }
    this.patches.push(...emotionPatchesIf(this.view, row, 'JOB_HIRED'));
    const org = this.view.organizations.get(orgId)!;
    this.events.push({
      type: 'JOB_HIRED',
      payload: { citizenId: id, orgId, positionId, orgName: org.name },
      participants: [{ id, role: 'empleado' }, { id: orgId, role: 'empleador' }],
      causes,
    });
  }

  /** Parches de las organizaciones tocadas, al final (un parche por organización). */
  finish(): Patch[] {
    const out: Patch[] = [];
    for (const [orgId, positions] of [...this.#positions].sort((a, b) => (a[0] < b[0] ? -1 : 1))) out.push({ op: 'entity', id: orgId, fields: { positions } });
    return [...this.patches, ...out];
  }
}

const emotionPatchesIf = (view: WorldView, row: number, type: 'JOB_LOST' | 'JOB_HIRED'): Patch[] =>
  'emo.sadness' in view.components.f32 ? emotionPatches(view, row, type) : [];
