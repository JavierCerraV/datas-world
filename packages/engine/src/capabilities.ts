// Capacidades del mundo y sus dependencias (spec 001 R-007, tabla de §8; ADR-005).

/** Orden canónico: el de esta lista. Se amplía añadiendo al final. */
export const CAPABILITIES = Object.freeze([
  'clock',
  'needs',
  'routines',
  'economy',
  'mobility',
  'relationships',
  'memory',
  'beliefs',
  'learning',
  'consolidation',
  'conflict',
  'lifecourse',
  'reputation',
  'culture',
  'llm',
] as const);

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_DEPS: Readonly<Record<Capability, readonly Capability[]>> = Object.freeze({
  clock: [],
  needs: ['clock'],
  routines: ['needs'],
  economy: ['clock'],
  mobility: ['routines'],
  relationships: ['needs'],
  memory: ['relationships'],
  beliefs: ['memory'],
  // Motor funcional (035 §6, bloque MF2): el aprendizaje directo no necesita la memoria episódica (013).
  learning: ['routines'],
  consolidation: ['memory'],
  conflict: ['relationships', 'memory'],
  lifecourse: ['relationships', 'economy'],
  reputation: ['beliefs'],
  culture: ['reputation', 'learning'],
  llm: ['memory', 'beliefs'],
});

export const isCapability = (v: unknown): v is Capability => (CAPABILITIES as readonly unknown[]).includes(v);

/** Motivo por el que no se puede activar, o null si se puede. */
export function canEnable(active: readonly Capability[], cap: Capability): string | null {
  if (!isCapability(cap)) return `capacidad desconocida: ${String(cap)}`;
  if (active.includes(cap)) return `la capacidad ${cap} ya está activa`;
  const missing = CAPABILITY_DEPS[cap].filter((d) => !active.includes(d));
  return missing.length ? `${cap} requiere ${missing.join(', ')}` : null;
}

export const canonicalOrder = (caps: readonly Capability[]): Capability[] =>
  CAPABILITIES.filter((c) => caps.includes(c));

export function withCapability(active: readonly Capability[], cap: Capability): Capability[] {
  return canonicalOrder([...active, cap]);
}

/** INV-003: orden canónico, sin duplicados y con dependencias. Devuelve el problema o null. */
export function validateCapabilities(caps: readonly Capability[]): string | null {
  if (!caps.every(isCapability)) return 'hay capacidades desconocidas';
  if (new Set(caps).size !== caps.length) return 'hay capacidades duplicadas';
  for (const c of caps) {
    const missing = CAPABILITY_DEPS[c].filter((d) => !caps.includes(d));
    if (missing.length) return `${c} requiere ${missing.join(', ')}`;
  }
  return null;
}
