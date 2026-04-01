const { test, expect } = require('@playwright/test');

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 10000 });
}

test.describe('Inventory & Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForApp(page);
  });

  test('should update inventory and trigger simulation', async ({ page }) => {
    // 1. Assign Cava Bowl
    await page.locator('.add-meal-slot').first().click();
    await page.locator('.recipe-picker-item h4', { hasText: 'Cava Bowl' }).first().click();
    
    const mealCard = page.locator('.meal-card').first();
    await expect(mealCard).toContainText('Cava Bowl');
    
    // 2. Go to inventory and add ingredients
    await page.click('li[data-view="inventory"]');
    
    const chickenAccordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Thighs' }).first();
    await chickenAccordion.locator('.inventory-accordion-header').click();
    
    const input = chickenAccordion.locator('.inv-qty-input').first();
    await input.fill('1000');
    await input.press('Enter');
    
    // 3. Go back to calendar and verify
    await page.click('li[data-view="calendar"]');
    // Ensure we are back and card is visible
    await expect(mealCard).toBeVisible();
    await mealCard.click();
    
    // Wait for debug panel to open
    await expect(page.locator('#debug-panel')).toHaveClass(/open/);
    
    const req = page.locator('.ingredient-req', { hasText: 'Chicken Thighs' }).first();
    await expect(req).toContainText('Have: 1000', { timeout: 3000 });
  });

  test('should persist all changes after refresh', async ({ page }) => {
    await page.click('li[data-view="foods"]');
    await page.click('#btn-add-food');
    await page.fill('#food-name', 'PersistFood');
    await page.locator('.stage-name').first().fill('Fresh');
    await page.locator('.stage-days').first().fill('0');
    await page.click('#btn-save-food');
    
    await page.reload();
    await waitForApp(page);
    
    await page.click('li[data-view="foods"]');
    await expect(page.locator('.recipe-item:has-text("PersistFood")')).toBeVisible();
  });
});
