import type { DynastyInput, NewLifeInput } from './store';

/** Test helpers: a complete creation input with sensible defaults (GOD MODE off unless a test chooses it). */
export const newLifeInput = (over: Partial<NewLifeInput> = {}): NewLifeInput => ({
  givenName: 'Ada',
  familyName: 'Verdi',
  seed: 'abc',
  countryCode: 'IT',
  city: null,
  birthDate: null,
  godModeEnabled: false,
  ...over,
});

export const dynastyInput = (over: Partial<DynastyInput> = {}): DynastyInput => ({
  fromSaveId: null,
  givenName: 'Nova',
  seed: 'next-gen',
  parentId: null,
  godModeEnabled: false,
  ...over,
});
