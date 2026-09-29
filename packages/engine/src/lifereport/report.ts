// Informe de vida (spec 020 R-003): lo que pasó (capítulos objetivos), cómo lo cuenta (013), en qué difiere, qué
// hechos cambiaron su vida y qué perfil sale de su historia. Bajo demanda y puro: no cambia el mundo ni el registro.
import type { Chapter } from '../memory/types.ts';
import { divergences, objectiveChapters } from './chapters.ts';
import { emergentProfile } from './profile.ts';
import { turningPoints } from './turning.ts';
import type { DayPoint, Divergence, EmergentProfile, LifeChapter, ReportInput, TurningPoint } from './types.ts';

export interface LifeReport {
  citizenId: string;
  chapters: LifeChapter[];
  remembered: Chapter[];
  divergences: Divergence[];
  turningPoints: TurningPoint[];
  profile: EmergentProfile;
  trajectory: DayPoint[];
}

export function lifeReport(input: ReportInput): LifeReport {
  const chapters = objectiveChapters(input);
  const remembered = JSON.parse(JSON.stringify(input.view.citizens.get(input.id)?.memory?.chapters ?? [])) as Chapter[];
  remembered.sort((a, b) => a.from - b.from);
  return {
    citizenId: input.id,
    chapters,
    remembered,
    divergences: divergences(chapters, remembered, input.now),
    turningPoints: turningPoints(input),
    profile: emergentProfile(input),
    trajectory: [...input.trajectory],
  };
}
