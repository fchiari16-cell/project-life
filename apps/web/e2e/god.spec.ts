import { expect, test } from '@playwright/test';
import { createLife } from './helpers';

test('GOD MODE off: nothing in the game offers it, and the settings only say it is not active', async ({ page }) => {
  await createLife(page, { seed: 'e2e-god-off' });
  await page.getByRole('link', { name: 'Altro' }).first().click();
  const god = page.getByRole('region', { name: 'GOD MODE' });
  await expect(god.getByTestId('god-status')).toHaveText('GOD MODE: non attiva');
  await expect(god.getByText(/bloccata per tutta la vita/)).toBeVisible();
  await expect(god.getByRole('button')).toHaveCount(0); // no edit, no enable: nothing to press
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /GOD MODE/ })).toHaveCount(0);

  // not in the settings menu either
  await page.getByRole('banner').getByRole('button', { name: 'Apri il menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).not.toContainText(/god mode/i);
});

test('GOD MODE chosen at creation: customise the newborn, edit later with preview → confirm, locked, persistent, offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Nome', { exact: true }).fill('Ada');
  await page.getByLabel('Cognome').fill('Verdi');
  await page.getByLabel('Paese di nascita').selectOption('IT');
  await page.getByLabel('Seed').fill('e2e-god-on');

  // the choice, with the explanation that it will be locked; customisation appears only when ON
  await expect(page.getByRole('radio', { name: /GOD MODE: DISATTIVA/ })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Statistiche visibili' })).toHaveCount(0);
  await page.getByRole('radio', { name: /GOD MODE: ATTIVA/ }).check();
  await page.getByLabel('Aspetto').fill('93');
  await page.getByLabel('Orecchio musicale').check();
  await expect(page.getByRole('region', { name: 'Anteprima' })).toContainText(/Aspetto: \d+ → 93/);

  // definitive confirmation: it states the choice; going back changes nothing
  await page.getByRole('button', { name: 'Rivedi e conferma' }).click();
  const dialog = page.getByRole('dialog', { name: 'Conferma definitiva' });
  await expect(dialog.getByTestId('confirm-god')).toContainText('GOD MODE: ATTIVA');
  await dialog.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toHaveCount(0); // not created yet
  await page.getByRole('button', { name: 'Rivedi e conferma' }).click();
  await page.getByRole('dialog', { name: 'Conferma definitiva' }).getByRole('button', { name: 'Conferma e nasci' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();

  // the customisation was applied at birth and recorded
  await page.getByRole('link', { name: 'Altro' }).first().click();
  const god = page.getByRole('region', { name: 'GOD MODE' });
  await expect(god.getByTestId('god-status')).toContainText('GOD MODE: attiva');
  await expect(god.getByText(/stats\.appearance: \d+ → 93/)).toBeVisible();
  await expect(god.getByText(/talents: —/)).toBeVisible();
  await expect(god.getByRole('radio')).toHaveCount(0); // locked: no control to change the choice

  // a later edit: preview → confirm → log
  await god.getByRole('button', { name: 'Modifica profilo (GOD MODE)' }).click();
  const form = page.getByRole('form');
  await form.getByLabel('Nome', { exact: true }).fill('Nova');
  await expect(form.getByRole('region', { name: 'Anteprima' })).toContainText('Nome: Ada → Nova');
  await form.getByRole('button', { name: 'Conferma e salva' }).click();
  await expect(god.getByText('2 modifiche effettuate')).toBeVisible();
  await expect(god.getByText('givenName: Ada → Nova')).toBeVisible();

  // persisted: reload, then go offline and reload again
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: 'Vita' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nova Verdi' })).toBeVisible();

  // still locked after a reload; full backup and integrity check need no network
  await page.getByRole('link', { name: 'Altro' }).first().click();
  await expect(page.getByRole('region', { name: 'GOD MODE' }).getByTestId('god-status')).toContainText('GOD MODE: attiva');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica backup di tutte le vite' }).click();
  expect((await download).suggestedFilename()).toMatch(/^project-life-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await page.getByRole('button', { name: 'Verifica integrità' }).click();
  await expect(page.getByText('Tutti i salvataggi sono integri.')).toBeVisible();

  // optional services off by default
  await expect(page.getByLabel('Abilita sincronizzazione cloud')).not.toBeChecked();
  await expect(page.getByLabel('Abilita narrazione AI')).not.toBeChecked();
  await context.setOffline(false);
});
