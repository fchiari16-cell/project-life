import type { ArchetypeDef, ProfessionDef, Specialization } from '@project-life/schemas';
import { catalog } from './professions-catalog.js';

type ArchetypeInput = Omit<ArchetypeDef, 'volatilityPct'> & { volatilityPct?: number };

/**
 * Career archetypes: eight reusable ladders. A profession names one and inherits its levels, promotion odds
 * and raises, so adding the remaining professions toward the 300 target (M5) is data work, not engine work.
 * Odds and raises are balancing MODEL values, not labour statistics.
 */
const archetypeInputs: ArchetypeInput[] = [
  { id: 'service', title: 'Servizi e vendita', levelTitles: ['Addetto', 'Esperto', 'Responsabile di turno', 'Responsabile'], promotionBp: 1100, raisePct: 8, skill: { stat: 'charisma', trait: 'adaptability' } },
  { id: 'logistics', title: 'Logistica e trasporti', levelTitles: ['Operatore', 'Operatore esperto', 'Caposquadra', 'Coordinatore'], promotionBp: 1000, raisePct: 8, skill: { stat: 'energy', trait: 'discipline' } },
  { id: 'craft', title: 'Mestieri qualificati', levelTitles: ['Apprendista', 'Qualificato', 'Maestro', 'Titolare di bottega'], promotionBp: 1300, raisePct: 11, skill: { stat: 'fitness', trait: 'discipline' } },
  { id: 'office', title: 'Amministrazione e finanza', levelTitles: ['Junior', 'Senior', 'Responsabile', 'Direttore'], promotionBp: 1400, raisePct: 12, skill: { stat: 'intelligence', trait: 'ambition' } },
  { id: 'care', title: 'Sanità e assistenza', levelTitles: ['Operatore', 'Professionista', 'Coordinatore', 'Responsabile di reparto'], promotionBp: 1200, raisePct: 10, skill: { stat: 'health', trait: 'empathy' } },
  { id: 'teaching', title: 'Istruzione', levelTitles: ['Neoassunto', 'Di ruolo', 'Referente', 'Dirigente'], promotionBp: 900, raisePct: 9, skill: { stat: 'charisma', trait: 'empathy' } },
  { id: 'technical', title: 'Tecnologia e ingegneria', levelTitles: ['Junior', 'Mid', 'Senior', 'Principal'], promotionBp: 1700, raisePct: 14, skill: { stat: 'intelligence', trait: 'curiosity' } },
  { id: 'creative', title: 'Professioni creative', levelTitles: ['Collaboratore', 'Autonomo', 'Affermato', 'Direttore creativo'], promotionBp: 1100, raisePct: 13, skill: { stat: 'appearance', trait: 'curiosity' } },
  { id: 'security', title: 'Sicurezza', levelTitles: ['Agente', 'Agente scelto', 'Ispettore', 'Commissario'], promotionBp: 1000, raisePct: 9, skill: { stat: 'fitness', trait: 'selfControl' } },
  { id: 'medical', title: 'Medicina', levelTitles: ['Specializzando', 'Medico', 'Primario', 'Direttore sanitario'], promotionBp: 1100, raisePct: 14, skill: { stat: 'intelligence', trait: 'empathy' } },
  { id: 'legal', title: 'Professioni legali', levelTitles: ['Praticante', 'Associato', 'Partner', 'Socio senior'], promotionBp: 1200, raisePct: 15, skill: { stat: 'intelligence', trait: 'ambition' } },
  { id: 'research', title: 'Ricerca', levelTitles: ['Ricercatore', 'Ricercatore senior', 'Responsabile di gruppo', 'Direttore di ricerca'], promotionBp: 900, raisePct: 11, skill: { stat: 'intelligence', trait: 'curiosity' } },
  // Professional sport: short careers, large swings of income, a few years at the top.
  { id: 'sports', title: 'Sport professionistico', levelTitles: ['Esordiente', 'Professionista', 'Titolare', 'Campione'], promotionBp: 2000, raisePct: 25, skill: { stat: 'fitness', trait: 'discipline' }, maxAge: 38, volatilityPct: 25 },
  // Performing arts: low odds of a breakthrough, very large rewards, unstable pay.
  { id: 'performing', title: 'Spettacolo e arti', levelTitles: ['Emergente', 'Lavorante', 'Affermato', 'Celebrità'], promotionBp: 700, raisePct: 30, skill: { stat: 'charisma', trait: 'ambition' }, volatilityPct: 30 },
  { id: 'management', title: 'Direzione e gestione', levelTitles: ['Responsabile', 'Direttore', 'Direttore generale', 'Amministratore'], promotionBp: 1300, raisePct: 15, skill: { stat: 'charisma', trait: 'ambition' } },
  { id: 'public_service', title: 'Pubblica amministrazione', levelTitles: ['Funzionario', 'Funzionario senior', 'Dirigente', 'Direttore generale'], promotionBp: 800, raisePct: 8, skill: { stat: 'intelligence', trait: 'discipline' } },
];

export const archetypes: ArchetypeDef[] = archetypeInputs.map((a) => ({ volatilityPct: 0, ...a }));

const spec = (id: string, title: string, salaryPct: number): Specialization => ({ id, title, salaryPct });

const p = (
  id: string,
  sector: string,
  archetype: string,
  title: string,
  requires: ProfessionDef['requires'],
  salaryRef: number,
  jobStress: number,
  specializations: Specialization[] = [],
): ProfessionDef => ({
  id,
  sector,
  archetype,
  title,
  // A degree cannot be held before the usual age of graduation.
  minAge: requires.includes('doctorate') ? 26 : requires.includes('master') ? 23 : requires.length > 0 && !requires.includes('secondary') && !requires.includes('vocational') ? 21 : 18,
  requires,
  salaryRef,
  jobStress,
  specializations,
});

/**
 * M3 set: 36 professions in 12 sectors (of the 300+ planned for M5). Salaries are annual EUR cents for a
 * reference economy: MODEL values for balancing, not statistics.
 */
const coreProfessions: ProfessionDef[] = [
  p('sales_associate', 'retail', 'service', 'Commesso/a', [], 1_900_000, 35),
  p('cashier', 'retail', 'service', 'Cassiere/a', [], 1_800_000, 35),
  p('waiter', 'hospitality', 'service', 'Cameriere/a', [], 1_700_000, 50),
  p('hotel_receptionist', 'hospitality', 'service', 'Addetto/a accoglienza', ['secondary', 'vocational', 'bachelor'], 2_000_000, 40),
  p('warehouse_worker', 'logistics', 'logistics', 'Magazziniere/a', [], 1_900_000, 45),
  p('delivery_driver', 'logistics', 'logistics', 'Corriere', [], 2_000_000, 40),
  p('truck_driver', 'logistics', 'logistics', 'Autotrasportatore', ['vocational', 'secondary'], 2_400_000, 50),
  p('construction_worker', 'construction', 'craft', 'Operaio edile', [], 2_100_000, 60),
  p('electrician', 'construction', 'craft', 'Elettricista', ['vocational'], 2_600_000, 45, [spec('industrial', 'Impianti industriali', 118), spec('domestic', 'Impianti civili', 105)]),
  p('plumber', 'construction', 'craft', 'Idraulico', ['vocational'], 2_500_000, 45),
  p('mechanic', 'industry', 'craft', 'Meccanico/a', ['vocational'], 2_500_000, 40, [spec('electric', 'Veicoli elettrici', 120), spec('heavy', 'Mezzi pesanti', 110)]),
  p('cook', 'hospitality', 'craft', 'Cuoco/a', ['vocational'], 2_200_000, 55, [spec('pastry', 'Pasticceria', 108), spec('executive', 'Capo cucina', 125)]),
  p('office_clerk', 'administration', 'office', 'Impiegato/a', ['secondary', 'vocational', 'bachelor'], 2_300_000, 35),
  p('accountant', 'finance', 'office', 'Contabile', ['bachelor'], 3_400_000, 45, [spec('tax', 'Fiscalista', 115), spec('audit', 'Revisione contabile', 122)]),
  p('bank_clerk', 'finance', 'office', 'Impiegato/a di banca', ['bachelor', 'secondary'], 2_900_000, 45),
  p('hr_specialist', 'administration', 'office', 'Addetto/a risorse umane', ['bachelor'], 3_100_000, 45),
  p('nurse', 'health', 'care', 'Infermiere/a', ['vocational', 'bachelor'], 2_900_000, 60, [spec('emergency', 'Emergenza', 115), spec('pediatric', 'Pediatria', 108)]),
  p('care_assistant', 'health', 'care', 'Operatore/trice socio-sanitario', ['vocational', 'secondary'], 2_100_000, 55),
  p('pharmacy_technician', 'health', 'care', 'Tecnico/a di farmacia', ['vocational', 'bachelor'], 2_600_000, 40),
  p('physiotherapist', 'health', 'care', 'Fisioterapista', ['bachelor'], 3_200_000, 45, [spec('sports', 'Fisioterapia sportiva', 118)]),
  p('primary_teacher', 'education', 'teaching', 'Insegnante', ['bachelor'], 3_000_000, 50, [spec('special_needs', 'Sostegno', 110), spec('languages', 'Lingue', 106)]),
  p('teaching_assistant', 'education', 'teaching', 'Assistente scolastico', ['secondary', 'vocational'], 1_900_000, 35),
  p('trainer', 'education', 'teaching', 'Formatore/trice', ['bachelor', 'vocational'], 2_800_000, 40),
  p('software_developer', 'technology', 'technical', 'Sviluppatore/trice software', ['bachelor'], 4_200_000, 45, [spec('backend', 'Backend', 108), spec('security', 'Sicurezza informatica', 125), spec('data', 'Data engineering', 118)]),
  p('it_support', 'technology', 'technical', 'Tecnico/a informatico', ['vocational', 'secondary', 'bachelor'], 2_500_000, 40),
  p('network_admin', 'technology', 'technical', 'Amministratore/trice di rete', ['bachelor', 'vocational'], 3_400_000, 50),
  p('engineer', 'industry', 'technical', 'Ingegnere/a', ['bachelor'], 4_000_000, 45, [spec('civil', 'Civile', 100), spec('electronics', 'Elettronica', 115), spec('mechanical', 'Meccanica', 108)]),
  p('lab_technician', 'industry', 'technical', 'Tecnico/a di laboratorio', ['vocational', 'bachelor'], 2_700_000, 40),
  p('graphic_designer', 'creative', 'creative', 'Grafico/a', ['secondary', 'vocational', 'bachelor'], 2_600_000, 40, [spec('branding', 'Branding', 115), spec('motion', 'Motion design', 120)]),
  p('photographer', 'creative', 'creative', 'Fotografo/a', ['secondary', 'vocational', 'bachelor'], 2_200_000, 35),
  p('journalist', 'media', 'creative', 'Giornalista', ['bachelor'], 2_900_000, 55),
  p('police_officer', 'security', 'security', 'Agente di polizia', ['secondary', 'bachelor'], 2_700_000, 65),
  p('security_guard', 'security', 'security', 'Addetto/a alla sicurezza', ['secondary', 'vocational'], 1_900_000, 50),
  p('firefighter', 'security', 'security', 'Vigile del fuoco', ['secondary', 'vocational', 'bachelor'], 2_600_000, 70),
  p('farm_worker', 'agriculture', 'logistics', 'Operaio/a agricolo/a', [], 1_700_000, 45),
  p('surveyor', 'construction', 'technical', 'Geometra', ['vocational', 'bachelor'], 3_000_000, 40),
];

/** The full catalogue: the original 36 plus the catalogue of M5. */
export const professions: ProfessionDef[] = [...coreProfessions, ...catalog];
