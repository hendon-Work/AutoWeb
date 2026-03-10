import { Page, Locator } from '@playwright/test';

export class InventoryPage {
    readonly page: Page;
    readonly inventoryList: Locator;
    readonly cartIcon: Locator;
    readonly cartBadge: Locator;

    constructor(page: Page) {
        this.page = page;
        this.inventoryList = page.locator('.inventory_list');
        this.cartIcon = page.locator('.shopping_cart_link');
        this.cartBadge = page.locator('.shopping_cart_badge');
    }

    // 상품 목록의 개수 가져오기
    async getInventoryItemsCount() {
        return await this.page.locator('.inventory_item').count();
    }

    // 특정 인덱스의 상품명 가져오기
    async getItemNameByIndex(index: number) {
        return await this.page.locator('.inventory_item_name').nth(index).textContent();
    }

    // 특정 인덱스의 상품 클릭하여 상세 페이지로 이동하기
    async goToItemDetailByIndex(index: number) {
        await this.page.locator('.inventory_item_name').nth(index).click();
    }

    // 특정 인덱스의 상품을 장바구니에 추가하기
    async addItemToCartByIndex(index: number) {
        const item = this.page.locator('.inventory_item').nth(index);
        // Saucedemo의 Add to cart 버튼 접근
        await item.locator('button:has-text("Add to cart")').click();
    }

    // 특정 인덱스의 상품을 장바구니에서 제거하기
    async removeItemFromCartByIndex(index: number) {
        const item = this.page.locator('.inventory_item').nth(index);
        // Saucedemo의 Remove 버튼 접근
        await item.locator('button:has-text("Remove")').click();
    }

    // 장바구니 페이지로 이동하기
    async goToCart() {
        await this.cartIcon.click();
    }
}
