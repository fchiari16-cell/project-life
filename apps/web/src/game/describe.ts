import { contentBundle } from '@project-life/content';
import { fillActor, jobTitle } from '@project-life/engine';
import type { DomainEvent, GameState, SimDate } from '@project-life/schemas';
import { localeTag, regionName } from '../i18n/locale';
import { t } from '../i18n/it';
import { useGame } from './store';

export const fmtDate = (d: SimDate): string =>
  `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;

/** `minorUnits` defaults to the open life's money unit (100 = cents, 1 = whole units for high-nominal currencies). */
export function formatMoney(minor: number, currency: string, minorUnits: number = useGame.getState().game?.finance.minorUnits ?? 100): string {
  const major = Math.round(minor / minorUnits);
  return new Intl.NumberFormat(localeTag(), { style: 'currency', currency, maximumFractionDigits: 0 }).format(major === 0 ? 0 : major);
}

export const professionTitle = (id: string | null): string =>
  contentBundle.professions.find((p) => p.id === id)?.title ?? '—';

export const countryName = (code: string): string => regionName(code, contentBundle.countries.find((c) => c.code === code)?.name ?? code);

export function causeLabel(cause: string): string {
  if (cause === 'old_age') return t.causes.old_age;
  if (cause === 'illness') return t.causes.illness;
  return t.causes.event;
}

export function occupationLabel(s: GameState, age: number): string {
  if (s.career.job) return jobTitle(contentBundle, s.career.job);
  if (s.career.retired) return t.career.retired;
  const stage = s.education.stage;
  if (stage === 'primary' || stage === 'secondary' || stage === 'university' || stage === 'vocational') return t.career.student;
  if (age < 18) return t.career.child;
  return t.career.unemployed;
}

/** Text for the history feed; authored outcome texts come from the content pack. */
export function describeEvent(e: DomainEvent, currency = 'EUR'): { text: string; detail?: string } {
  switch (e.type) {
    case 'LIFE_CREATED':
      return { text: t.events.LIFE_CREATED };
    case 'YEAR_COMPLETED':
      return { text: t.events.YEAR_COMPLETED(e.payload.age) };
    case 'DEATH':
      return { text: t.events.DEATH, detail: causeLabel(e.payload.cause) };
    case 'FAMILY_DEATH':
      return { text: t.events.FAMILY_DEATH(t.rel.code[e.payload.relation as keyof typeof t.rel.code] ?? e.payload.relation) };
    case 'SOCIAL': {
      const { change, otherName, detail } = e.payload;
      switch (change) {
        case 'SEPARATED':
          return { text: t.social.SEPARATED(otherName ?? '', detail) };
        case 'GUARDIAN_ASSIGNED':
          return { text: t.social.GUARDIAN_ASSIGNED(otherName) };
        case 'STORY_STARTED':
        case 'STORY_ENDED':
          return { text: t.social[change](t.stories.names[detail ?? ''] ?? detail ?? '') };
        default:
          return { text: t.social[change](otherName ?? '') };
      }
    }
    case 'WORLD': {
      const { kind, detail } = e.payload;
      if (kind === 'ELECTION') return { text: t.world.events.ELECTION(contentBundle.parties.find((p) => p.id === detail)?.name ?? detail) };
      return { text: t.world.events[kind]() };
    }
    case 'SOCIETY': {
      const { change, detail } = e.payload;
      const text = t.societyEvents[change];
      let extra: string | undefined;
      switch (change) {
        case 'JOINED_PARTY':
          extra = detail ?? undefined;
          break;
        case 'ELECTED':
        case 'RE_ELECTED':
          extra = detail ? t.society.offices[detail as keyof typeof t.society.offices] : undefined;
          break;
        case 'POLICY_PASSED':
          extra = t.world.policies[detail ?? ''] ?? detail ?? undefined;
          break;
        case 'MOVED':
        case 'VISA_EXPIRED':
        case 'RESIDENCY_GRANTED':
        case 'CITIZENSHIP_GRANTED':
          extra = detail ? countryName(detail) : undefined;
          break;
        case 'CONVICTED':
          extra = t.society.sentence(Number(detail ?? 0));
          break;
        default:
          extra = undefined;
      }
      return extra ? { text, detail: extra } : { text };
    }
    case 'ASSET_CHANGED': {
      const { change, label, amount } = e.payload;
      const money = formatMoney(amount, currency);
      switch (change) {
        case 'BUSINESS_FOUNDED':
        case 'BUSINESS_EXPANDED':
        case 'BUSINESS_SOLD':
          return { text: t.assets[change](label ?? '', money) };
        case 'BUSINESS_BANKRUPT':
        case 'BUSINESS_INHERITED':
          return { text: t.assets[change](label ?? '') };
        default:
          return { text: t.assets[change](money) };
      }
    }
    case 'JOB_CHANGED':
      return { text: t.events.JOB[e.payload.change](professionTitle(e.payload.professionId)) };
    case 'EDUCATION_CHANGED': {
      const { change, stage, qualification } = e.payload;
      if (change === 'GRADUATED') return { text: t.events.EDU.GRADUATED(qualification ? t.edu.qualification[qualification] : '') };
      if (change === 'ENROLLED') return { text: t.events.EDU.ENROLLED(t.edu.stage[stage as keyof typeof t.edu.stage] ?? stage) };
      return { text: change === 'DROPPED_OUT' ? t.events.EDU.DROPPED_OUT() : t.events.EDU.FINISHED() };
    }
    case 'EVENT_RESOLVED': {
      const def = contentBundle.events.find((x) => x.id === e.payload.eventId);
      const outcome = def?.choices.find((c) => c.id === e.payload.choiceId)?.outcomes.find((o) => o.id === e.payload.outcomeId);
      const name = e.payload.actorName;
      return { text: fillActor(def?.title ?? e.payload.eventId, name), detail: fillActor(outcome?.text ?? t.history.accepted, name) };
    }
    case 'GOD':
      return { text: t.events.GOD(e.payload.action, e.payload.targetName ?? '', e.payload.changes) };
    case 'ACHIEVEMENT':
      return { text: t.ach.event(t.ach.names[e.payload.id]?.[0] ?? e.payload.id) };
    default:
      return { text: e.type };
  }
}
