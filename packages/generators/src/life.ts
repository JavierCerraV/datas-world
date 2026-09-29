// La vida diaria de M2 montada en un solo sitio (bloque H): el registro de sistemas y las opciones del bucle que
// usan la CLI, el worker, el bench y las validaciones. Vive en los generadores porque necesita los catálogos (la
// tabla de esparcimiento del motor de decisiones, 017) y el motor no hace E/S.
import {
  CHAT_DEFAULTS,
  CLAIM_DEFAULTS,
  NEEDS_SYSTEMS,
  consequenceSystems,
  createPrivateSystem,
  Runner,
  chatInputHandlers,
  learningParams,
  WORK_SYSTEMS,
  createActionValidator,
  createDecisionSystem,
  createLearningSystem,
  createMemorySystem,
  createKnowledgeSystem,
  KNOWLEDGE_DEFAULTS,
  createOriginsSystem,
  createRegistry,
  createRng,
  relationshipSystems,
  RELATIONSHIP_DEFAULTS,
  economySystem,
  mobilitySystem,
  relationsSystem,
  routinesSystem,
  rulesSystem,
} from '@datas-world/engine';
import type { Capability, ChatCatalog, KnowledgeCatalog, LoopOptions, RelationResolve, SystemRegistry, TopicDef, World } from '@datas-world/engine';
import { loadCatalogs } from './catalogs/load.ts';
import type { Catalogs } from './catalogs/load.ts';
import { leisureTable } from './leisure/params.ts';
import { buildOntology } from './stimuli/ontology.ts';

/** Capacidades de la vida diaria (peldaño 1, ADR-005): las que activa `generateWorld` por defecto. */
export const LIFE_CAPABILITIES: readonly Capability[] = Object.freeze(['clock', 'needs', 'routines', 'mobility', 'economy', 'learning', 'relationships', 'memory', 'consolidation', 'beliefs']);

/**
 * Sistemas en orden de fase (021): necesidades, enfermedad y sueño (010), rutina (011), decisiones (017),
 * movilidad (016), economía (015), trabajo (006) y aprendizaje directo (036, fase de memoria), con el validador de
 * acciones. Un mundo solo ejecuta los de sus capacidades: un mundo de M1 (solo `clock`) no cambia.
 */
export function lifeSystems(world: World, catalogs: Catalogs = loadCatalogs()): { systems: SystemRegistry; loop: LoopOptions } {
  const profile = world.config.profile;
  const table = profile ? leisureTable(catalogs.leisure_activities, profile, world.config.epoch.slice(0, 10)) : {};
  const onto = buildOntology(catalogs);
  return {
    systems: createRegistry([
      ...NEEDS_SYSTEMS,
      routinesSystem,
      createDecisionSystem(table, onto),
      mobilitySystem,
      economySystem,
      ...WORK_SYSTEMS,
      createLearningSystem(onto),
      relationsSystem,
      rulesSystem,
      // Eventos privados, PNR, evitación y «Yo» (039).
      createPrivateSystem(onto),
      // Consecuencias de la charla (044 R-006 a R-009): llamadas, encuentros y vínculos.
      ...consequenceSystems(chatEngineCatalog(catalogs), CLAIM_DEFAULTS),
      // Relaciones (012): encuentros cotidianos con las posturas de la charla, vínculos, parejas, rupturas y olvido.
      ...relationshipSystems({
        cat: chatEngineCatalog(catalogs), onto, chat: CHAT_DEFAULTS, claim: CLAIM_DEFAULTS, p: RELATIONSHIP_DEFAULTS,
        // Lo que se cuenta en los encuentros (025 R-003 a R-006).
        knowledge: { cat: knowledgeCatalog(catalogs), onto, claim: CLAIM_DEFAULTS, p: KNOWLEDGE_DEFAULTS },
      }),
      // Conocimiento (025): lo presenciado, lo oído y lo corregido, con sus consecuencias.
      createKnowledgeSystem({ cat: knowledgeCatalog(catalogs), chat: chatEngineCatalog(catalogs), onto, claim: CLAIM_DEFAULTS, p: KNOWLEDGE_DEFAULTS }),
      // Memoria autobiográfica (013): codificación, repaso, olvido, consolidación en la red y capítulos.
      createMemorySystem(onto),
      // Origen de los estados (019 R-005): el último hecho detrás del estrés, el sueño, el dinero, la salud…
      createOriginsSystem(),
    ]),
    loop: { validate: createActionValidator(table) },
  };
}

/** Tonos y posturas de la charla (043) en la forma del motor, desde los catálogos `chat_tones` y `chat_stances`. */
export function chatEngineCatalog(catalogs: Catalogs): ChatCatalog {
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  return {
    tones: catalogs.chat_tones.entries.map((e) => ({ key: e.key, stimulus: String(e.attrs?.stimulus ?? ''), magnitude: n(e.attrs?.magnitude), prior: n(e.attrs?.prior) })),
    stances: catalogs.chat_stances.entries.map((e) => ({ key: e.key, escape: n(e.attrs?.escape), w0: n(e.attrs?.w0) })),
    // Consecuencias de lo dicho sobre terceros (044 R-001, R-003).
    claims: catalogs.chat_claims.entries.map((e) => ({
      key: e.key, stimulus: String(e.attrs?.stimulus ?? ''), magnitude: n(e.attrs?.magnitude), prior: n(e.attrs?.prior),
      about: Array.isArray(e.attrs?.about) ? (e.attrs.about as string[]) : [],
    })),
    relations: catalogs.chat_relations.entries.map((e) => ({
      key: e.key, resolve: String(e.attrs?.resolve ?? '') as RelationResolve, closeness: n(e.attrs?.closeness),
    })),
    // El celular (044 P2): el tipo de objeto que tiene `callAccess` por estrato.
    ...phoneOf(catalogs),
  };
}

/** Temas de los que se habla (025 R-001), desde el catálogo `rumor_topics`, en la forma del motor. */
export function knowledgeCatalog(catalogs: Catalogs): KnowledgeCatalog {
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    topics: catalogs.rumor_topics.entries.map((e) => ({
      key: e.key, name: e.name, event: s(e.attrs?.event), subjects: s(e.attrs?.subjects) as TopicDef['subjects'],
      ...(e.attrs?.when ? { when: e.attrs.when as Record<string, string> } : {}),
      stimulus: s(e.attrs?.stimulus), magnitude: n(e.attrs?.magnitude), prior: n(e.attrs?.prior),
      group: s(e.attrs?.group), state: s(e.attrs?.state), level: n(e.attrs?.level),
      ...(e.attrs?.escalatesTo ? { escalatesTo: s(e.attrs.escalatesTo) } : {}),
    })),
  };
}

function phoneOf(catalogs: Catalogs): Pick<ChatCatalog, 'phone'> {
  const e = catalogs.object_kinds.entries.find((x) => x.attrs?.callAccess !== undefined);
  return e ? { phone: { kind: e.key, callAccess: e.attrs!.callAccess as Record<string, number> } } : {};
}

/** Runner con la vida diaria, el azar de la semilla del mundo (023) y las entradas de la charla (043 R-019). */
export function lifeRunner(world: World, catalogs: Catalogs = loadCatalogs(), loop: LoopOptions = {}): Runner {
  const life = lifeSystems(world, catalogs);
  const inputs = chatInputHandlers({
    cat: chatEngineCatalog(catalogs),
    onto: buildOntology(catalogs),
    P: learningParams(world.config.profile, world.config.epoch.slice(0, 10)),
    params: CHAT_DEFAULTS,
  });
  return new Runner(world, createRng(world.config.seed), {}, { systems: life.systems, loop: { ...life.loop, ...loop }, inputs });
}
