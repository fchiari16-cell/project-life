import type { ContentBundle, ContentManifest } from '@project-life/schemas';

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

/** Content-pack checks: duplicate ids, impossible rules, unreachable content. Empty result = valid. */
export function validateContent(b: ContentBundle): string[] {
  const issues: string[] = [];
  for (const id of duplicates(b.countries.map((c) => c.code))) issues.push(`duplicate country ${id}`);
  for (const id of duplicates(b.professions.map((p) => p.id))) issues.push(`duplicate profession ${id}`);
  for (const id of duplicates(b.events.map((e) => e.id))) issues.push(`duplicate event ${id}`);

  for (const p of b.professions) {
    if (p.salaryRef <= 0) issues.push(`profession ${p.id}: non-positive salary`);
    const reachable = p.requires.length === 0 || p.requires.some((q) => ['primary', 'secondary', 'vocational', 'bachelor', 'master', 'doctorate'].includes(q));
    if (!reachable) issues.push(`profession ${p.id}: unreachable requirement`);
  }
  if (!b.professions.some((p) => p.requires.length === 0)) issues.push('no profession is available without qualifications');

  for (const e of b.events) {
    if (e.minAge > e.maxAge) issues.push(`event ${e.id}: minAge > maxAge`);
    if (e.choices.length === 0) issues.push(`event ${e.id}: no choices`);
    const choiceIds = e.choices.map((c) => c.id);
    for (const d of duplicates(choiceIds)) issues.push(`event ${e.id}: duplicate choice ${d}`);
    for (const c of e.choices) {
      for (const d of duplicates(c.outcomes.map((o) => o.id))) issues.push(`event ${e.id}/${c.id}: duplicate outcome ${d}`);
      for (const o of c.outcomes) {
        for (const fx of o.effects) {
          if (fx.type === 'takeJob' && !e.dynamicOffers) issues.push(`event ${e.id}: takeJob outside a job-offer event`);
          if ((fx.type === 'relationship' || fx.type === 'memory' || fx.type === 'befriend' || fx.type === 'startRomance') && e.actor === 'none') {
            issues.push(`event ${e.id}: ${fx.type} needs an actor`);
          }
          if (fx.type === 'startRomance' && e.actor !== 'new_adult' && e.actor !== 'friend') issues.push(`event ${e.id}: startRomance needs an adult actor`);
        }
        if ((o.relBias || o.actorTraitBias) && e.actor === 'none') issues.push(`event ${e.id}/${c.id}/${o.id}: bias needs an actor`);
      }
    }
    if (e.dynamicOffers === 'jobs' && !e.choices.some((c) => c.id === 'decline')) {
      issues.push(`event ${e.id}: job-offer events must keep a decline choice`);
    }
    if (e.trigger === 'birthday' && !e.requires.stages) issues.push(`event ${e.id}: birthday events must be gated by education stage`);
  }
  const archetypeIds = new Set(b.archetypes.map((a) => a.id));
  for (const id of duplicates(b.archetypes.map((a) => a.id))) issues.push(`duplicate archetype ${id}`);
  for (const p of b.professions) {
    if (!archetypeIds.has(p.archetype)) issues.push(`profession ${p.id}: unknown archetype ${p.archetype}`);
    for (const d of duplicates(p.specializations.map((x) => x.id))) issues.push(`profession ${p.id}: duplicate specialization ${d}`);
  }
  for (const a of b.archetypes) if (!b.professions.some((p) => p.archetype === a.id)) issues.push(`archetype ${a.id} is unused`);
  for (const c of b.countries) {
    const sets = b.taxRules.filter((r) => r.countries.includes(c.code));
    if (sets.length !== 1) issues.push(`country ${c.code}: needs exactly one tax rule set, found ${sets.length}`);
  }
  for (const r of b.taxRules) {
    const years = r.periods.map((x) => x.fromYear);
    if (new Set(years).size !== years.length) issues.push(`tax rules ${r.id}: duplicate period start`);
    for (const per of r.periods) {
      if (per.brackets[per.brackets.length - 1]?.upToRef !== null) issues.push(`tax rules ${r.id}: last bracket must be open-ended`);
      const lims = per.brackets.map((x) => x.upToRef ?? Infinity);
      if (lims.some((v, i) => i > 0 && v <= (lims[i - 1] as number))) issues.push(`tax rules ${r.id}: brackets must be increasing`);
    }
  }
  const sectorIds = new Set(b.businessSectors.map((x) => x.id));
  for (const e of b.events) {
    for (const c of e.choices) {
      for (const o of c.outcomes) {
        for (const fx of o.effects) {
          if (fx.type === 'startBusiness') {
            if (!sectorIds.has(fx.sector)) issues.push(`event ${e.id}: unknown business sector ${fx.sector}`);
            const need = b.businessSectors.find((x) => x.id === fx.sector)?.startupRef ?? 0;
            if ((e.requires.minCashRef ?? 0) < need) issues.push(`event ${e.id}: offers ${fx.sector} without requiring enough cash`);
          }
          if (fx.type === 'specialize' || fx.type === 'takeJob') continue;
        }
      }
    }
    if (e.dynamicOffers === 'specializations' && !e.requires.specializable) issues.push(`event ${e.id}: specialization offers need requires.specializable`);
  }
  if (!b.professions.some((p) => p.specializations.length > 0)) issues.push('no profession offers a specialization');
  for (const id of duplicates(b.talents.map((t) => t.id))) issues.push(`duplicate talent ${id}`);
  const archetypeSet = new Set(b.archetypes.map((a) => a.id));
  for (const tal of b.talents) for (const a of tal.archetypes) if (!archetypeSet.has(a)) issues.push(`talent ${tal.id}: unknown archetype ${a}`);
  if (b.talents.length > 0 && !b.talents.some((tal) => tal.academic)) issues.push('no talent helps with studying');
  for (const id of duplicates(b.parties.map((p) => p.id))) issues.push(`duplicate party ${id}`);
  if (b.parties.length < 2) issues.push('at least two parties are needed for elections to change anything');
  for (const e of b.events) {
    const gives = e.choices.flatMap((c) => c.outcomes.flatMap((o) => o.effects.map((fx) => fx.type)));
    if (gives.includes('office') && !e.requires.partyMember) issues.push(`event ${e.id}: offices require party membership`);
    if (gives.includes('policy') && !e.requires.inOffice) issues.push(`event ${e.id}: policies need an office`);
    if (gives.includes('legalAction') && e.requires.legalStage !== 'charged') issues.push(`event ${e.id}: legal actions belong to charged cases`);
    if (e.category === 'justice' && e.requires.legalStage === undefined && e.requires.free === undefined && e.requires.record === undefined) {
      issues.push(`event ${e.id}: justice events must be gated by legal stage, freedom or record`);
    }
    if (e.dynamicOffers === 'parties' && e.requires.partyMember !== false) issues.push(`event ${e.id}: party offers are for non-members`);
    if (e.dynamicOffers === 'countries' && !e.choices.some((c) => c.id === 'decline')) issues.push(`event ${e.id}: country offers need a decline choice`);
  }
  for (const c of b.countries) {
    if (c.deathRateBp <= 0 || c.birthRateBp <= 0) issues.push(`country ${c.code}: demographic rates must be positive`);
  }
  if (new Set(b.countries.map((c) => c.bloc)).size < 2) issues.push('recognition blocs: at least two needed for migration to matter');
  if (b.countries.some((c) => c.cities.length === 0)) issues.push('country without cities');
  if (b.givenNames.length < 2) issues.push('too few given names');
  if (b.familyNames.length < 2) issues.push('too few family names');
  return issues;
}

export function validateManifest(manifest: ContentManifest): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const p of manifest.packages) {
    if (seen.has(p.id)) issues.push(`duplicate package id: ${p.id}`);
    seen.add(p.id);
    if (p.provenance !== 'fictional' && !p.source) {
      issues.push(`package ${p.id}: non-fictional content requires a documented source`);
    }
  }
  return issues;
}
