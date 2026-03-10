import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';

test.describe('Inventory Page 테스트', () => {
    let inventoryPage: InventoryPage;

    // 각 테스트를 수행하기 전에 항상 로그인을 진행하여 Inventory 페이지로 이동
    test.beforeEach(async ({ page }) => {
        const loginPage = new LoginPage(page);
        inventoryPage = new InventoryPage(page);

        await loginPage.goto();
        // 로그인 성공 시 Inventory로 리다이렉트됨
        await loginPage.login('standard_user', 'secret_sauce');
        // 로그인 및 페이지 이동 성공 여부 검증
        await expect(page).toHaveURL(/.*inventory/);
    });

    test('상품 목록이 화면에 정상적으로 로드되는지 확인', async () => {
        const itemsCount = await inventoryPage.getInventoryItemsCount();
        expect(itemsCount).toBeGreaterThan(0);
    });

    test('장바구니에 상품을 추가하고 배지 숫자가 오르는지 확인', async () => {
        // 첫 번째 상품(인덱스 0) 장바구니에 추가
        await inventoryPage.addItemToCartByIndex(0);

        // 장바구니 아이콘에 '1' 이라는 배지가 생겼는지 확인
        await expect(inventoryPage.cartBadge).toHaveText('1');
    });

    test('장바구니에 담긴 상품을 제거하고 배지가 사라지는지 확인', async () => {
        // 첫 번째 상품 담기
        await inventoryPage.addItemToCartByIndex(0);
        await expect(inventoryPage.cartBadge).toHaveText('1');

        // 첫 번째 상품 제거하기 (Saucedemo에서는 버튼이 Remove로 바뀜)
        await inventoryPage.removeItemFromCartByIndex(0);

        // 장바구니 배지가 숨겨지는지(삭제되는지) 확인
        await expect(inventoryPage.cartBadge).not.toBeVisible();
    });

    test('6개 상품 각각 선택 후 상세 페이지 진입 시 해당 상품 상세 페이지가 맞는지 확인', async ({ page }) => {
        const itemsCount = await inventoryPage.getInventoryItemsCount();

        // 상품이 6개인지 검증 (전제조건 확인)
        expect(itemsCount).toBe(6);

        for (let i = 0; i < itemsCount; i++) {
            // 상품 목록에서 예상되는 상품명 가져오기
            const expectedItemName = await inventoryPage.getItemNameByIndex(i);

            // 상세 페이지로 이동
            await inventoryPage.goToItemDetailByIndex(i);

            // URL이 상세 페이지 형식이 맞는지 확인
            await expect(page).toHaveURL(/.*inventory-item\.html.*/);

            // 상세 페이지의 상품명이 일치하는지 검증
            await expect(page.locator('.inventory_details_name')).toHaveText(expectedItemName!);

            // 다시 상품 목록 페이지로 돌아오기
            await page.locator('[data-test="back-to-products"]').click();
        }
    });
});
