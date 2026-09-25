// Emociones que disparan los hechos (spec 010 R-005). El sistema que produce el evento pide también estos
// parches, para que la emoción llegue en el mismo tick que el hecho y con la personalidad (009) como filtro.
import type { EventType } from '../events.ts';
import type { Patch, WorldView } from '../simulation/system.ts';
import { legacyTraits } from '../temperament/legacy.ts';

type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'shame';

/** Intensidad base de cada emoción por tipo de evento (estimado; revisar con expertos, como la tabla de 009). */
export const EVENT_EMOTIONS: Readonly<Partial<Record<EventType, Partial<Record<Emotion, number>>>>> = Object.freeze({
  JOB_LOST: { sadness: 0.6, fear: 0.5, shame: 0.3 },
  JOB_HIRED: { joy: 0.6 },
  FELL_ILL: { sadness: 0.2, fear: 0.1 },
  RECOVERED: { joy: 0.2 },
});

/**
 * Parches que suben las emociones de una persona por un evento: las negativas se amplifican con el
 * neuroticismo (× (0,5 + N)) y la alegría con la extraversión (× (0,5 + E)). Nunca bajan una emoción.
 */
export function emotionPatches(view: WorldView, row: number, type: EventType): Patch[] {
  const table = EVENT_EMOTIONS[type];
  if (!table) return [];
  const f = view.components.f32;
  const { neuroticism: n, extraversion: e } = legacyTraits(view, row); // @deprecated: funciones elicitadas en MF2
  return Object.entries(table).map(([emotion, base]) => {
    const column = `emo.${emotion}`;
    const k = emotion === 'joy' ? 0.5 + e : 0.5 + n;
    return { op: 'set', type: 'f32', column, row, value: Math.min(1, Math.max(f[column]![row]!, base * k)) } as Patch;
  });
}
