// Visor A+ (spec 024 v0.5): expediente (CA-014), dashboard (CA-015), capas y panel «Ahora» (CA-016), ficha compacta
// y direcciones de las pantallas.
import { describe, expect, it } from 'vitest';
import { compactCard, criticalNeeds } from './card-compact.ts';
import { niceMax, occupationSvg, pyramidSvg, renderDashboard } from './dashboard.ts';
import type { Demographics, Dossier } from './dossier-types.ts';
import { tabEmociones, tabEstado, tabHistoria, tabResumen } from './exp-tabs.ts';
import type { ExpData } from './exp-tabs.ts';
import { tabAprendizaje, tabCharlas, tabEconomia, tabSalud, tabVinculos } from './exp-tabs2.ts';
import { EXP_TABS, identityStrip, tabId } from './expediente.ts';
import { milestones, placeLabels } from './lifecourse.ts';
import { DEFAULT_LAYERS, drawPlan, nowRows, scaleBar } from './overlays.ts';
import { hrefOf, parseRoute } from './router.ts';
import type { CitizenDetail, EventView } from './types.ts';

const ev = (id: string, type: string, date: string, at: number, payload: Record<string, unknown>, text: string, participants: EventView['participants'] = []): Dossier['events'][number] => ({
  id, type, at, date, payload, text, participants, names: { 'CIT-000019': 'Santiago Osorio Pardo' }, causes: [{ state: 'vacante', value: null, weight: 0.6 }], origin: at < 0,
});

const detail: CitizenDetail = {
  id: 'CIT-000019', name: 'Santiago Osorio Pardo', sex: 'M', age: 40,
  occupation: { kind: 'formal', orgId: 'ORG-0013', positionId: 'ORG-0013/P07', orgName: 'Oficinas Andina' }, household: { id: 'HOU-0007', members: 4 }, money: 2771016,
  activity: 'work', place: { id: 'PLC-0072', name: 'Oficinas Andina' }, moving: false,
  state: { mood: 0.52, stress: 0.3 }, needs: { energy: 0.36, fun: 0.85, hunger: 0.06, hygiene: 0.89, social: 1 }, emotions: { joy: 0, sadness: 0, anger: 0, fear: 0, shame: 0 },
  temperament: { extraversion: 0.51, neuroticism: 0.63 }, learned: { discountK: 0.334, variability: 0.41 },
  functions: [{ stimulus: 'lugar.vivienda.unidad', value: 0.25, trials: 8, sources: [] }], responses: [{ response: 'ocio.entretenimiento.tv_series', strength: 0.6 }],
  rules: [{ response: 'rutina.job_search', consequence: 'verbal.trabajo', kind: 'tracking', speaker: 'comunidad', strength: 0.45, contrast: 0.3, contribution: 0.31 }],
  relations: [{ a: 'rutina.job_search', b: 'verbal.trabajo', type: 'causes', strength: 0.45, context: null }],
  events: [], until: '2026-01-07 17:00',
};

const dossier: Dossier = {
  id: 'CIT-000019',
  identity: { birthDate: '1985-10-20', birthplace: 'el campo', education: 'Tecnológica', arrived: { date: '2010-08-22', from: 'el campo', reason: 'buscar oportunidades' }, household: { id: 'HOU-0007', members: 4, tenure: 'arriendo' } },
  why: [ev('EVT-3', 'JOB_HIRED', '2026-01-02 00:00', 1440, { citizenId: 'CIT-000019', orgName: 'Oficinas Andina' }, 'CIT-000019 empieza a trabajar en Oficinas Andina.')],
  until: '2026-01-07 17:00',
  agenda: { blocks: [{ from: 0, to: 360, kind: 'dormir', activity: 'sleep' }, { from: 360, to: 1020, kind: 'trabajo', activity: 'work' }, { from: 1020, to: 1440, kind: 'libre', activity: 'leisure' }], now: 615, free: { from: '17:00', to: '24:00' } },
  family: [{ id: 'CIT-000303', name: 'Juan Osorio Cárdenas', relation: 'padre', situation: 'Murió en 1994, a los 47' }, { id: 'CIT-000022', name: 'Ana Osorio Vargas', relation: 'hija', situation: '20 · Alcaldía Municipal' }],
  health: { insurance: { regime: 'contributivo (beneficiario)', since: '2021-06-24' }, conditions: [], illnesses: [], overslept: { count: 1, last: '2026-01-03' } },
  objects: [{ id: 'OBJ-000018', name: 'una bicicleta', owner: 'persona', acquired: '2023-09', price: 480000 }, { id: 'OBJ-000185', name: 'la moto de la casa', owner: 'hogar', acquired: '2022-12', price: 7500000 }],
  debts: [],
  events: [
    ev('EVT-1', 'CITIZEN_BORN', '1985-10-20 00:00', -21143520, { citizenId: 'CIT-000019' }, 'Nace CIT-000019 en el campo.'),
    ev('EVT-2', 'CITIZEN_DIED', '1994-01-01 00:00', -16000000, { citizenId: 'CIT-000303' }, 'Muere CIT-000303.', [{ id: 'CIT-000303', role: 'fallecido', name: 'Juan Osorio Cárdenas' }]),
    ev('EVT-4', 'CITIZEN_BORN', '2006-05-19 00:00', -10000000, { citizenId: 'CIT-000022' }, 'Nace CIT-000022.', [{ id: 'CIT-000022', role: 'nacido', name: 'Ana Osorio Vargas' }]),
    ev('EVT-5', 'MIGRATED', '2010-08-22 00:00', -8079840, { citizenId: 'CIT-000019' }, 'CIT-000019 llega a Data\'s World desde el campo.'),
    ev('EVT-3', 'JOB_HIRED', '2026-01-02 00:00', 1440, { citizenId: 'CIT-000019', orgName: 'Oficinas Andina' }, 'CIT-000019 empieza a trabajar en Oficinas Andina.'),
  ],
  counts: { events: 5, functions: 1, rules: 1, chats: 0 },
};
const x: ExpData = { d: detail, dos: dossier, report: null, today: '2026-01-07 10:15', doing: 'trabajando en Oficinas Andina' };

describe('024 R-022: expediente de vida', () => {
  it('CA-014: encabezado y las seis pestañas (las direcciones de antes llevan a la que las reúne)', () => {
    expect(EXP_TABS.map(([k]) => k)).toEqual(['resumen', 'historia', 'memoria', 'creencias', 'charlas', 'vinculos']);
    expect(EXP_TABS.map(([, l]) => l)).toEqual(['Resumen', 'Historia de vida', 'Memoria', 'Creencias', 'Charlas', 'Red']);
    expect(['estado', 'aprendizaje', 'emociones', 'salud', 'economia', 'inexistente', undefined].map(tabId)).toEqual(['resumen', 'resumen', 'historia', 'historia', 'historia', 'resumen', 'resumen']);
    const strip = identityStrip(detail, dossier, 'datos al 2026-01-07 10:15 · en vivo');
    expect(strip).toContain('datos al 2026-01-07 10:15 · en vivo');
    expect(strip).toContain('Salario <small>Pronto</small>');
    expect(strip).toContain('Hombre · 40 años (n. 1985-10-20, el campo) · Tecnológica · Oficinas Andina · Hogar HOU-0007');
    expect(strip).toContain('1 · alimentación'); // alerta por necesidad crítica
  });

  it('CA-014: Resumen con identidad, por qué está donde está, curso de vida y contadores', () => {
    const r = tabResumen(x);
    expect(r).toContain('2010-08-22</span> (buscar oportunidades)');
    expect(r).toContain('HOU-0007</span> · 4 personas, en arriendo');
    expect(r).toContain('Ahora: trabajando en Oficinas Andina hasta las 17:00');
    expect(r).toContain('Curso de vida');
    expect(r).toContain('EN EL CAMPO');
    expect(r).toContain('Estímulos con función</span><b class="mono">1');
  });

  it('CA-014: Estado con la necesidad crítica explicada y la agenda de hoy; Emociones sin disparos', () => {
    const e = tabEstado(x);
    expect(e).toContain('Crítica (&lt; 0,1): alimentación');
    expect(e).toContain('class="ag-trabajo"');
    expect(e).toContain('desde las <span class="mono">17:00</span>');
    expect(tabEmociones(x)).toContain('Ninguna emoción activa');
  });

  it('CA-014: Historia con el filtro de origen o simulación', () => {
    expect(tabHistoria(x, 'todos').match(/data-why=/g)).toHaveLength(5);
    expect(tabHistoria(x, 'origen').match(/data-why=/g)).toHaveLength(4);
    expect(tabHistoria(x, 'simulacion').match(/data-why=/g)).toHaveLength(1);
    expect(tabHistoria(x, 'origen')).toContain('data-hist="origen" aria-pressed="true"');
  });

  it('CA-014: Vínculos, Aprendizaje, Salud, Economía y Charlas con los datos de la ficha y el expediente', () => {
    const v = tabVinculos(x, null);
    expect(v).toContain('Juan Osorio Cárdenas');
    expect(v).toContain('Murió en 1994, a los 47');
    expect(tabAprendizaje(x, null)).toContain('le funciona (tracking)');
    expect(tabAprendizaje(x, null)).toContain('0,334');
    const s = tabSalud(x);
    expect(s).toContain('Contributivo (beneficiario)');
    expect(s).toContain('1 vez dormido de más');
    const eco = tabEconomia(x);
    expect(eco).toContain('Una bicicleta');
    expect(eco).toContain('$7.500.000');
    expect(eco).toContain('Hogar');
    const ch = tabCharlas(x);
    expect(ch).toContain('Ahora está trabajando: puede hablar solo un momento');
    expect(ch).toContain('value="sandbox"');
  });

  it('el curso de vida lista los hitos y reparte las etiquetas sin solaparlas', () => {
    const labels = milestones(dossier).map((m) => m.label);
    expect(labels).toEqual(['Nace', 'Muere su padre · 9 años', 'Nace su hija Ana · 21', "Llega a Data's World · 25", 'Entra a Oficinas Andina · 2026-01-02']);
    expect(placeLabels([100, 100, 100], ['una etiqueta larga', 'otra etiqueta larga', 'y otra más'])).toEqual([0, 1, 2]);
  });
});

describe('024 R-021: ficha compacta', () => {
  it('lleva al expediente y a la charla, y avisa de la necesidad crítica', () => {
    const c = compactCard(detail, 'trabajando en Oficinas Andina', dossier, false);
    expect(c).toContain('href="#/expediente/CIT-000019"');
    expect(c).toContain('href="#/charla/CIT-000019"');
    expect(c).toContain('Alimentación crítica: buscará comer');
    expect(c).toContain('HOU-0007</span> · 4 personas');
    expect(c).toContain('Ahora: trabajando en Oficinas Andina hasta las 17:00');
    expect(criticalNeeds(detail).map((n) => n.key)).toEqual(['hunger']);
  });
});

describe('024 R-023: dashboard', () => {
  const g: Demographics = {
    date: '2026-01-07 10:15', period: 'year', population: 10, women: 4, men: 6,
    births: { count: 3, perThousand: 15.1 }, deaths: { count: 2, perThousand: 10.1 }, households: { count: 4, meanSize: 2.5 }, organizations: 3,
    pyramid: [{ group: '0–9', F: 1, M: 2 }, { group: '10–19', F: 3, M: 4 }],
    occupations: [{ name: 'Empleo formal', count: 6 }, { name: 'Estudiante', count: 4 }],
    now: [{ kind: 'trabajando', count: 6 }, { kind: 'en casa', count: 4 }],
  };

  it('CA-015: la pirámide y la ocupación dibujan una barra por valor, con su cuenta', () => {
    const p = pyramidSvg(g.pyramid);
    expect(p.match(/<rect class="bar"/g)).toHaveLength(4);
    expect(p).toContain('10–19 · hombres: 4');
    const o = occupationSvg(g.occupations, g.population);
    expect(o).toContain('Empleo formal: 6 (60 %)');
    expect(niceMax(24)).toBe(30);
    expect(niceMax(3)).toBe(10);
  });

  it('CA-015: indicadores del periodo y «Ver como tabla»', () => {
    const d = renderDashboard(g, { pyramid: true, occ: false });
    expect(d).toContain('Nacidos · último año');
    expect(d).toContain('tasa bruta 15,1 ‰');
    expect(d).toContain('2,5 personas por hogar');
    expect(d).toContain('<th>Mujeres</th>'); // la pirámide como tabla
    expect(d).toContain('Ver como gráfica');
    expect(renderDashboard({ ...g, period: 'all' }, { pyramid: false, occ: false })).toContain('Nacidos · desde la fundación');
  });

  it('R-028: empleo, ánimo y estrés aparecen con las cifras vivas y no se inventan sin ellas', () => {
    const sin = renderDashboard(g, { pyramid: false, occ: false });
    expect(sin).not.toContain('Con empleo');
    const con = renderDashboard(g, { pyramid: false, occ: false }, { employedPct: 0.793, mood: 0.54, stress: 0.31 });
    expect(con).toContain('79 %');
    expect(con).toContain('Ánimo medio');
    expect(con).toContain('0,54');
    expect(con).toContain('Estrés medio');
    expect(con).toContain('0,31');
    expect(renderDashboard(g, { pyramid: false, occ: false }, { employedPct: 0.79, mood: 0.54, stress: null })).not.toContain('Estrés medio');
  });
});

describe('024 R-021: capas, panel «Ahora» y escala', () => {
  it('CA-016: lo que se apaga no se dibuja', () => {
    expect(drawPlan(DEFAULT_LAYERS, true)).toEqual({ figures: true, labels: false, bonds: true, mood: false, night: true });
    expect(drawPlan({ ...DEFAULT_LAYERS, personas: false, animo: true }, true)).toMatchObject({ figures: false, mood: false });
    expect(drawPlan({ ...DEFAULT_LAYERS, noche: false }, false)).toMatchObject({ night: false, bonds: false });
  });

  it('CA-016: una fila por categoría, que suman la población', () => {
    const rows = nowRows([{ kind: 'trabajando', count: 6 }, { kind: 'en la calle', count: 1 }, { kind: 'en casa', count: 3 }]);
    expect(rows.map((r) => r.label)).toEqual(['Trabajando', 'En la calle', 'En casa']);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(10);
  });

  it('la escala da una distancia redonda de al menos 40 px (un tile mide 8 m)', () => {
    expect(scaleBar(8)).toEqual({ meters: 50, px: 50 });
    expect(scaleBar(24)).toEqual({ meters: 20, px: 60 });
  });
});

describe('024 R-020: pantallas', () => {
  it('cada dirección lleva a su pantalla, y de vuelta', () => {
    expect(parseRoute('#/datos')).toEqual({ view: 'datos' });
    expect(parseRoute('#/expediente/CIT-000019/historia')).toEqual({ view: 'expediente', person: 'CIT-000019', tab: 'historia' });
    expect(parseRoute('#/charla/CIT-000019')).toEqual({ view: 'charla', person: 'CIT-000019' });
    expect(parseRoute('#/mundo/CIT-000019')).toEqual({ view: 'mundo', person: 'CIT-000019' });
    expect(parseRoute('#/expediente/nada')).toEqual({ view: 'mundo' });
    expect(parseRoute('')).toEqual({ view: 'mundo' });
    for (const h of ['#/datos', '#/expediente/CIT-000019/salud', '#/charla/CIT-000001', '#/mundo', '#/mundo/CIT-000002']) expect(hrefOf(parseRoute(h))).toBe(h);
  });
});
