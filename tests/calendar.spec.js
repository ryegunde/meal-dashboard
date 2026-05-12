const { test, expect } = require('@playwright/test');

test.describe('Calendar & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-11T08:00:00Z'));
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('body[data-app-ready="true"]');
  });

  test('should display current week by default', async ({ page }) => {
    const headerDate = await page.textContent('#header-date');
    // The browser is mocked to May 11, 2026
    expect(headerDate).toContain('May');
  });

  test('should highlight today', async ({ page }) => {
    const todayColumn = page.locator('.day-column.is-today');
    await expect(todayColumn).toBeVisible();
    // Use the fixed date we set in beforeEach (May 11)
    await expect(todayColumn.locator('.day-date')).toHaveText('11');
  });

  test('should provide 3 meal slots per day', async ({ page }) => {
    const dayColumn = page.locator('.day-column').first();
    const slots = dayColumn.locator('.add-meal-slot');
    await expect(slots).toHaveCount(3);
    
    await expect(slots.nth(0)).toContainText('breakfast');
    await expect(slots.nth(1)).toContainText('lunch');
    await expect(slots.nth(2)).toContainText('dinner');
  });

  test('should navigate between weeks', async ({ page }) => {
    const initialRange = await page.textContent('#header-date');
    
    await page.click('#next-week');
    const nextRange = await page.textContent('#header-date');
    expect(nextRange).not.toBe(initialRange);
    
    await page.click('#prev-week');
    const backRange = await page.textContent('#header-date');
    expect(backRange).toBe(initialRange);
  });
});
