import { expect, test, type Page } from '@playwright/test';

async function createLife(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Nome', { exact: true }).fill('Ada');
  await page.getByLabel('Cognome').fill('Verdi');
  await page.getByLabel('Paese di nascita').selectOption('IT');
  await page.getByLabel('Seed').fill('e2e-god');
  await page.getByRole('button', { name: 'Nasci' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
}

test('M6 flow: GOD MODE preview → confirm → log, survives reload and offline; backup works offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await createLife(page);
  await page.getByRole('link', { name: 'Altro' }).first().click();

  const god = page.getByRole('region', { name: 'GOD MODE' });
  await expect(god.getByText('GOD MODE spento')).toBeVisible();
  await expect(god.getByRole('button', { name: 'Modifica profilo (GOD MODE)' })).toHaveCount(0);

  await god.getByRole('button', { name: 'Attiva GOD MODE' }).click();
  await expect(god.getByText('GOD MODE attivo')).toBeVisible();
  await god.getByRole('button', { name: 'Modifica profilo (GOD MODE)' }).click();

  const form = page.getByRole('form');
  await form.getByLabel('Nome', { exact: true }).fill('Nova');
  await form.getByLabel('Orecchio musicale').check();
  await expect(form.getByRole('region', { name: 'Anteprima' })).toContainText('Nome: Ada → Nova');
  await form.getByRole('button', { name: 'Conferma e salva' }).click();

  await expect(god.getByText('1 modifica effettuata')).toBeVisible();
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

  // full backup and integrity check need no network
  await page.getByRole('link', { name: 'Altro' }).first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica backup di tutte le vite' }).click();
  expect((await download).suggestedFilename()).toMatch(/^project-life-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await page.getByRole('button', { name: 'Verifica integrità' }).click();
  await expect(page.getByText('Tutti i salvataggi sono integri.')).toBeVisible();

  // the optional services are off by default and need no connection to stay that way
  await expect(page.getByLabel('Abilita sincronizzazione cloud')).not.toBeChecked();
  await expect(page.getByLabel('Abilita narrazione AI')).not.toBeChecked();
  await context.setOffline(false);
});
