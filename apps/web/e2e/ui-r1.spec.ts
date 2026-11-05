import { expect, test, type Locator, type Page } from '@playwright/test';
import { createLife } from './helpers';

const textOf = async (l: Locator): Promise<string | null> => ((await l.count()) === 0 ? null : l.first().textContent({ timeout: 500 }).catch(() => null));

/** Advances until a decision window opens; returns its title. */
async function untilDecision(page: Page): Promise<string> {
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 40; i++) {
    const title = await textOf(dialog.getByRole('heading'));
    if (title) return title;
    const date = await textOf(page.getByRole('banner').getByText(/^\d{2}\/\d{2}\/\d{4}$/));
    await page.getByRole('button', { name: 'Avanza di un anno' }).click();
    await expect.poll(async () => (await textOf(dialog.getByRole('heading'))) !== null || (await textOf(page.getByRole('banner').getByText(/^\d{2}\/\d{2}\/\d{4}$/))) !== date, { timeout: 10_000 }).toBe(true);
  }
  throw new Error('no decision appeared');
}

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

for (const size of SIZES) {
  test(`layout on ${size.name}: menu top-left, yearly button reachable, navigation fits, no horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await createLife(page, { seed: 'e2e-ui-r1' });

    const header = page.getByRole('banner');
    const menu = header.getByRole('button', { name: 'Apri il menu' });
    const menuBox = (await menu.boundingBox())!;
    const avatarLink = header.getByRole('link', { name: /Profilo completo/ });
    const linkBox = (await avatarLink.boundingBox())!;
    expect(menuBox.y, 'menu is in the top bar').toBeLessThan(80);
    expect(menuBox.x, 'menu is left of the protagonist').toBeLessThan(linkBox.x);
    expect(menuBox.width).toBeGreaterThanOrEqual(44); // touch target

    const advance = page.getByRole('button', { name: 'Avanza di un anno' });
    const box = (await advance.boundingBox())!;
    expect(box.y + box.height, 'yearly button is inside the viewport without scrolling').toBeLessThanOrEqual(size.height);
    expect(box.height).toBeGreaterThanOrEqual(44);

    const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
    const navBox = (await nav.boundingBox())!;
    if (size.width < 768) {
      expect(navBox.y + navBox.height, 'bottom navigation on phones').toBeGreaterThanOrEqual(size.height - 1);
      expect(box.y + box.height, 'yearly button sits above the bottom navigation').toBeLessThanOrEqual(navBox.y);
    } else {
      expect(navBox.x, 'sidebar on tablet and desktop').toBeLessThan(2);
      expect(navBox.height).toBeGreaterThanOrEqual(size.height - 2);
    }
    for (const label of ['Vita', 'Relazioni', 'Carriera', 'Finanze', 'Altro']) await expect(nav.getByRole('link', { name: label })).toBeVisible();

    await expect(page.getByRole('meter')).toHaveCount(8);
    await expect(page.getByTestId('diary')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
  });
}

test('the diary is persistent and tied to real events; the decision window blocks and resumes', async ({ page }) => {
  test.setTimeout(120_000);
  await createLife(page, { seed: 'e2e-ui-r1' });
  const diary = page.getByTestId('diary');
  await expect(diary.getByText('Vita creata')).toBeVisible();

  const title = await untilDecision(page);
  const dialog = page.getByRole('dialog');
  await page.keyboard.press('Escape');
  await expect(dialog, 'a mandatory decision cannot be dismissed').toBeVisible();
  await expect(page.getByRole('button', { name: 'Avanza di un anno', includeHidden: true })).toBeDisabled(); // the page behind a modal is hidden from assistive tech

  // reload with the decision pending: the same window comes back
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(title);

  await page.getByRole('dialog').getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(diary.getByText(title).first()).toBeVisible();

  const entries = await diary.locator('li').allTextContents();
  await page.reload();
  await expect(page.getByTestId('diary').locator('li')).toHaveCount(entries.length);
  expect(await page.getByTestId('diary').locator('li').allTextContents()).toEqual(entries);
});

test('keyboard: the menu opens from the keyboard, traps focus, closes with Escape and returns focus', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r1' });
  const menuButton = page.getByRole('banner').getByRole('button', { name: 'Apri il menu' });
  await menuButton.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Nuova vita');
  await expect(menu).not.toContainText(/god mode/i); // GOD MODE is chosen at life creation only (T71)
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus stays inside the menu').toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test('menu links reach their sections and the protagonist link opens the profile', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r1' });
  await page.getByRole('banner').getByRole('button', { name: 'Apri il menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: /Importazione\/esportazione/ }).click();
  await expect(page).toHaveURL(/\/altro#backup-all$/);
  await expect(page.getByRole('heading', { name: 'Backup completo' })).toBeInViewport();
  await page.getByRole('banner').getByRole('link', { name: /Profilo completo/ }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByRole('heading', { name: 'Ada Verdi' })).toBeVisible();
  await expect(page.getByText('Nato/a il')).toBeVisible();
});
