import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('aias-memphis-design-studio-onboarding-v2', 'seen');
  });
  await page.goto('/designer.html');
  await expect(page.locator('#game-brief-card')).toBeVisible();
  await expect(page.locator('#challenge-heading')).not.toHaveText(/Loading/i);
});

test('core game loop is playable', async ({ page }) => {
  const parts = page.locator('#stat-shapes');
  const initial = Number(await parts.textContent());

  await expect(page.locator('link[href="assets/css/designer-fun.css"]')).toHaveCount(0);

  await page.locator('[data-add-shape="window"]').click();
  await expect(parts).toHaveText(String(initial + 1));

  await page.locator('#undo-action').click();
  await expect(parts).toHaveText(String(initial));

  await page.locator('#redo-action').click();
  await expect(parts).toHaveText(String(initial + 1));

  const dailyTitle = await page.locator('#challenge-heading').textContent();
  await page.locator('#game-practice').click();
  await expect(page.locator('#game-brief-kicker')).toHaveText('Practice brief');
  if (dailyTitle) await expect(page.locator('#challenge-heading')).not.toHaveText(dailyTitle);
  expect(await page.locator('#game-rule-list .game-rule').count()).toBeGreaterThanOrEqual(2);

  const beforeArray = Number(await parts.textContent());
  await page.locator('#game-arrays').click();
  await expect(page.locator('#game-array-dialog')).toBeVisible();
  await page.locator('#game-array-kind').selectOption('windows');
  await page.locator('#game-array-cols').fill('2');
  await page.locator('#game-array-rows').fill('1');
  await page.locator('#game-array-x').fill('100');
  await page.locator('#game-array-y').fill('100');
  await page.locator('#game-array-create').click();
  await expect(page.locator('#game-array-dialog')).not.toBeVisible();
  await expect(parts).toHaveText(String(beforeArray + 2));
  await expect(page.locator('#game-batch-undo')).toBeVisible();

  await page.locator('#game-desk-crit').click();
  await expect(page.locator('#game-crit-dialog')).toBeVisible();
  await expect(page.locator('#game-crit-positive')).not.toHaveText('');
  await expect(page.locator('#game-crit-push')).not.toHaveText('');
  await page.getByRole('button', { name: 'Back to building' }).click();
  await expect(page.locator('#game-crit-dialog')).not.toBeVisible();

  await page.locator('#create-share').click();
  await expect(page.locator('#share-panel')).toBeVisible();
  await expect(page.locator('#share-url')).toHaveValue(/#design=/);
  await expect(page.locator('#design-code')).not.toHaveValue('');

  await page.evaluate(() => {
    const meter = document.getElementById('game-brief-meter-text');
    if (meter) meter.textContent = '100%';
  });
  await expect(page.locator('#game-finish-panel')).toBeVisible();
  await expect(page.locator('[data-finish-action="crit"]')).toBeVisible();
  await expect(page.locator('[data-finish-action="save"]')).toBeVisible();
  await expect(page.locator('[data-finish-action="next"]')).toBeVisible();
  await expect(page.locator('[data-finish-action="compare"]')).toHaveCount(0);
});

test('touch-friendly controls are available', async ({ page, isMobile }) => {
  await page.locator('[data-add-shape="door"]').click();
  await expect(page.locator('#game-move-pad')).toBeVisible();
  await expect(page.locator('#game-move-pad [data-nudge="ArrowUp"]')).toBeVisible();
  await expect(page.locator('#game-move-pad [data-nudge="ArrowLeft"]')).toBeVisible();
  if (isMobile) {
    const box = await page.locator('#game-move-pad [data-nudge="ArrowUp"]').boundingBox();
    expect(box?.width || 0).toBeGreaterThanOrEqual(44);
    expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  }
});
