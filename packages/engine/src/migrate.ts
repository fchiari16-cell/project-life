import { CONTENT_VERSION, ENGINE_VERSION, RULES_VERSION, SCHEMA_VERSION } from '@project-life/schemas';
import { stateChecksum } from './canonical.js';
import type { ContentBundle } from '@project-life/schemas';
import { initialEconomy } from './economy.js';
import { defaultSociety } from './society.js';
import { createWorldCountries, extendWorldCountries } from './world.js';
import { baseDims, drawTraits } from './npc.js';
import { Rng } from './rng.js';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- raw legacy data

/** Schema v2 → v3: the flat `family.members` list becomes the NPC graph (npcs, relationships, unions). */
function v2ToV3(state: Json): Json {
  const rng = Rng.fromSeed(`${state.seed}|migrate-v3`);
  const members: Json[] = state.family?.members ?? [];
  const mother = members.find((m) => m.relation === 'mother');
  const father = members.find((m) => m.relation === 'father');
  const me = state.protagonist.id as string;
  const npcs: Json = {};
  const relationships: Json = {};
  const siblings = members.filter((m) => m.relation === 'sibling');
  // v2 did not enforce parent ages; push parents' birth back so every child has parents ≥ 16 years older.
  const youngestSiblingYear = siblings.reduce((y: number, m) => Math.min(y, m.birthYear), state.protagonist.birth.year);
  for (const m of members) {
    const parentIds = m.relation === 'sibling' ? [mother?.id, father?.id].filter(Boolean) : [];
    const birthYear = m.relation === 'sibling' ? m.birthYear : Math.min(m.birthYear, youngestSiblingYear - 16);
    npcs[m.id] = {
      id: m.id,
      givenName: m.givenName,
      familyName: m.familyName,
      birthYear,
      deathYear: m.deathYear,
      traits: drawTraits(rng),
      class: state.family.class,
      countryCode: state.location.countryCode,
      parentIds,
      memories: [],
    };
    relationships[`${me}>${m.id}`] = { from: me, to: m.id, bond: 'family', dims: baseDims('family', rng) };
    relationships[`${m.id}>${me}`] = { from: m.id, to: me, bond: 'family', dims: baseDims('family', rng) };
  }
  const unions: Json = {};
  if (mother && father) {
    unions[`${state.id}:u0`] = { id: `${state.id}:u0`, members: [mother.id, father.id], status: 'married', startYear: state.world.startDate.year - 5, endYear: null };
  }
  const pending = state.simulation.pending ? { ...state.simulation.pending, actorId: null } : null;
  return {
    ...state,
    schemaVersion: 3,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    dynasty: { ...state.dynasty, chronicle: [] },
    world: { ...state.world, originDate: state.world.startDate },
    simulation: { ...state.simulation, pending },
    protagonist: { ...state.protagonist, parentIds: [mother?.id, father?.id].filter(Boolean) },
    family: { class: state.family.class, guardianId: null },
    npcs,
    relationships,
    unions,
    stories: {},
  };
}

/** Schema v3 → v4: World Engine economy, property register, businesses, investment-gain tracking, job specialization. */
function v3ToV4(state: Json): Json {
  const job = state.career?.job ? { ...state.career.job, specialization: null } : null;
  return {
    ...state,
    schemaVersion: 4,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    world: { ...state.world, economy: initialEconomy() },
    career: { ...state.career, job },
    finance: { ...state.finance, gainsThisYear: 0 },
    properties: {},
    businesses: {},
  };
}

/** Schema v4 → v5: the persistent world (per-country economy, politics, demography, environment) and civic life. */
function v4ToV5(state: Json, content: ContentBundle): Json {
  const code: string = state.location.countryCode;
  const rng = Rng.fromSeed(`${state.seed}|migrate-v5`);
  const countries = createWorldCountries(content, rng, state.world.startDate.year);
  const home = countries[code];
  if (home) {
    home.economy = state.world.economy;
    home.priceIndex = state.world.priceIndex;
  }
  for (const n of Object.values<Json>(state.npcs)) if (n.deathYear === null && countries[n.countryCode]) countries[n.countryCode]!.tracked += 1;
  if (!state.protagonist.death && home) home.tracked += 1;
  for (const c of Object.values(countries)) c.population = Math.max(c.population, c.tracked + 1);
  return {
    ...state,
    schemaVersion: 5,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    world: { ...state.world, countries, history: [] },
    society: defaultSociety(code, state.world.currentDate.year),
  };
}

/** Schema v5 → v6: the global catalogue. Countries added to the world since the save was made start from their model state. */
function v5ToV6(state: Json, content: ContentBundle): Json {
  const rng = Rng.fromSeed(`${state.seed}|migrate-v6`);
  const countries = extendWorldCountries(state.world.countries, content, rng, state.world.currentDate.year);
  return {
    ...state,
    schemaVersion: 6,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    world: { ...state.world, countries },
    education: { ...state.education, postgraduate: null },
    // Saves made before the money-unit rule keep their original scale (cents).
    finance: { ...state.finance, minorUnits: 100 },
  };
}

/** Schema v6 → v7: talents, skills, predispositions, GOD MODE state and achievements (all neutral defaults). */
function v6ToV7(state: Json): Json {
  const neutral = { longevity: 50, robustness: 50 };
  const npcs: Json = {};
  for (const [id, n] of Object.entries<Json>(state.npcs)) npcs[id] = { ...n, predispositions: neutral, talents: [] };
  return {
    ...state,
    schemaVersion: 7,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    protagonist: { ...state.protagonist, predispositions: neutral, talents: [], skills: { social: 10, technical: 10, creative: 10, physical: 10 } },
    npcs,
    godMode: { enabled: false, edits: 0, log: [] }, // the shape this version had; v7ToV8 reads it
    achievements: {},
  };
}

/**
 * Schema v7 → v8: GOD MODE becomes a choice fixed at creation (T71/T72). A value is never assigned arbitrarily:
 * it is derived from what the save itself proves. A log with an activation, or any recorded edit, shows the
 * life used GOD MODE, so it is kept on (and locked); otherwise it is off (and locked). The origin records that
 * the value was derived. The old on/off switch and the dynasty-wide log are dropped; chronicle entries gain an
 * informational flag.
 */
function v7ToV8(state: Json): Json {
  const old: Json = state.godMode ?? { enabled: false, edits: 0, log: [] };
  const used = (old.edits ?? 0) > 0 || (old.log ?? []).some((e: Json) => e.action === 'ENABLED' || e.action === 'EDITED');
  return {
    ...state,
    schemaVersion: 8,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    config: { godModeEnabled: used, godModeOrigin: used ? 'migrated-from-usage' : 'migrated-no-usage' },
    godMode: { edits: old.edits ?? 0, log: old.log ?? [] },
    dynasty: { ...state.dynasty, chronicle: (state.dynasty?.chronicle ?? []).map((c: Json) => ({ ...c, godMode: false })) },
  };
}

const STEPS: Record<number, (s: Json, content: ContentBundle) => Json> = { 2: v2ToV3, 3: v3ToV4, 4: v4ToV5, 5: v5ToV6, 6: v6ToV7, 7: v7ToV8 };

export interface MigrationResult {
  slot: Json;
  from: number;
}

/**
 * Upgrades a raw save slot to the current schema through the migration chain.
 * Returns null when no chain exists (unknown or too-old versions); never mutates its input.
 */
export function migrateSlot(raw: Json, content: ContentBundle): MigrationResult | null {
  const from = raw?.schemaVersion;
  if (typeof from !== 'number' || from >= SCHEMA_VERSION) return null;
  let state: Json = structuredClone(raw.state);
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) return null;
    state = step(state, content);
  }
  return {
    from,
    slot: {
      ...raw,
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      contentVersion: CONTENT_VERSION,
      rng: state.rng,
      checksum: stateChecksum(state),
      state,
    },
  };
}
