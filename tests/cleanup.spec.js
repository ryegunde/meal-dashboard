import { test, expect } from '@playwright/test';

test.describe('Midnight Inventory Cleanup', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    });

    test('should subtract ingredients for past meals and mark them as consumed', async ({ page }) => {
        const testData = {
            foods: [
                { id: 'f_test', name: 'Test Food', stages: [{ id: 's_ready', name: 'Ready', daysBefore: 0 }] }
            ],
            inventory: [
                { foodId: 'f_test', stageQuantities: { 's_ready': 100 } }
            ],
            recipes: [
                { 
                    id: 'r_test', 
                    name: 'Test Recipe', 
                    portions: 1, 
                    ingredients: [{ foodId: 'f_test', quantityPerPortion: 10 }] 
                }
            ],
            scheduledMeals: [
                { id: 'm_future', date: '2026-04-01', type: 'lunch', recipeId: 'r_test' },
                { id: 'm_current', date: '2026-03-31', type: 'dinner', recipeId: 'r_test' }
            ]
        };

        // Inject test data BEFORE navigation
        await page.addInitScript((data) => {
            localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(data));
        }, testData);

        // Start on a fixed date: 2026-03-31
        await page.clock.setFixedTime(new Date('2026-03-31T08:00:00Z'));
        await page.goto('http://localhost:8080');

        // Wait for app to be ready
        await page.waitForSelector('body[data-app-ready="true"]');

        // Initial check: Nothing should be consumed yet because it's still 2026-03-31
        let state = await page.evaluate(() => ({
            inventory: STATE.inventory.find(i => i.foodId === 'f_test').stageQuantities['s_ready'],
            meals: STATE.scheduledMeals.map(m => ({ id: m.id, consumed: !!m.consumed }))
        }));
        
        expect(state.inventory).toBe(100);
        expect(state.meals.every(m => !m.consumed)).toBe(true);

        // Advance time to 2026-04-01 (Next day)
        await page.clock.setFixedTime(new Date('2026-04-01T01:00:00Z'));
        
        // Either reload or wait for setInterval (setInterval is 1 min, but we can call it manually)
        await page.evaluate(() => processMidnightCleanup());

        // Check again: m_current (from 03-31) should be consumed, m_future (04-01) should NOT
        state = await page.evaluate(() => ({
            inventory: STATE.inventory.find(i => i.foodId === 'f_test').stageQuantities['s_ready'],
            meals: STATE.scheduledMeals.map(m => ({ id: m.id, consumed: !!m.consumed }))
        }));

        // 100 - 10 = 90
        expect(state.inventory).toBe(90);
        
        const currentMeal = state.meals.find(m => m.id === 'm_current');
        const futureMeal = state.meals.find(m => m.id === 'm_future');
        
        expect(currentMeal.consumed).toBe(true);
        expect(futureMeal.consumed).toBe(false);
    });

    test('should handle multiple past meals at once', async ({ page }) => {
        const testData = {
            foods: [
                { id: 'f_test', name: 'Test Food', stages: [{ id: 's_ready', name: 'Ready', daysBefore: 0 }] }
            ],
            inventory: [
                { foodId: 'f_test', stageQuantities: { 's_ready': 100 } }
            ],
            recipes: [
                { 
                    id: 'r_test', 
                    name: 'Test Recipe', 
                    portions: 1, 
                    ingredients: [{ foodId: 'f_test', quantityPerPortion: 10 }] 
                }
            ],
            scheduledMeals: [
                { id: 'm1', date: '2026-03-30', type: 'lunch', recipeId: 'r_test' },
                { id: 'm2', date: '2026-03-31', type: 'lunch', recipeId: 'r_test' }
            ]
        };

        // Inject test data BEFORE navigation
        await page.addInitScript((data) => {
            localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(data));
        }, testData);

        await page.clock.setFixedTime(new Date('2026-04-02T08:00:00Z'));
        await page.goto('http://localhost:8080');

        await page.waitForSelector('body[data-app-ready="true"]');

        // Cleanup should run on initApp automatically
        const state = await page.evaluate(() => ({
            inventory: STATE.inventory.find(i => i.foodId === 'f_test').stageQuantities['s_ready'],
            meals: STATE.scheduledMeals.map(m => ({ id: m.id, consumed: !!m.consumed }))
        }));

        // 100 - 10 - 10 = 80
        expect(state.inventory).toBe(80);
        expect(state.meals.every(m => m.consumed)).toBe(true);
    });
});
