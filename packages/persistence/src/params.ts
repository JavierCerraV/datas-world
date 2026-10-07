// Parámetros de la spec 027 §8 que usa el M0. COMPACT_AFTER_DAYS llega con la compactación (M4).

/** R-002: el worker hace flush cada FLUSH_TICKS ticks (12 × 5 min = 1 h de mundo) o al pausar. */
export const FLUSH_TICKS = 12;

/** R-004: una instantánea completa cada SNAPSHOT_EVERY_DAYS días de mundo. */
export const SNAPSHOT_EVERY_DAYS = 1;

/** R-014: flush también si pasan FLUSH_MS de tiempo real con ticks sin guardar. */
export const FLUSH_MS = 2000;

/** R-013: días de mundo de movimientos que se conservan para el visor. */
export const MOVES_KEEP_DAYS = 2;

/** R-015: tiempo real de cada tramo de un avance sin observar. */
export const ADVANCE_SLICE_MS = 250;

/** R-015 (022 R-013): avances sin observar admitidos, en minutos de mundo: 1 día, 1 semana, 1 mes, 3 meses, 6 meses y 1 año. */
export const ADVANCE_MINUTES: readonly number[] = Object.freeze([1440, 10080, 43200, 129600, 259200, 525600]);
