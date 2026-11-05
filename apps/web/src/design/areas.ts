/** Thematic areas of the UI; each maps to a `data-area` block in tokens.css. */
export const AREAS = ['health', 'relationships', 'education', 'finance', 'career', 'luxury', 'underground'] as const;
export type Area = (typeof AREAS)[number];
