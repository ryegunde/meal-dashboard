import { test, expect } from '@playwright/test';

test.describe('Inventory Portioning', () => {
    const testData = {
        foods: [
            { 
                id: 'f_tilapia', 
                name: 'Tilapia', 
                category: 'Proteins', 
                portionSize: 150, 
                stages: [{ id: 's_ready', name: 'Ready', daysBefore: 0 }] 
            }
        ],
        inventory: [
            { foodId: 'f_tilapia', stageQuantities: { 's_ready': 0 } }
        ],
        recipes: [],
        scheduledMeals: []
    };

    test.beforeEach(async ({ page }) => {
        await page.addInitScript((data) => {
            localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(data));
        }, testData);
        await page.goto('http://localhost:8080');
        await page.waitForSelector('body[data-app-ready="true"]');
        
        // Navigate to Inventory
        await page.click('[data-view="inventory"]');
    });

    test('should convert portions to grams correctly', async ({ page }) => {
        // Open Tilapia accordion
        await page.click('.inventory-accordion-header:has-text("Tilapia")');

        const portionsInput = page.locator('.inv-portion-input');
        const gramsInput = page.locator('.inv-qty-input');

        // Enter 3 portions
        await portionsInput.fill('3');
        await portionsInput.dispatchEvent('change');

        // Verify grams
        await expect(gramsInput).toHaveValue('450');
        
        // Verify total in header
        const totalSum = page.locator('.inventory-accordion-item[data-food-id="f_tilapia"] .inv-total-sum');
        await expect(totalSum).toHaveText('450');

        // Check STATE in browser
        const stateGrams = await page.evaluate(() => {
            return STATE.inventory.find(i => i.foodId === 'f_tilapia').stageQuantities['s_ready'];
        });
        expect(stateGrams).toBe(450);
    });

    test('should convert grams to portions correctly', async ({ page }) => {
        await page.click('.inventory-accordion-header:has-text("Tilapia")');

        const portionsInput = page.locator('.inv-portion-input');
        const gramsInput = page.locator('.inv-qty-input');

        // Enter 75 grams
        await gramsInput.fill('75');
        await gramsInput.dispatchEvent('change');

        // Verify portions (75 / 150 = 0.5)
        await expect(portionsInput).toHaveValue('0.5');
        
        const totalSum = page.locator('.inventory-accordion-item[data-food-id="f_tilapia"] .inv-total-sum');
        await expect(totalSum).toHaveText('75');
    });
});
