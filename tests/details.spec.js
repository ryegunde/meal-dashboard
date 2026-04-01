import { test, expect } from '@playwright/test';

test.describe('Meal Details and Navigation', () => {
    const testData = {
        foods: [
            { id: 'f_success', name: 'Ready Food', stages: [{ id: 's_r', name: 'Ready', daysBefore: 0 }] },
            { id: 'f_warning', name: 'Prep Food', stages: [{ id: 's_p', name: 'Prep', daysBefore: 1 }, { id: 's_r', name: 'Ready', daysBefore: 0 }] },
            { id: 'f_error', name: 'Missing Food', stages: [{ id: 's_r', name: 'Ready', daysBefore: 0 }] }
        ],
        inventory: [
            { foodId: 'f_success', stageQuantities: { 's_r': 100 } },
            { foodId: 'f_warning', stageQuantities: { 's_p': 100, 's_r': 0 } },
            { foodId: 'f_error', stageQuantities: { 's_r': 0 } }
        ],
        recipes: [
            { 
                id: 'r_test', 
                name: 'Test Recipe', 
                portions: 1, 
                ingredients: [
                    { foodId: 'f_success', quantityPerPortion: 10 },
                    { foodId: 'f_warning', quantityPerPortion: 10 },
                    { foodId: 'f_error', quantityPerPortion: 10 }
                ] 
            }
        ],
        scheduledMeals: [
            { id: 'm1', date: '2026-04-01', type: 'lunch', recipeId: 'r_test' }
        ]
    };

    test.beforeEach(async ({ page }) => {
        await page.addInitScript((data) => {
            localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(data));
        }, testData);
        await page.clock.setFixedTime(new Date('2026-04-01T08:00:00Z'));
        await page.goto('http://localhost:8080');
        await page.waitForSelector('body[data-app-ready="true"]');
    });

    test('should list all ingredients with correct statuses in the detail panel', async ({ page }) => {
        // Click on the meal card
        await page.click('.meal-card');
        
        const panel = page.locator('#debug-panel');
        await expect(panel).toHaveClass(/open/);

        // Check if all 3 ingredients are listed
        const ingredients = panel.locator('.ingredient-req');
        await expect(ingredients).toHaveCount(3);

        // Verify individual ingredient statuses
        await expect(ingredients.nth(0).locator('h4')).toHaveText('Ready Food');
        await expect(ingredients.nth(0).locator('.status-badge')).toHaveText('Ready');
        
        await expect(ingredients.nth(1).locator('h4')).toHaveText('Prep Food');
        await expect(ingredients.nth(1).locator('.status-badge')).toHaveText('Prep Needed');
        
        await expect(ingredients.nth(2).locator('h4')).toHaveText('Missing Food');
        await expect(ingredients.nth(2).locator('.status-badge')).toHaveText('Deficit');
    });

    test('should navigate to the correct inventory item when "Have: X" is clicked', async ({ page }) => {
        // Open details panel
        await page.click('.meal-card');
        
        // Find "Prep Food" ingredient and click its "Have" value
        const prepFoodReq = page.locator('.ingredient-req', { hasText: 'Prep Food' });
        await prepFoodReq.locator('.req-stat', { hasText: 'Have:' }).click();

        // Should switch to Inventory view
        await expect(page.locator('#view-title')).toHaveText('Inventory Plan');

        // Target inventory item should be open
        const inventoryItem = page.locator('.inventory-accordion-item[data-food-id="f_warning"]');
        await expect(inventoryItem).toHaveClass(/open/);
        
        // Final check: the detail panel should be closed
        await expect(page.locator('#debug-panel')).not.toHaveClass(/open/);
    });
});
