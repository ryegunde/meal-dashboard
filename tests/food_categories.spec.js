import { test, expect } from '@playwright/test';

test.describe('Food Builder Categories', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForSelector('body[data-app-ready="true"]');
        await page.click('[data-view="foods"]');
    });

    test('should group foods by category and show accordions', async ({ page }) => {
        // Based on seedData.json, we expect Categories like "Proteins", "Veggies", "Grains", "Pantry"
        const accordions = page.locator('.food-category-accordion');
        await expect(accordions).toHaveCount(4); 
        
        await expect(accordions.filter({ hasText: 'Proteins' })).toBeVisible();
        await expect(accordions.filter({ hasText: 'Veggies' })).toBeVisible();
        await expect(accordions.filter({ hasText: 'Grains' })).toBeVisible();
        await expect(accordions.filter({ hasText: 'Pantry' })).toBeVisible();
    });

    test('accordions should be closed by default and toggle on click', async ({ page }) => {
        const proteinAccordion = page.locator('.food-category-accordion', { hasText: 'Proteins' });
        const content = proteinAccordion.locator('.inventory-accordion-content');
        
        // Initial state: closed
        await expect(proteinAccordion).not.toHaveClass(/open/);
        await expect(content).not.toBeVisible();
        
        // Click to open
        await proteinAccordion.locator('.inventory-accordion-header').click();
        await expect(proteinAccordion).toHaveClass(/open/);
        await expect(content).toBeVisible();
        
        // Should contain Chicken Breast (from seed data)
        await expect(content).toContainText('Chicken Breast');
        
        // Click to close
        await proteinAccordion.locator('.inventory-accordion-header').click();
        await expect(proteinAccordion).not.toHaveClass(/open/);
        await expect(content).not.toBeVisible();
    });

    test('should correctly categorize a new food', async ({ page }) => {
        // Add a new food in a new category
        await page.click('#btn-add-food');
        await page.waitForSelector('#food-modal:not(.hidden)');
        
        await page.fill('#food-name', 'Apple');
        await page.fill('#food-category', 'Fruit');
        await page.fill('#food-portion-size', '150');
        
        await page.click('#btn-add-stage');
        await page.fill('.stage-name', 'Wash');
        
        const saveBtn = page.locator('#save-food');
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();
        
        // Verify new category accordion exists
        const fruitAccordion = page.locator('.food-category-accordion', { hasText: 'Fruit' });
        await expect(fruitAccordion).toBeVisible();
        
        // Open and check content
        await fruitAccordion.locator('.inventory-accordion-header').click();
        await expect(fruitAccordion.locator('.inventory-accordion-content')).toContainText('Apple');
    });
});
