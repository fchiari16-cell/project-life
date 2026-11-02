import type { TalentDef } from '@project-life/schemas';

/** Natural talents. Fictional game design; each one only tilts odds slightly (promotion, studying). */
export const talents: TalentDef[] = [
  { id: 'academic', title: 'Facilità di studio', archetypes: ['research', 'teaching'], academic: true },
  { id: 'athletic', title: 'Dote atletica', archetypes: ['sports', 'security', 'logistics'], academic: false },
  { id: 'musical', title: 'Orecchio musicale', archetypes: ['performing'], academic: false },
  { id: 'artistic', title: 'Occhio artistico', archetypes: ['creative', 'performing'], academic: false },
  { id: 'mathematical', title: 'Mente matematica', archetypes: ['technical', 'research', 'office'], academic: true },
  { id: 'linguistic', title: 'Talento per le lingue', archetypes: ['teaching', 'legal', 'public_service'], academic: false },
  { id: 'leadership', title: 'Leadership naturale', archetypes: ['management', 'public_service', 'legal'], academic: false },
  { id: 'empathic', title: 'Empatia naturale', archetypes: ['care', 'medical', 'teaching'], academic: false },
  { id: 'mechanical', title: 'Manualità', archetypes: ['craft', 'technical', 'logistics'], academic: false },
  { id: 'entrepreneurial', title: 'Fiuto per gli affari', archetypes: ['management', 'office', 'service'], academic: false },
];
