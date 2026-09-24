// Parámetros de la spec 027 §8 que usa el M0. COMPACT_AFTER_DAYS llega con la compactación (M4).

/** R-002: el worker hace flush cada FLUSH_TICKS ticks (12 × 5 min = 1 h de mundo) o al pausar. */
export const FLUSH_TICKS = 12;

/** R-004: una instantánea completa cada SNAPSHOT_EVERY_DAYS días de mundo. */
export const SNAPSHOT_EVERY_DAYS = 1;
