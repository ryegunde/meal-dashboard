const { test, expect } = require('@playwright/test');

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 10000 });
}

test.describe('Mastery Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForApp(page);
  });

  test('can add a mastery task, update PR time, and persist after reload', async ({ page }) => {
    await page.click('li[data-view="mastery"]');

    await page.fill('#mastery-task-name', 'Dice onions');
    await page.fill('#mastery-task-pr-minutes', '7.5');
    await page.click('#btn-add-mastery-task');

    const taskCard = page.locator('.mastery-task-card:has-text("Dice onions")');
    await expect(taskCard).toBeVisible();
    await expect(taskCard.locator('.mastery-pr-input')).toHaveValue('7.5');

    await taskCard.locator('.mastery-pr-input').fill('6.9');
    await taskCard.locator('.mastery-pr-input').press('Enter');
    await expect(taskCard.locator('.mastery-pr-input')).toHaveValue('6.9');

    await page.reload();
    await waitForApp(page);
    await page.click('li[data-view="mastery"]');

    const persistedCard = page.locator('.mastery-task-card:has-text("Dice onions")');
    await expect(persistedCard).toBeVisible();
    await expect(persistedCard.locator('.mastery-pr-input')).toHaveValue('6.9');
  });
});
