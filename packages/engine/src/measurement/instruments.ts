// Catálogo de instrumentos (spec 046 R-001): ítems, escalas, corrección e interpretación tal como los publica el
// ClinikLab de la Universidad Konrad Lorenz (https://la.konradlorenz.edu.co/wp-content/uploads/2025/09/…).

export type InstrumentId = 'AAQ-II' | 'GHQ-12' | 'GPQ-9' | 'GTQ' | 'DASS-21' | 'SWLS';
export const INSTRUMENT_IDS: readonly InstrumentId[] = ['AAQ-II', 'GHQ-12', 'GPQ-9', 'GTQ', 'DASS-21', 'SWLS'];

export interface InstrumentItem {
  n: number;
  text: string;
  subscale?: 'depresion' | 'ansiedad' | 'estres';
  /** Opciones del ítem, de la menor (`min`) a la mayor (`max`); si no hay, las de la escala. */
  options?: readonly string[];
}

export interface Cutoff {
  label: string;
  from: number;
  to: number;
  subscale?: string;
}

export interface Instrument {
  id: InstrumentId;
  name: string;
  min: number;
  max: number;
  /** Instrucción de la ficha, para quien aplica la prueba. */
  instruction: string;
  /** Opciones de la escala (de `min` a `max`) cuando son las mismas en todos los ítems. */
  scale: readonly string[];
  items: readonly InstrumentItem[];
  /** Subescalas con puntuación propia (DASS-21). */
  subscales?: readonly ('depresion' | 'ansiedad' | 'estres')[];
  cutoffs: readonly Cutoff[];
  /** Sentido de la puntuación, en palabras (para el informe). */
  higher: string;
  source: string;
}

const BASE = 'https://la.konradlorenz.edu.co/wp-content/uploads/2025/09/';
const TRUE7 = ['Nunca es verdad', 'Muy raramente es verdad', 'Raramente es verdad', 'A veces es verdad', 'Frecuentemente es verdad', 'Casi siempre es verdad', 'Siempre es verdad'];
const TRUE7_INSTR = 'Puntúe en qué grado cada afirmación ES VERDAD PARA USTED, de 1 («Nunca es verdad») a 7 («Siempre es verdad»).';
const items = (texts: readonly string[]): InstrumentItem[] => texts.map((text, i) => ({ n: i + 1, text }));

const AAQ: Instrument = {
  id: 'AAQ-II', name: 'Acceptance and Action Questionnaire-II (evitación experiencial)', min: 1, max: 7, instruction: TRUE7_INSTR, scale: TRUE7,
  items: items([
    'Mis experiencias y recuerdos dolorosos hacen que me sea difícil vivir la vida que querría.',
    'Tengo miedo de mis sentimientos.',
    'Me preocupa no ser capaz de controlar mis preocupaciones y sentimientos.',
    'Mis recuerdos dolorosos me impiden llevar una vida plena.',
    'Mis emociones interfieren en cómo me gustaría que fuera mi vida.',
    'Parece que la mayoría de la gente lleva su vida mejor que yo.',
    'Mis preocupaciones interfieren en el camino de lo que quiero conseguir.',
  ]),
  cutoffs: [{ label: 'sin problema clínico (promedio 18–23)', from: 7, to: 23 }, { label: 'zona intermedia (24–29)', from: 24, to: 29 }, { label: 'clínico (más de 29)', from: 30, to: 49 }],
  higher: 'mayor evitación experiencial', source: `${BASE}aaq-ii-1.pdf`,
};

const worse = (a: string, b: string, c: string, d: string) => [a, b, c, d];
const GHQ_ITEMS: InstrumentItem[] = [
  { n: 1, text: '¿Ha podido concentrarse bien en lo que hace?', options: worse('Mejor que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual') },
  { n: 2, text: '¿Sus preocupaciones le han hecho perder mucho el sueño?', options: worse('No, en absoluto', 'Igual que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 3, text: '¿Ha sentido que está desempeñando un papel útil en la vida?', options: worse('Más que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual') },
  { n: 4, text: '¿Se ha sentido capaz de tomar decisiones?', options: worse('Más capaz que lo habitual', 'Igual que lo habitual', 'Menos capaz que lo habitual', 'Mucho menos capaz que lo habitual') },
  { n: 5, text: '¿Se ha sentido constantemente agobiado y en tensión?', options: worse('No, en absoluto', 'Igual que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 6, text: '¿Ha sentido que no puede superar sus dificultades?', options: worse('No, en absoluto', 'Igual que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 7, text: '¿Ha sido capaz de disfrutar de sus actividades normales de cada día?', options: worse('Más que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual') },
  { n: 8, text: '¿Ha sido capaz de hacer frente adecuadamente a sus problemas?', options: worse('Más capaz que lo habitual', 'Igual que lo habitual', 'Menos capaz que lo habitual', 'Mucho menos capaz que lo habitual') },
  { n: 9, text: '¿Se ha sentido poco feliz o deprimido/a?', options: worse('No, en absoluto', 'No más que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 10, text: '¿Ha perdido confianza en sí mismo/a?', options: worse('No, en absoluto', 'No más que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 11, text: '¿Ha pensado que usted es una persona que no vale para nada?', options: worse('No, en absoluto', 'No más que lo habitual', 'Más que lo habitual', 'Mucho más que lo habitual') },
  { n: 12, text: '¿Se siente razonablemente feliz considerando todas las circunstancias?', options: worse('Más feliz que lo habitual', 'Igual que lo habitual', 'Menos feliz que lo habitual', 'Mucho menos feliz que lo habitual') },
];
const GHQ: Instrument = {
  id: 'GHQ-12', name: 'General Health Questionnaire-12 (malestar emocional)', min: 0, max: 3,
  instruction: 'Cómo ha estado de salud en las ÚLTIMAS semanas; elija la respuesta que mejor se ajuste a su experiencia (0 a 3).',
  scale: ['0', '1', '2', '3'], items: GHQ_ITEMS,
  cutoffs: [{ label: 'sin indicio de malestar (0–11)', from: 0, to: 11 }, { label: 'posible trastorno emocional (12 o más)', from: 12, to: 36 }],
  higher: 'mayor sintomatología emocional', source: `${BASE}ghq-12-1.pdf`,
};

const GPQ: Instrument = {
  id: 'GPQ-9', name: 'Generalized Pliance Questionnaire (pliance generalizado)', min: 1, max: 7, instruction: TRUE7_INSTR, scale: TRUE7,
  items: items([
    'Me importa mucho lo que piensan mis amigos de mí.',
    'Es muy importante para mí sentirme aceptado por los demás.',
    'Necesito que la gente me valore para poder ser feliz.',
    'Mi valía como persona depende de lo que los demás piensen y digan de mí.',
    'Mis decisiones se ven muy influidas por las opiniones de otras personas.',
    'Carecería de sentido lo que hago si los demás no pudieran verlo.',
    'Sólo merece la pena trabajar duro si los demás te lo reconocen.',
    'Para estar bien conmigo mismo necesito que los demás me den su aprobación.',
    'Tengo más en cuenta el consejo de los demás que mi propio criterio para tomar una decisión.',
  ]),
  cutoffs: [{ label: 'no clínico (promedio 20–25)', from: 9, to: 25 }, { label: 'zona intermedia (26–27)', from: 26, to: 27 }, { label: 'clínico (más de 27)', from: 28, to: 63 }],
  higher: 'mayor seguimiento de reglas tipo pliance', source: `${BASE}gpq-version-9-items-1.pdf`,
};

const GTQ: Instrument = {
  id: 'GTQ', name: 'Generalized Tracking Questionnaire (tracking generalizado)', min: 1, max: 7, instruction: TRUE7_INSTR, scale: TRUE7,
  items: items([
    'Cuando veo que algo no está funcionando, intento algo diferente.',
    'Disfruto descubriendo cómo funcionan las cosas y llegando a mis propias conclusiones.',
    'Me adapto fácilmente a los cambios.',
    'Tengo facilidad para encontrar soluciones novedosas a los problemas.',
    'Tomo decisiones basándome en mi experiencia y no en lo que los demás dicen.',
    'Me gusta probar distintas maneras de hacer las cosas para ver cuál es mejor.',
    'Soy bueno encontrando formas más efectivas de realizar tareas.',
    'Si noto que algo no funciona, cambio mi forma de actuar rápidamente.',
    'Aprendo de las consecuencias de mis acciones con facilidad.',
    'Cuando me doy cuenta de que estoy equivocado, cambio mi forma de pensar y actuar.',
    'Tomo decisiones basándome en los resultados que he obtenido anteriormente.',
  ]),
  // La ficha da solo dos promedios (clínicos 48, no clínicos 58): el corte es el punto medio, no un corte de la ficha.
  cutoffs: [{ label: 'más cerca del promedio clínico (48)', from: 11, to: 52 }, { label: 'más cerca del promedio no clínico (58)', from: 53, to: 77 }],
  higher: 'mayor seguimiento de reglas tipo tracking', source: `${BASE}gtq.pdf`,
};

const D = 'depresion', A = 'ansiedad', E = 'estres';
const DASS_TEXT: readonly [string, 'depresion' | 'ansiedad' | 'estres'][] = [
  ['Me ha costado mucho descargar la tensión', E], ['Me di cuenta que tenía la boca seca', A], ['No podía sentir ningún sentimiento positivo', D],
  ['Se me hizo difícil respirar', A], ['Se me hizo difícil tomar la iniciativa para hacer cosas', D], ['Reaccioné exageradamente en ciertas situaciones', E],
  ['Sentí que mis manos temblaban', A], ['He sentido que estaba gastando una gran cantidad de energía', E],
  ['Estaba preocupado por situaciones en las cuales podía tener pánico o en las que podría hacer el ridículo', A],
  ['He sentido que no había nada que me ilusionara', D], ['Me he sentido inquieto', E], ['Se me hizo difícil relajarme', E], ['Me sentí triste y deprimido', D],
  ['No toleré nada que no me permitiera continuar con lo que estaba haciendo', E], ['Sentí que estaba al punto de pánico', A], ['No me pude entusiasmar por nada', D],
  ['Sentí que valía muy poco como persona', D], ['He tendido a sentirme enfadado con facilidad', E],
  ['Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico', A], ['Tuve miedo sin razón', A], ['Sentí que la vida no tenía ningún sentido', D],
];
const DASS: Instrument = {
  id: 'DASS-21', name: 'Depression Anxiety Stress Scale-21', min: 0, max: 3,
  instruction: 'En qué grado le ha ocurrido cada afirmación durante la semana pasada.',
  scale: ['No me ha ocurrido', 'Me ha ocurrido un poco, o durante parte del tiempo', 'Me ha ocurrido bastante, o durante una buena parte del tiempo', 'Me ha ocurrido mucho, o la mayor parte del tiempo'],
  items: DASS_TEXT.map(([text, subscale], i) => ({ n: i + 1, text, subscale })),
  subscales: ['depresion', 'ansiedad', 'estres'],
  cutoffs: [
    { subscale: 'depresion', label: 'normal', from: 0, to: 4 }, { subscale: 'depresion', label: 'depresión leve', from: 5, to: 6 }, { subscale: 'depresion', label: 'depresión moderada', from: 7, to: 10 },
    { subscale: 'depresion', label: 'depresión severa', from: 11, to: 13 }, { subscale: 'depresion', label: 'depresión extremadamente severa', from: 14, to: 21 },
    { subscale: 'ansiedad', label: 'normal', from: 0, to: 3 }, { subscale: 'ansiedad', label: 'ansiedad leve', from: 4, to: 4 }, { subscale: 'ansiedad', label: 'ansiedad moderada', from: 5, to: 7 },
    { subscale: 'ansiedad', label: 'ansiedad severa', from: 8, to: 9 }, { subscale: 'ansiedad', label: 'ansiedad extremadamente severa', from: 10, to: 21 },
    { subscale: 'estres', label: 'normal', from: 0, to: 7 }, { subscale: 'estres', label: 'estrés leve', from: 8, to: 9 }, { subscale: 'estres', label: 'estrés moderado', from: 10, to: 12 },
    { subscale: 'estres', label: 'estrés severo', from: 13, to: 16 }, { subscale: 'estres', label: 'estrés extremadamente severo', from: 17, to: 21 },
  ],
  higher: 'mayor sintomatología', source: `${BASE}dass-21-2.pdf`,
};

const SWLS: Instrument = {
  id: 'SWLS', name: 'Satisfaction With Life Scale', min: 1, max: 7,
  instruction: 'Grado de acuerdo con cada frase, de 1 («Totalmente en desacuerdo») a 7 («Totalmente de acuerdo»). Sea honesto al responder.',
  scale: ['Totalmente en desacuerdo', 'En desacuerdo', 'Ligeramente en desacuerdo', 'Ni de acuerdo ni en desacuerdo', 'Ligeramente de acuerdo', 'De acuerdo', 'Totalmente de acuerdo'],
  items: items([
    'En la mayoría de los aspectos mi vida es como quiero que sea.',
    'Hasta ahora he conseguido de la vida las cosas que considero importantes.',
    'Estoy satisfecho con mi vida.',
    'Si pudiera vivir mi vida otra vez, la repetiría tal y como ha sido.',
    'Las circunstancias de mi vida son buenas.',
  ]),
  cutoffs: [
    { label: 'extremadamente insatisfecho', from: 5, to: 9 }, { label: 'insatisfecho', from: 10, to: 14 }, { label: 'ligeramente por debajo del promedio', from: 15, to: 19 },
    { label: 'promedio en satisfacción', from: 20, to: 24 }, { label: 'alta satisfacción', from: 25, to: 29 }, { label: 'muy alta satisfacción', from: 30, to: 35 },
  ],
  higher: 'mayor satisfacción con la vida', source: `${BASE}swls-1.pdf`,
};

export const INSTRUMENTS: Readonly<Record<InstrumentId, Instrument>> = Object.freeze({ 'AAQ-II': AAQ, 'GHQ-12': GHQ, 'GPQ-9': GPQ, GTQ, 'DASS-21': DASS, SWLS });

/** Opciones de un ítem, de la menor a la mayor. */
export const optionsOf = (ins: Instrument, item: InstrumentItem): readonly string[] => item.options ?? ins.scale;
