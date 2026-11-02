import type { SimDate } from '@project-life/schemas';

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export const isValidDate = (d: SimDate): boolean =>
  d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= daysInMonth(d.year, d.month);

/**
 * One calendar month later, keeping the anchor day-of-month (clamped to the month length).
 * A 29 Feb birthday therefore lands on 28 Feb in common years and returns to 29 Feb in leap years.
 */
export function addMonth(d: SimDate, anchorDay: number): SimDate {
  const year = d.month === 12 ? d.year + 1 : d.year;
  const month = d.month === 12 ? 1 : d.month + 1;
  return { year, month, day: Math.min(anchorDay, daysInMonth(year, month)) };
}
