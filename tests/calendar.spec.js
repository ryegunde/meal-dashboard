const { test, expect } = require('@playwright/test');

test.describe('Calendar & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display current week by default', async ({ page }) => {
    const headerDate = await page.textContent('#header-date');
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = months[today.getMonth()];
    
    // Header should contain current month (or next if overlapping)
    expect(headerDate).toContain(currentMonth);
  });

  test('should highlight today', async ({ page }) => {
    const todayColumn = page.locator('.day-column.is-today');
    await expect(todayColumn).toBeVisible();
    await expect(todayColumn.locator('.day-date')).toHaveText(new Date().getDate().toString());
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
