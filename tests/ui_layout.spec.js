import { test, expect } from '@playwright/test';

test.describe('Modal UI Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-03-23T08:00:00Z'));
        await page.goto('http://localhost:8080');
        await page.waitForSelector('body[data-app-ready="true"]');
    });

    const checkNoHorizontalScroll = async (page, selector) => {
        const isOverflowing = await page.$eval(selector, el => {
            const style = window.getComputedStyle(el);
            // Check if scrollWidth is greater than clientWidth which indicates horizontal overflow
            // We ignore a small 1px margin for potential subpixel rendering issues
            return el.scrollWidth > el.clientWidth + 1;
        });
        expect(isOverflowing, `Element ${selector} should not have horizontal overflow`).toBe(false);
    };

    test('Add Recipe modal should not have horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 600, height: 800 });
        await page.click('[data-view="recipes"]');
        await page.click('#btn-add-recipe');
        const modal = page.locator('#recipe-modal .modal');
        await expect(modal).toBeVisible();
        await checkNoHorizontalScroll(page, '#recipe-modal .modal-body');
    });

    test('Add Food modal should not have horizontal scroll even with many stages', async ({ page }) => {
        await page.setViewportSize({ width: 600, height: 800 });
        await page.click('[data-view="foods"]');
        await page.click('#btn-add-food');
        
        const modal = page.locator('#food-modal .modal');
        await expect(modal).toBeVisible();

        // Add several stages to test wrapping
        for(let i=0; i<3; i++) {
            await page.click('#btn-add-stage');
        }

        await checkNoHorizontalScroll(page, '#food-modal .modal-body');
        
        // Also check individual stage items
        const stageItems = modal.locator('.stage-builder-item');
        const count = await stageItems.count();
        for(let i=0; i<count; i++) {
            await checkNoHorizontalScroll(page, `.stage-builder-item:nth-child(${i+1})`);
        }
    });

    test('Meal Details panel should not have horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 600, height: 800 });
        await page.click('[data-view="calendar"]');
        
        // Wait for at least one meal to be present from seed data
        const mealCard = page.locator('.meal-card').first();
        await expect(mealCard).toBeVisible();
        await mealCard.click();

        await expect(page.locator('#debug-panel')).toHaveClass(/open/);
        await checkNoHorizontalScroll(page, '#debug-content');
    });
});
