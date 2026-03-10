import { test, expect } from '@playwright/test';

test('check selector', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();
  
  const itemName = await page.locator('.inventory_item_name').nth(0).textContent();
  await page.locator('.inventory_item_name').nth(0).click();
  
  const detailName = await page.locator('.inventory_details_name').textContent();
  console.log('Item Name: ', itemName);
  console.log('Detail Name: ', detailName);
  console.log('URL: ', page.url());
  const backBtn = await page.locator('[data-test="back-to-products"]').count();
  console.log('Back Btn Count:', backBtn);
});
