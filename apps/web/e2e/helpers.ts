import { expect, type Page } from '@playwright/test';

/**
 * Creates a life through the real creation screen: fill the form, review, and confirm the definitive choice.
 * `god` selects GOD MODE at creation (the only moment it can be chosen).
 */
export async function createLife(page: Page, opts: { seed?: string; god?: boolean; given?: string; family?: string } = {}): Promise<void> {
  const given = opts.given ?? 'Ada';
  const family = opts.family ?? 'Verdi';
  await page.goto('/');
  await page.getByLabel('Nome', { exact: true }).fill(given);
  await page.getByLabel('Cognome').fill(family);
  await page.getByLabel('Paese di nascita').selectOption('IT');
  await page.getByLabel('Seed').fill(opts.seed ?? 'e2e-seed');
  if (opts.god) await page.getByRole('radio', { name: /GOD MODE: ATTIVA/ }).check();
  await page.getByRole('button', { name: 'Rivedi e conferma' }).click();
  const dialog = page.getByRole('dialog', { name: 'Conferma definitiva' });
  await expect(dialog.getByTestId('confirm-god')).toHaveText(opts.god ? /GOD MODE: ATTIVA/ : /GOD MODE: DISATTIVA/);
  await dialog.getByRole('button', { name: 'Conferma e nasci' }).click();
  await expect(page.getByRole('heading', { name: `${given} ${family}` })).toBeVisible();
}
