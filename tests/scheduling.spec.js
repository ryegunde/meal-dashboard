const { test, expect } = require('@playwright/test');

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 5000 });
}

test.describe('Meal Scheduling & Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForApp(page);
  });

  test('should search and assign a meal', async ({ page }) => {
    await page.locator('.day-column.is-today .add-meal-slot').first().click();
    await expect(page.locator('#meal-picker-modal')).toBeVisible();
    
    const searchInput = page.locator('#recipe-search-input');
    await searchInput.fill('Cava');
    
    // Valid name from seedData: "Cava Bowl"
    const item = page.locator('.recipe-picker-item h4', { hasText: 'Cava Bowl' }).first();
    await expect(item).toBeVisible({ timeout: 3000 });
    await item.click();
    
    await expect(page.locator('.day-column.is-today .meal-card')).toContainText('Cava Bowl');
  });

  test('should remove a meal', async ({ page }) => {
    await page.locator('.add-meal-slot').first().click();
    // Using an actual recipe: Cava Bowl
    const item = page.locator('.recipe-picker-item h4', { hasText: 'Cava Bowl' }).first();
    await item.click();
    
    const card = page.locator('.meal-card').first();
    await card.click();
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Delete")');
    
    await expect(card).not.toBeVisible();
  });
});
