import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createLife } from './helpers';

/** With `scheme`, first proves the theme really is applied: an audit of the wrong theme proves nothing. */
const audit = async (page: Page, where: string, scheme?: 'light' | 'dark'): Promise<void> => {
  if (scheme) {
    await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark)/);
    // background AND text colours must both have switched (a browser can restyle one before the other)
    const expected = scheme === 'dark' ? { bg: 'rgb(15, 18, 32)', fg: 'rgb(232, 234, 242)' } : { bg: 'rgb(246, 247, 251)', fg: 'rgb(20, 23, 43)' };
    await expect
      .poll(() =>
        page.evaluate(
          ([bg, fg]) =>
            getComputedStyle(document.body).backgroundColor === bg &&
            [document.body, ...document.querySelectorAll('nav p, main h1, h2')].every((e) => getComputedStyle(e).color === fg),
          [expected.bg, expected.fg] as const,
        ),
      )
      .toBe(true);
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const report = results.violations.map((v) => {
    const d = v.nodes[0]?.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
    const colours = d?.contrastRatio !== undefined ? ` [fg ${d.fgColor} bg ${d.bgColor} ratio ${d.contrastRatio}]` : '';
    return `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')}${colours}`;
  });
  expect(report, `${where}\n${report.join('\n')}`).toEqual([]);
};

test('accessibility: no WCAG 2.1 A/AA violations on any page, in light and dark, desktop and phone', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await audit(page, 'new-life form');
  await createLife(page, { seed: 'e2e-a11y', god: true });

  const pages: [string, string][] = [
    ['Vita', 'life'],
    ['Relazioni', 'relationships'],
    ['Carriera', 'career'],
    ['Finanze', 'finance'],
    ['Altro', 'more'],
  ];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' }); // no mid-transition colours for axe
    for (const [label, name] of pages) {
      await page.getByRole('link', { name: label }).first().click();
      await expect(page.getByRole('main')).toBeVisible();
      await audit(page, `${name} (${scheme})`, scheme);
    }
    for (const path of ['/mondo', '/societa']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await audit(page, `${path} (${scheme})`, scheme);
    }
  }

  // GOD MODE editor open (many sliders and checkboxes)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Altro' }).first().click();
  const god = page.getByRole('region', { name: 'GOD MODE' });
  await expect(god.getByTestId('god-status')).toContainText('GOD MODE: attiva');
  await god.getByRole('button', { name: 'Modifica profilo (GOD MODE)' }).click();
  await expect(page.getByRole('form')).toBeVisible();
  await audit(page, 'GOD MODE editor');

  // phone width: reflow without horizontal scrolling
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [label, name] of pages) {
    await page.getByRole('link', { name: label }).first().click();
    await expect(page.getByRole('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${name}`).toBeLessThanOrEqual(0);
    await audit(page, `${name} (phone)`);
  }
});

test('accessibility of the new surfaces: profile, settings menu (light and dark) and the decision window', async ({ page }) => {
  test.setTimeout(180_000);
  await createLife(page, { seed: 'e2e-a11y' });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // the creation screen with GOD MODE chosen (customisation panel open) and its definitive confirmation
  await page.goto('/nuova-vita');
  await page.getByLabel('Nome', { exact: true }).fill('Bea');
  await page.getByLabel('Cognome').fill('Neri');
  await page.getByRole('radio', { name: /GOD MODE: ATTIVA/ }).check();
  await expect(page.getByRole('group', { name: 'Statistiche visibili' })).toBeVisible();
  await audit(page, 'new life form (GOD MODE on)', 'light');
  await page.getByRole('button', { name: 'Rivedi e conferma' }).click();
  await expect(page.getByRole('dialog', { name: 'Conferma definitiva' })).toBeVisible();
  await audit(page, 'confirmation dialog', 'light');
  await page.getByRole('button', { name: 'Indietro' }).click();

  await page.goto('/profilo');
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
  await audit(page, 'profile', 'light');

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.getByRole('banner').getByRole('button', { name: 'Apri il menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await audit(page, `menu (${scheme})`, scheme);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  // decision window, in both themes
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 40 && (await dialog.count()) === 0; i++) {
    const before = await page.getByRole('banner').getByText(/^\d{2}\/\d{2}\/\d{4}$/).first().textContent();
    await page.getByRole('button', { name: 'Avanza di un anno' }).click();
    await expect.poll(async () => (await dialog.count()) > 0 || (await page.getByRole('banner').getByText(/^\d{2}\/\d{2}\/\d{4}$/).first().textContent()) !== before, { timeout: 10_000 }).toBe(true);
  }
  await expect(dialog).toBeVisible();
  await audit(page, 'decision window (light)', 'light');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await audit(page, 'decision window (dark)', 'dark');
});
