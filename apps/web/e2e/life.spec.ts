import { expect, test, type Locator, type Page } from '@playwright/test';

async function createLife(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Nome', { exact: true }).fill('Ada');
  await page.getByLabel('Cognome').fill('Verdi');
  await page.getByLabel('Paese di nascita').selectOption('IT');
  await page.getByLabel('Seed').fill('e2e-seed');
  await page.getByRole('button', { name: 'Nasci' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
}

/** One interaction: answer a pending decision if there is one, otherwise advance a year. */
async function step(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  const heading = dialog.getByRole('heading');
  const date = page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first();
  const before = await textOf(date);
  const title = await textOf(heading);
  if (title !== null) await dialog.getByRole('button').first().click();
  else await page.getByRole('button', { name: 'Avanza di un anno' }).click();
  // Done when the clock moved, or the decision card changed or went away.
  await expect
    .poll(async () => (await textOf(date)) !== before || (title !== null && (await textOf(heading)) !== title), {
      timeout: 10_000,
      message: `step did not complete (dialog=${String(title)}, date=${String(before)})`,
    })
    .toBe(true);
}

/** Text of a locator, or null when it is not there (never blocks: elements come and go while the app updates). */
const textOf = async (l: Locator): Promise<string | null> =>
  (await l.count()) === 0 ? null : l.first().textContent({ timeout: 500 }).catch(() => null);

test('M1 flow: create → decisions → persists across reload → offline → full life to death', async ({ page, context }) => {
  test.setTimeout(240_000); // a whole human life is ~80 clicks plus decisions
  await createLife(page);
  await expect(page.getByText('0 anni').first()).toBeVisible();

  // Play a few years; the first decision card must be a real, answerable dialog.
  for (let i = 0; i < 4; i++) await step(page);

  // Reload: state (including any pending decision) is restored from IndexedDB.
  const ageBefore = await page.getByText(/^\d+ anni?$/).first().textContent();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
  await expect(page.getByText(/^\d+ anni?$/).first()).toHaveText(ageBefore ?? '');

  // Offline: the service worker serves the app and the simulation keeps running.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
  for (let i = 0; i < 3; i++) await step(page);
  await context.setOffline(false);

  // Secondary pages show real data.
  await page.getByRole('link', { name: 'Relazioni' }).click();
  await expect(page.getByRole('heading', { name: 'Famiglia' })).toBeVisible();
  await expect(page.getByText('Genitore').first()).toBeVisible();
  await page.getByRole('link', { name: 'Finanze' }).click();
  await expect(page.getByRole('heading', { name: 'Saldi' })).toBeVisible();
  await page.getByRole('link', { name: 'Altro' }).click();
  await page.getByRole('link', { name: 'Mondo' }).click();
  await expect(page.getByRole('heading', { name: 'Cronaca del mondo' })).toBeVisible();
  await expect(page.getByText('dove vivi')).toBeVisible();
  await page.getByRole('link', { name: 'Altro' }).click();
  await page.getByRole('link', { name: 'Società' }).click();
  await expect(page.getByRole('heading', { name: 'Giustizia' })).toBeVisible();
  await page.getByRole('link', { name: 'Vita' }).click();

  // Birth to death.
  const ended = page.getByRole('heading', { name: 'La vita è finita' });
  for (let i = 0; i < 400 && !(await ended.isVisible()); i++) await step(page);
  await expect(ended).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avanza di un anno' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'La vita è finita' })).toBeVisible();

  // Dynasty: the next generation is born at once, as a child of a living relative.
  await page.getByLabel('Nome del neonato/a').fill('Nova');
  await page.getByRole('button', { name: 'Nasce la nuova generazione' }).click();
  await expect(page.getByRole('heading', { name: /^Nova / })).toBeVisible();
  await expect(page.getByText('Generazione 2').first()).toBeVisible();
  await expect(page.getByText('0 anni').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Nova / })).toBeVisible();
  await page.getByRole('link', { name: 'Altro' }).click();
  await expect(page.getByRole('heading', { name: 'Cronaca della dinastia' })).toBeVisible();
  await expect(page.getByText('Generazione 1: Ada Verdi')).toBeVisible();
});

test('theme toggle and navigation', async ({ page }) => {
  await page.goto('/altro');
  await page.getByLabel('Scuro').check();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByLabel('Chiaro').check();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('link', { name: 'Finanze' }).click();
  await expect(page.getByRole('heading', { name: 'Finanze' })).toBeVisible();
});

test('language: Arabic switches the interface to right-to-left, is remembered, and Italian can be restored', async ({ page }) => {
  await page.goto('/altro');
  await page.getByRole('combobox', { name: 'Lingua' }).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('link', { name: 'الحياة' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'الحياة' })).toBeVisible();
  await page.getByRole('combobox', { name: 'اللغة' }).selectOption('it');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('link', { name: 'Vita' })).toBeVisible();
});
