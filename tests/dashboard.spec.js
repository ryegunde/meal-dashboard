import { test, expect } from '@playwright/test';

// Helper: boot the app cleanly with a fixed time
async function bootApp(page, isoDate = '2026-04-10T08:00:00Z') {
    await page.clock.setFixedTime(new Date(isoDate));
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 10000 });
}

// Helper: navigate to Dashboard tab
async function gotoDashboard(page) {
    await page.click('li[data-view="dashboard"]');
    await page.waitForSelector('.dashboard-view', { timeout: 5000 });
}

// Helper: inject a fully custom STATE into the app and re-run simulation
async function injectState(page, { foods, inventory, recipes, scheduledMeals }) {
    await page.evaluate(({ foods, inventory, recipes, scheduledMeals }) => {
        STATE.foods          = foods;
        STATE.inventory      = inventory;
        STATE.recipes        = recipes;
        STATE.scheduledMeals = scheduledMeals;
        window.runSimulation();
    }, { foods, inventory, recipes, scheduledMeals });
}

// ─── Shared minimal data ────────────────────────────────────────────────────

// A two-stage food: Fridge (2 days out) → Ready (0 days out)
const STAGED_FOOD = {
    id: 'f_test_chicken',
    name: 'Test Chicken',
    category: 'Proteins',
    portionSize: 150,
    stages: [
        { id: 's_tc_fridge', name: 'Fridge', daysBefore: 2, activeTimeMin: 0, passiveTimeMin: 0 },
        { id: 's_tc_ready', name: 'Ready',  daysBefore: 0, activeTimeMin: 15, passiveTimeMin: 0 }
    ]
};

const SIMPLE_RECIPE = {
    id: 'r_test_meal',
    name: 'Test Meal',
    portions: 1,
    dishType: 'Bowl',
    ingredients: [{ foodId: 'f_test_chicken', quantityPerPortion: 300 }]
};

// Scheduled for 2 days from the pinned "today" (2026-04-10)
const FUTURE_MEAL = {
    id: 'm_test_1',
    date: '2026-04-12',
    type: 'dinner',
    recipeId: 'r_test_meal'
};

test.describe('Dashboard Alerts View', () => {
    test.beforeEach(async ({ page }) => {
        await bootApp(page, '2026-04-10T08:00:00Z');
    });

    // ── Test 1: Empty state ──────────────────────────────────────────────────
    test('shows empty state when no meals are scheduled', async ({ page }) => {
        await injectState(page, {
            foods:          [STAGED_FOOD],
            inventory:      [{ foodId: 'f_test_chicken', stageQuantities: { s_tc_fridge: 0, s_tc_ready: 0 } }],
            recipes:        [SIMPLE_RECIPE],
            scheduledMeals: []  // no meals
        });

        await gotoDashboard(page);

        const emptyState = page.locator('#alert-empty-state');
        await expect(emptyState).toBeVisible();
        await expect(emptyState).toContainText("You're all set");
    });

    // ── Test 2: Red alert for completely missing ingredient ──────────────────
    test('shows red alert card when ingredient is entirely missing', async ({ page }) => {
        await injectState(page, {
            foods:     [STAGED_FOOD],
            inventory: [{ foodId: 'f_test_chicken', stageQuantities: { s_tc_fridge: 0, s_tc_ready: 0 } }],
            recipes:   [SIMPLE_RECIPE],
            scheduledMeals: [FUTURE_MEAL]
        });

        await gotoDashboard(page);

        // Red card must exist
        const redCard = page.locator('.alert-card.alert-red').first();
        await expect(redCard).toBeVisible();

        // Must mention the food name
        await expect(redCard).toContainText('Test Chicken');

        // Badge text
        await expect(redCard.locator('.alert-badge-red')).toContainText('Missing');

        // Must show how much is needed (deficit)
        await expect(redCard.locator('.alert-action-text')).toContainText('Acquire');
        await expect(redCard.locator('.alert-action-text')).toContainText('300');

        // Summary strip should show red count
        await expect(page.locator('.summary-pill-red')).toContainText('1 missing');
    });

    // ── Test 3: Blue alert for ingredient needing prep (early stage only) ────
    test('shows blue alert with next stage name when food needs prep', async ({ page }) => {
        await injectState(page, {
            foods:     [STAGED_FOOD],
            // Only fridge stock — needs to be moved to Ready
            inventory: [{ foodId: 'f_test_chicken', stageQuantities: { s_tc_fridge: 500, s_tc_ready: 0 } }],
            recipes:   [SIMPLE_RECIPE],
            scheduledMeals: [FUTURE_MEAL]
        });

        await gotoDashboard(page);

        // Blue card must exist
        const blueCard = page.locator('.alert-card.alert-blue').first();
        await expect(blueCard).toBeVisible();

        // Must mention the food name
        await expect(blueCard).toContainText('Test Chicken');

        // Badge text
        await expect(blueCard.locator('.alert-badge-blue')).toContainText('Prep Needed');

        // Must show which stage to act on
        await expect(blueCard.locator('.alert-action-text')).toContainText('Ready');

        // Summary strip should show blue count
        await expect(page.locator('.summary-pill-blue')).toContainText('1 need prep');
    });

    // ── Test 4: Urgency ordering — sooner meal's alert appears first ──────────
    test('sorts alerts so sooner-action-date cards appear first', async ({ page }) => {
        const SECOND_FOOD = {
            id: 'f_test_rice',
            name: 'Test Rice',
            category: 'Grains',
            stages: [
                { id: 's_tr_dry',    name: 'Dry',    daysBefore: 0, activeTimeMin: 0, passiveTimeMin: 0 },
                { id: 's_tr_cooked', name: 'Cooked', daysBefore: 0, activeTimeMin: 5, passiveTimeMin: 15 }
            ]
        };

        const NEAR_RECIPE = {
            id: 'r_near',
            name: 'Near Meal',
            portions: 1,
            dishType: 'Bowl',
            ingredients: [{ foodId: 'f_test_chicken', quantityPerPortion: 300 }]
        };
        const FAR_RECIPE = {
            id: 'r_far',
            name: 'Far Meal',
            portions: 1,
            dishType: 'Bowl',
            ingredients: [{ foodId: 'f_test_rice', quantityPerPortion: 200 }]
        };

        // Chicken meal is Apr 11 (tomorrow), Rice meal is Apr 20 (much later)
        await injectState(page, {
            foods:     [STAGED_FOOD, SECOND_FOOD],
            inventory: [
                { foodId: 'f_test_chicken', stageQuantities: { s_tc_fridge: 0, s_tc_ready: 0 } },
                { foodId: 'f_test_rice',    stageQuantities: { s_tr_dry: 0, s_tr_cooked: 0 } }
            ],
            recipes:   [NEAR_RECIPE, FAR_RECIPE],
            scheduledMeals: [
                { id: 'm_near', date: '2026-04-11', type: 'lunch',  recipeId: 'r_near' },
                { id: 'm_far',  date: '2026-04-20', type: 'dinner', recipeId: 'r_far' }
            ]
        });

        await gotoDashboard(page);

        const cards = page.locator('.alert-card');
        await expect(cards).toHaveCount(2);

        // First card should be Test Chicken (sooner action date)
        await expect(cards.nth(0)).toContainText('Test Chicken');
        // Second card should be Test Rice (later action date)
        await expect(cards.nth(1)).toContainText('Test Rice');
    });

    // ── Test 5: "Inventory" jump button navigates and opens accordion ────────
    test('clicking Inventory button on an alert navigates to inventory and opens accordion', async ({ page }) => {
        await injectState(page, {
            foods:     [STAGED_FOOD],
            inventory: [{ foodId: 'f_test_chicken', stageQuantities: { s_tc_fridge: 0, s_tc_ready: 0 } }],
            recipes:   [SIMPLE_RECIPE],
            scheduledMeals: [FUTURE_MEAL]
        });

        await gotoDashboard(page);

        // Click the Inventory jump button on the alert card
        await page.locator('.alert-jump-btn').first().click();

        // Should now be on Inventory tab
        await expect(page.locator('li[data-view="inventory"]')).toHaveClass(/active/);

        // The food's accordion item should be open
        const accordion = page.locator(`.inventory-accordion-item[data-food-id="f_test_chicken"]`);
        await expect(accordion).toHaveClass(/open/);
    });
});
