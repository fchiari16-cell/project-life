import { expect, test } from '@playwright/test';
import { createLife } from './helpers';

test('relationships are lists: grouped, each row opens a sheet with both directions of the feeling', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r3' });
  await page.getByRole('link', { name: 'Relazioni' }).first().click();
  await expect(page.getByRole('heading', { name: 'Famiglia' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /Genitori/ })).toBeVisible();
  const parents = page.getByRole('list', { name: 'Genitori' });
  await expect(parents.getByRole('link')).toHaveCount(2);
  await expect(parents.getByRole('meter').first()).toBeVisible(); // how they feel about you

  await parents.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/relazioni\/.+/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(14); // 7 dimensions, both directions
  await expect(page.getByRole('heading', { name: 'Ricordi' })).toBeVisible();

  // without GOD MODE, editing is shown as blocked, with the reason and what would unlock it
  const edit = page.getByRole('button', { name: /Modifica personaggio/ });
  await expect(edit).toHaveAttribute('aria-disabled', 'true');
  await expect(edit).toHaveAccessibleDescription(/creata senza GOD MODE.*si sceglie solo alla creazione/);

  await page.getByRole('link', { name: 'Relazioni' }).first().click();
  await expect(page).toHaveURL(/\/relazioni$/);
});

test('a row\'s contextual menu works from the keyboard and explains a blocked action', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r3-menu' });
  await page.getByRole('link', { name: 'Relazioni' }).first().click();
  const trigger = page.getByRole('button', { name: /^Azioni per / }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const blocked = menu.getByRole('menuitem', { name: /Modifica personaggio/ });
  await expect(blocked).toHaveAttribute('aria-disabled', 'true');
  await expect(blocked).toContainText('Questa vita è stata creata senza GOD MODE.');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Apri la scheda' }).click();
  await expect(page).toHaveURL(/\/relazioni\/.+/);
});

test('with GOD MODE chosen at creation, the same menu opens the editor on the person', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r3-god', god: true });
  await page.getByRole('link', { name: 'Relazioni' }).first().click();
  await page.getByRole('button', { name: /^Azioni per / }).first().click();
  const item = page.getByRole('menuitem', { name: /Modifica personaggio/ });
  await expect(item).not.toHaveAttribute('aria-disabled', 'true');
  await item.click();
  await expect(page.getByRole('form', { name: /Modifica:/ })).toBeVisible();
});

test('the decision window says what kind of event it is and never previews the outcome', async ({ page }) => {
  test.setTimeout(120_000);
  await createLife(page, { seed: 'e2e-ui-r3-event' });
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 40 && (await dialog.count()) === 0; i++) {
    const date = page.locator('header').getByText(/^\d{2}\/\d{2}\/\d{4}$/);
    const before = await date.textContent();
    await page.getByRole('button', { name: 'Avanza di un anno' }).click();
    await expect.poll(async () => (await dialog.count()) > 0 || (await date.textContent()) !== before, { timeout: 10_000 }).toBe(true);
  }
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tipo di evento')).toBeAttached();
  await expect(dialog.getByText(/Gli esiti non sono noti in anticipo/)).toBeVisible();
  await expect(dialog.getByRole('button').first()).toBeVisible();
});

test('features that do not exist yet are shown as planned, focusable and explained, and do nothing', async ({ page }) => {
  await createLife(page, { seed: 'e2e-ui-r3-planned' });
  await page.getByRole('banner').getByRole('button', { name: 'Apri il menu' }).click();
  const row = page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: /Albero genealogico/ });
  await expect(row).toHaveAttribute('aria-disabled', 'true');
  await expect(row).toHaveAccessibleDescription(/Non ancora disponibile/);
  await row.focus();
  await expect(row).toBeFocused();
  await row.click({ force: true }); // Playwright treats aria-disabled as not actionable: force the click to prove nothing happens
  await expect(page).toHaveURL(/\/$/); // nothing happened
});
