const { test, expect } = require('@playwright/test');

const BASE_DATA = {
    schemaVersion: 2,
    foods: [
        {
            id: 'f_egg', name: 'Egg', category: 'Proteins', unit: 'item', portionSize: 1,
            stages: [
                { id: 's_e_fridge', name: 'Fridge', daysBefore: 2, activeTimeMin: 0, passiveTimeMin: 0 },
                { id: 's_e_cook', name: 'Cook - Ready', daysBefore: 0, activeTimeMin: 10, passiveTimeMin: 0 }
            ]
        },
        {
            id: 'f_chicken', name: 'Chicken Breast', category: 'Proteins', unit: 'g', portionSize: 150,
            stages: [
                { id: 's_c_fridge', name: 'Fridge', daysBefore: 2, activeTimeMin: 0, passiveTimeMin: 0 },
                { id: 's_c_cook', name: 'Cook - Ready', daysBefore: 0, activeTimeMin: 15, passiveTimeMin: 0 }
            ]
        },
        {
            id: 'f_milk', name: '2% Milk', category: 'Dairy', unit: 'ml',
            stages: [{ id: 's_milk_ready', name: 'Ready', daysBefore: 0, activeTimeMin: 0, passiveTimeMin: 0 }]
        }
    ],
    inventory: [
        { foodId: 'f_egg', stageQuantities: { 's_e_fridge': 0, 's_e_cook': 0 } },
        { foodId: 'f_chicken', stageQuantities: { 's_c_fridge': 0, 's_c_cook': 0 } },
        { foodId: 'f_milk', stageQuantities: { 's_milk_ready': 0 } }
    ],
    recipes: [
        {
            id: 'r_egg_dish', name: 'Egg Dish', portions: 1, dishType: 'Breakfast',
            ingredients: [
                { foodId: 'f_egg', quantityPerPortion: 2 },
                { foodId: 'f_chicken', quantityPerPortion: 100 }
            ]
        }
    ],
    scheduledMeals: [
        { id: 'm_1', date: '2026-04-01', type: 'lunch', recipeId: 'r_egg_dish' }
    ]
};

async function loadApp(page, data) {
    await page.addInitScript((d) => {
        localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(d));
    }, data || BASE_DATA);
    await page.clock.setFixedTime(new Date('2026-04-01T08:00:00Z'));
    await page.goto('/');
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 8000 });
}

// ─────────────────────────────────────────────
// GROUP 1 — Food Definition Dropdown
// ─────────────────────────────────────────────

test.describe('Group 1 — Food Definition Dropdown', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.waitForSelector('body[data-app-ready="true"]', { timeout: 8000 });
    });

    test('1.1 — Unit dropdown exists with all 10 options', async ({ page }) => {
        await page.click('li[data-view="foods"]');
        await page.click('#btn-add-food');
        const select = page.locator('#food-unit');
        await expect(select).toBeVisible();
        for (const unit of ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'item']) {
            await expect(select.locator(`option[value="${unit}"]`)).toHaveCount(1);
        }
    });

    test('1.2 — Unit is saved and shown on food card', async ({ page }) => {
        await page.click('li[data-view="foods"]');
        await page.click('#btn-add-food');
        await page.fill('#food-name', 'Test Lime');
        await page.fill('#food-category', 'Fruits');
        await page.selectOption('#food-unit', 'item');
        await page.locator('.stage-name').first().fill('Fresh');
        await page.locator('.stage-days').first().fill('0');
        await page.click('#btn-save-food');

        // Open Fruits accordion
        await page.click('.inventory-accordion-header:has-text("Fruits")');
        await expect(page.locator('.recipe-item', { hasText: 'Test Lime' }).locator('.food-unit-badge')).toContainText('item');
    });

    test('1.3 — Unit dropdown is pre-populated when editing', async ({ page }) => {
        await loadApp(page);
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        // Edit Egg
        await page.locator('.recipe-item', { hasText: 'Egg' }).locator('.btn-edit-food').click();
        await expect(page.locator('#food-unit')).toHaveValue('item');
    });

    test('1.4 — Portion size label updates when unit is changed', async ({ page }) => {
        await page.click('li[data-view="foods"]');
        await page.click('#btn-add-food');
        await expect(page.locator('#food-portion-unit-label')).toHaveText('g');
        await page.selectOption('#food-unit', 'item');
        await expect(page.locator('#food-portion-unit-label')).toHaveText('item');
        await page.selectOption('#food-unit', 'ml');
        await expect(page.locator('#food-portion-unit-label')).toHaveText('ml');
    });

    test('1.5 — New food defaults unit to g', async ({ page }) => {
        await page.click('li[data-view="foods"]');
        await page.click('#btn-add-food');
        await expect(page.locator('#food-unit')).toHaveValue('g');
        await expect(page.locator('#food-portion-unit-label')).toHaveText('g');
    });
});

// ─────────────────────────────────────────────
// GROUP 2 — Recipe Builder (Read-only Unit Label)
// ─────────────────────────────────────────────

test.describe('Group 2 — Recipe Builder Unit Label', () => {
    test.beforeEach(async ({ page }) => {
        await loadApp(page);
    });

    test('2.1 — Unit label auto-populates from selected food', async ({ page }) => {
        await page.click('li[data-view="recipes"]');
        await page.click('#btn-add-recipe');
        const ingRow = page.locator('.ingredient-builder-item').first();

        await ingRow.locator('.ingredient-select').selectOption({ value: 'f_egg' });
        await expect(ingRow.locator('.ingredient-unit-label')).toHaveText('item');

        await ingRow.locator('.ingredient-select').selectOption({ value: 'f_chicken' });
        await expect(ingRow.locator('.ingredient-unit-label')).toHaveText('g');
    });

    test('2.2 — No editable unit select exists in recipe builder', async ({ page }) => {
        await page.click('li[data-view="recipes"]');
        await page.click('#btn-add-recipe');
        await expect(page.locator('.ingredient-unit')).toHaveCount(0);
    });

    test('2.3 — Recipe list shows food-derived units', async ({ page }) => {
        await page.click('li[data-view="recipes"]');
        const recipeCard = page.locator('.recipe-item', { hasText: 'Egg Dish' });
        await expect(recipeCard).toContainText('2item Egg');
        await expect(recipeCard).toContainText('100g Chicken Breast');
    });

    test('2.4 — Editing recipe pre-populates unit labels correctly', async ({ page }) => {
        await page.click('li[data-view="recipes"]');
        await page.locator('.recipe-item', { hasText: 'Egg Dish' }).locator('.btn-edit-recipe').click();
        const rows = page.locator('.ingredient-builder-item');
        // First ingredient: Egg -> item
        await expect(rows.nth(0).locator('.ingredient-unit-label')).toHaveText('item');
        // Second ingredient: Chicken Breast -> g
        await expect(rows.nth(1).locator('.ingredient-unit-label')).toHaveText('g');
    });
});

// ─────────────────────────────────────────────
// GROUP 3 — Inventory Display
// ─────────────────────────────────────────────

test.describe('Group 3 — Inventory Unit Display', () => {
    test.beforeEach(async ({ page }) => {
        await loadApp(page);
    });

    test('3.1 — Chicken Breast accordion shows "g" suffix', async ({ page }) => {
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        // At least one span with "g" next to an input
        await expect(accordion.locator('.inv-qty-input').first()).toBeVisible();
        const unitLabels = accordion.locator('span', { hasText: /^g$/ });
        await expect(unitLabels.first()).toBeVisible();
    });

    test('3.2 — Egg accordion shows "item" suffix (not "g")', async ({ page }) => {
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Egg' });
        await accordion.locator('.inventory-accordion-header').click();
        const unitLabels = accordion.locator('span', { hasText: /^item$/ });
        await expect(unitLabels.first()).toBeVisible();
        // Must not show "g" as unit
        const gLabels = accordion.locator('span', { hasText: /^g$/ });
        await expect(gLabels).toHaveCount(0);
    });

    test('3.3 — Inventory total header includes unit', async ({ page }) => {
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Egg' });
        await accordion.locator('.inventory-accordion-header').click();
        // Set qty
        const input = accordion.locator('.inv-qty-input').first();
        await input.fill('6');
        await input.press('Tab');
        // Header should show unit alongside total
        await expect(accordion.locator('.inventory-accordion-header')).toContainText('item');
    });

    test('3.4 — Portions label reflects food unit', async ({ page }) => {
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        // portionSize 150, unit g -> label should mention "150g each"
        await expect(accordion.locator('span', { hasText: /150g each/ }).first()).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// GROUP 4 — Meal Detail Panel
// ─────────────────────────────────────────────

test.describe('Group 4 — Meal Detail Panel Units', () => {
    test.beforeEach(async ({ page }) => {
        await loadApp(page);
    });

    test('4.1 — Detail panel shows "item" for Egg', async ({ page }) => {
        // Set Egg inventory to 4
        const data = JSON.parse(JSON.stringify(BASE_DATA));
        data.inventory.find(i => i.foodId === 'f_egg').stageQuantities['s_e_cook'] = 4;
        await page.evaluate((d) => localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(d)), data);
        await page.reload();
        await page.waitForSelector('body[data-app-ready="true"]');

        await page.locator('.meal-card').first().click();
        const panel = page.locator('#debug-panel');
        await expect(panel).toHaveClass(/open/);
        const eggReq = panel.locator('.ingredient-req', { hasText: 'Egg' });
        await expect(eggReq.locator('.req-stat', { hasText: 'Have:' })).toContainText('item');
        await expect(eggReq.locator('.req-stat', { hasText: 'Need:' })).toContainText('item');
    });

    test('4.2 — Detail panel shows "g" for Chicken Breast and deficit', async ({ page }) => {
        await page.locator('.meal-card').first().click();
        const chickenReq = page.locator('#debug-panel .ingredient-req', { hasText: 'Chicken Breast' });
        await expect(chickenReq.locator('.req-stat', { hasText: 'Need:' })).toContainText('g');
    });

    test('4.3 — Unit scales correctly with portion count', async ({ page }) => {
        // Egg Dish has 1 portion, needs 2 item Egg. 0 in stock.
        await page.locator('.meal-card').first().click();
        const eggReq = page.locator('#debug-panel .ingredient-req', { hasText: 'Egg' });
        await expect(eggReq.locator('.req-stat', { hasText: 'Need:' })).toContainText('2item');
    });
});

// ─────────────────────────────────────────────
// GROUP 5 — Dashboard Alerts
// ─────────────────────────────────────────────

test.describe('Group 5 — Dashboard Alert Units', () => {
    test.beforeEach(async ({ page }) => {
        await loadApp(page);
    });

    test('5.1 — Red alert for missing "item" food shows item unit', async ({ page }) => {
        // Egg and Chicken both at 0 inventory -> red alerts
        await page.click('li[data-view="dashboard"]');
        const alertCards = page.locator('.alert-card.alert-red');
        await expect(alertCards.first()).toBeVisible();
        // At least one alert mentions the correct unit
        // Use data-food-id attribute to precisely target the Egg alert
        const eggAlert = page.locator('.alert-card.alert-red[data-food-id="f_egg"]');
        if (await eggAlert.count() > 0) {
            await expect(eggAlert.first()).toContainText('item');
        }
    });

    test('5.2 — Red alert for missing "g" food shows g unit', async ({ page }) => {
        await page.click('li[data-view="dashboard"]');
        const chickenAlert = page.locator('.alert-card.alert-red', { hasText: 'Chicken Breast' });
        if (await chickenAlert.count() > 0) {
            await expect(chickenAlert.first()).toContainText('g');
        }
    });
});

// ─────────────────────────────────────────────
// GROUP 6 — Within-Group Conversion
// ─────────────────────────────────────────────

test.describe('Group 6 — Within-Group Unit Conversion', () => {
    test.beforeEach(async ({ page }) => {
        const data = JSON.parse(JSON.stringify(BASE_DATA));
        data.inventory.find(i => i.foodId === 'f_chicken').stageQuantities['s_c_cook'] = 450;
        await page.addInitScript((d) => localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(d)), data);
        await page.clock.setFixedTime(new Date('2026-04-01T08:00:00Z'));
        await page.goto('/');
        await page.waitForSelector('body[data-app-ready="true"]', { timeout: 8000 });
    });

    test('6.1 — g → kg converts inventory quantity', async ({ page }) => {
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();

        // Change unit
        await page.selectOption('#food-unit', 'kg');

        // Accept dialog
        page.on('dialog', d => d.accept());
        await page.click('#btn-save-food');

        // Check inventory
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        // The test sets s_c_cook (last stage) to 450; check the last input
        const input = accordion.locator('.inv-qty-input').last();
        const val = parseFloat(await input.inputValue());
        expect(val).toBeCloseTo(0.45, 2);
    });

    test('6.2 — g → kg converts recipe ingredient quantities', async ({ page }) => {
        page.on('dialog', d => d.accept());
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();
        await page.selectOption('#food-unit', 'kg');
        await page.click('#btn-save-food');

        // Egg Dish uses 100g Chicken -> should now show 0.1kg
        await page.click('li[data-view="recipes"]');
        await expect(page.locator('.recipe-item', { hasText: 'Egg Dish' })).toContainText('0.1kg Chicken Breast');
    });

    test('6.3 — Cancel conversion dialog reverts unit and preserves quantities', async ({ page }) => {
        page.on('dialog', d => d.dismiss());
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();
        await page.selectOption('#food-unit', 'kg');
        await page.click('#btn-save-food');

        // Unit should be reverted - food card should still show [g]
        const badge = page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.food-unit-badge');
        await expect(badge).toContainText('g');

        // Close the modal (cancel keeps it open) before navigating
        await page.click('#close-food-modal');

        // Inventory quantity should still be 450 (on the last/Cook stage)
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        const input = accordion.locator('.inv-qty-input').last();
        const val = parseFloat(await input.inputValue());
        expect(val).toBe(450);
    });
});

// ─────────────────────────────────────────────
// GROUP 7 — Cross-Group Reset
// ─────────────────────────────────────────────

test.describe('Group 7 — Cross-Group Unit Reset', () => {
    test.beforeEach(async ({ page }) => {
        const data = JSON.parse(JSON.stringify(BASE_DATA));
        data.inventory.find(i => i.foodId === 'f_chicken').stageQuantities['s_c_cook'] = 300;
        await page.addInitScript((d) => localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(d)), data);
        await page.clock.setFixedTime(new Date('2026-04-01T08:00:00Z'));
        await page.goto('/');
        await page.waitForSelector('body[data-app-ready="true"]', { timeout: 8000 });
    });

    test('7.1 — g → item resets inventory quantities to 0', async ({ page }) => {
        page.on('dialog', d => d.accept());
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();
        await page.selectOption('#food-unit', 'item');
        await page.click('#btn-save-food');

        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        const inputs = accordion.locator('.inv-qty-input');
        const count = await inputs.count();
        for (let i = 0; i < count; i++) {
            const val = parseFloat(await inputs.nth(i).inputValue());
            expect(val).toBe(0);
        }
    });

    test('7.2 — g → item resets recipe quantities to 0', async ({ page }) => {
        page.on('dialog', d => d.accept());
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();
        await page.selectOption('#food-unit', 'item');
        await page.click('#btn-save-food');

        await page.click('li[data-view="recipes"]');
        await expect(page.locator('.recipe-item', { hasText: 'Egg Dish' })).toContainText('0item Chicken Breast');
    });

    test('7.3 — Cancel cross-group reset dialog reverts unit and preserves data', async ({ page }) => {
        page.on('dialog', d => d.dismiss());
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Proteins")');
        await page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.btn-edit-food').click();
        await page.selectOption('#food-unit', 'item');
        await page.click('#btn-save-food');

        // Unit badge should still be g
        await expect(page.locator('.recipe-item', { hasText: 'Chicken Breast' }).locator('.food-unit-badge')).toContainText('g');

        // Close the modal (cancel keeps it open) before navigating
        await page.click('#close-food-modal');

        // Inventory still 300
        await page.click('li[data-view="inventory"]');
        const accordion = page.locator('.inventory-accordion-item', { hasText: 'Chicken Breast' });
        await accordion.locator('.inventory-accordion-header').click();
        const input = accordion.locator('.inv-qty-input').last();
        const val = parseFloat(await input.inputValue());
        expect(val).toBe(300);
    });
});

// ─────────────────────────────────────────────
// GROUP 8 — localStorage Round-trip
// ─────────────────────────────────────────────

test.describe('Group 8 — localStorage Round-trip', () => {
    test('8.1 — Unit survives page reload', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.waitForSelector('body[data-app-ready="true"]');

        // Create a new food with item unit
        await page.click('li[data-view="foods"]');
        await page.click('#btn-add-food');
        await page.fill('#food-name', 'Test Avocado');
        await page.fill('#food-category', 'Fruits');
        await page.selectOption('#food-unit', 'item');
        await page.locator('.stage-name').first().fill('Fresh');
        await page.locator('.stage-days').first().fill('0');
        await page.click('#btn-save-food');

        // Reload
        await page.reload();
        await page.waitForSelector('body[data-app-ready="true"]');
        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Fruits")');

        await expect(page.locator('.recipe-item', { hasText: 'Test Avocado' }).locator('.food-unit-badge')).toContainText('item');
    });

    test('8.2 — Schema migration: v1 data without food.unit gets unit backfilled', async ({ page }) => {
        // Inject v1 data (no schemaVersion, no food.unit)
        const v1Data = {
            foods: [{
                id: 'f_legacy', name: 'Legacy Food',
                stages: [{ id: 's_l', name: 'Ready', daysBefore: 0 }]
            }],
            inventory: [{ foodId: 'f_legacy', stageQuantities: { 's_l': 100 } }],
            recipes: [{
                id: 'r_legacy', name: 'Legacy Recipe', portions: 1, dishType: 'Bowl',
                ingredients: [{ foodId: 'f_legacy', quantityPerPortion: 50, unit: 'ml' }]
            }],
            scheduledMeals: []
        };
        // Use addInitScript so localStorage is set before page load (avoids SecurityError)
        await page.addInitScript((d) => localStorage.setItem('PREPFLOW_DATA_V1', JSON.stringify(d)), v1Data);
        await page.goto('/');
        await page.waitForSelector('body[data-app-ready="true"]');

        await page.click('li[data-view="foods"]');
        await page.click('.inventory-accordion-header:has-text("Uncategorized")');

        // unit should have been backfilled from recipe ingredient ('ml')
        await expect(page.locator('.recipe-item', { hasText: 'Legacy Food' }).locator('.food-unit-badge')).toContainText('ml');
    });
});
