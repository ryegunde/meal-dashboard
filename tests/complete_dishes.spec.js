const { test, expect } = require('@playwright/test');

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 5000 });
}

test.describe('Complete Dishes Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await waitForApp(page);
  });

  test('should create a complete dish, stock it, schedule it, and verify status and cleanup', async ({ page }) => {
    // 1. Create a Complete Dish recipe
    await page.click('li[data-view="recipes"]');
    await page.click('#btn-add-recipe');
    
    await page.fill('#recipe-name', 'Test Complete Pasta');
    await page.fill('#recipe-portions', '4');
    
    // Choose "Complete dish" from dropdown
    await page.selectOption('#recipe-dish-type', 'Complete dish');
    
    // Add one ingredient so it's a valid recipe (e.g. Flour)
    const ingRow = page.locator('.ingredient-builder-item').first();
    await ingRow.locator('.ingredient-select').selectOption({ label: 'Flour' });
    await ingRow.locator('.ingredient-qty').fill('100');
    
    await page.click('#btn-save-recipe');
    
    const recipeItem = page.locator('.recipe-item:has-text("Test Complete Pasta")');
    await expect(recipeItem).toBeVisible();
    await expect(recipeItem).toContainText('Complete dish');

    // 2. Go to Inventory, check that "Complete Dishes" category exists and "Test Complete Pasta" is present
    await page.click('li[data-view="inventory"]');
    
    const categoryHeader = page.locator('.inventory-category h3:has-text("Complete Dishes")');
    await expect(categoryHeader).toBeVisible();
    
    const dishHeader = page.locator('.inventory-accordion-item[data-recipe-id] .inventory-accordion-header', { hasText: 'Test Complete Pasta' });
    await expect(dishHeader).toBeVisible();
    await expect(dishHeader).toContainText('Total: 0 portion(s)');

    // 3. Schedule the meal on the calendar (should be Red status initially because stocked portions = 0)
    await page.click('li[data-view="calendar"]');
    
    // Click first slot today
    const slot = page.locator('.day-column.is-today .add-meal-slot').first();
    const dateStr = await slot.getAttribute('data-date');
    await slot.click();
    
    const searchInput = page.locator('#recipe-search-input');
    await searchInput.fill('Test Complete');
    const pickerItem = page.locator('.recipe-picker-item h4', { hasText: 'Test Complete Pasta' }).first();
    await pickerItem.click();
    
    // Check if the prompt for multi-day assignment appears and dismiss it
    const promptModal = page.locator('#multi-day-modal');
    if (await promptModal.isVisible()) {
      await page.click('#btn-multi-day-no');
    }

    // Verify it is Red status
    const mealCard = page.locator('.day-column.is-today .meal-card:has-text("Test Complete Pasta")');
    await expect(mealCard).toBeVisible();
    await expect(mealCard).toHaveClass(/status-Red/);

    // 4. Stock the dish in inventory and check that calendar status becomes Green
    await page.click('li[data-view="inventory"]');
    await page.click('.inventory-accordion-item[data-recipe-id] .inventory-accordion-header:has-text("Test Complete Pasta")');
    
    const portionsInput = page.locator('.inv-recipe-portions-input[data-recipe-id]');
    await portionsInput.fill('2');
    await portionsInput.press('Enter');

    // Verify total header is updated
    await expect(dishHeader).toContainText('Total: 2 portion(s)');

    // Go back to calendar and verify status is now Green
    await page.click('li[data-view="calendar"]');
    await expect(mealCard).toHaveClass(/status-Green/);

    // 5. Test Midnight Cleanup: simulate midnight consumption
    await page.evaluate(( न्यूयॉर्कDateStr) => {
      // Set the meal date to yesterday so it is in the past
      const mealNode = STATE.scheduledMeals[STATE.scheduledMeals.length - 1];
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(yesterday);
      
      mealNode.date = yesterdayStr;
      mealNode.consumed = false;
      
      // Run midnight cleanup manually
      processMidnightCleanup();
    });

    // Check inventory portions decreased from 2 to 1
    await page.click('li[data-view="inventory"]');
    await expect(dishHeader).toContainText('Total: 1 portion(s)');
  });
});
