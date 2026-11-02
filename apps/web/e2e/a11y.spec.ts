import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function createLife(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Nome', { exact: true }).fill('Ada');
  await page.getByLabel('Cognome').fill('Verdi');
  await page.getByLabel('Paese di nascita').selectOption('IT');
  await page.getByLabel('Seed').fill('e2e-a11y');
  await page.getByRole('button', { name: 'Nasci' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
}

const audit = async (page: Page, where: string): Promise<void> => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const report = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')}`);
  expect(report, `${where}\n${report.join('\n')}`).toEqual([]);
};

test('accessibility: no WCAG 2.1 A/AA violations on any page, in light and dark, desktop and phone', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await audit(page, 'new-life form');
  await createLife(page);

  const pages: [string, string][] = [
    ['Vita', 'life'],
    ['Relazioni', 'relationships'],
    ['Carriera', 'career'],
    ['Finanze', 'finance'],
    ['Altro', 'more'],
  ];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [label, name] of pages) {
      await page.getByRole('link', { name: label }).first().click();
      await expect(page.getByRole('main')).toBeVisible();
      await audit(page, `${name} (${scheme})`);
    }
    for (const path of ['/mondo', '/societa']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await audit(page, `${path} (${scheme})`);
    }
  }

  // GOD MODE editor open (many sliders and checkboxes)
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('link', { name: 'Altro' }).first().click();
  const god = page.getByRole('region', { name: 'GOD MODE' });
  await god.getByRole('button', { name: 'Attiva GOD MODE' }).click();
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
