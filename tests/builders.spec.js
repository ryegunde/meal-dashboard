const { test, expect } = require('@playwright/test');

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 5000 });
}

test.describe('Food & Recipe Builders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForApp(page);
  });

  test('should create a new food pipeline', async ({ page }) => {
    await page.click('li[data-view="foods"]');
    await page.click('#btn-add-food');
    
    await page.fill('#food-name', 'Test Protein');
    await page.fill('#food-category', 'Proteins');
    
    const stageRow = page.locator('.stage-builder-item').first();
    await stageRow.locator('.stage-name').fill('Frozen');
    await stageRow.locator('.stage-days').fill('5');
    await page.click('#btn-save-food');
    
    // Open Proteins accordion to see the new food
    await page.click('.inventory-accordion-header:has-text("Proteins")');
    
    const foodCard = page.locator('.recipe-item', { hasText: 'Test Protein' }).first();
    await expect(foodCard).toBeVisible();
    await expect(foodCard.locator('.food-stage-pill')).toContainText('Frozen (5d)');
  });

  test('should create a new recipe with units', async ({ page }) => {
    await page.click('li[data-view="recipes"]');
    await page.click('#btn-add-recipe');
    
    await page.fill('#recipe-name', 'Quick Bowl');
    await page.fill('#recipe-portions', '2');
    
    const ingRow = page.locator('.ingredient-builder-item').first();
    await ingRow.locator('.ingredient-select').selectOption({ label: 'Chicken Breast' });
    await ingRow.locator('.ingredient-qty').fill('150');
    // Unit is now a read-only label derived from the food - verify it shows 'g'
    await expect(ingRow.locator('.ingredient-unit-label')).toHaveText('g');
    
    await page.click('#btn-save-recipe');
    const recipeItem = page.locator('.recipe-item:has-text("Quick Bowl")');
    await expect(recipeItem).toBeVisible();
    await expect(recipeItem).toContainText('150g Chicken Breast');
  });

  test('should delete a recipe and remove from calendar', async ({ page }) => {
    await page.locator('.add-meal-slot').first().click();
    // Using actual recipe: "Cava Bowl" (it contains Chicken Breast in ingredients, but name is Cava Bowl)
    // Wait, let's use "Rattle Snake Pasta" which also contains Chicken Breast.
    const pickerItem = page.locator('.recipe-picker-item h4', { hasText: 'Cava Bowl' }).first();
    await expect(pickerItem).toBeVisible();
    await pickerItem.click();
    await expect(page.locator('.meal-card:has-text("Cava Bowl")').first()).toBeVisible();
    
    await page.click('li[data-view="recipes"]');
    page.on('dialog', dialog => dialog.accept());
    await page.locator('.recipe-item', { hasText: 'Cava Bowl' }).first().locator('.btn-delete-recipe').click();
    
    await page.click('li[data-view="calendar"]');
    await expect(page.locator('.meal-card:has-text("Cava Bowl")')).not.toBeVisible();
  });
});
