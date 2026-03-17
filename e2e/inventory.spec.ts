import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { InventoryPage } from "../pages/InventoryPage";

test.describe("Inventory Page 테스트", () => {
  let inventoryPage: InventoryPage;

  // 각 테스트를 수행하기 전에 항상 로그인을 진행하여 Inventory 페이지로 이동
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    inventoryPage = new InventoryPage(page);

    await loginPage.goto();
    // 로그인 성공 시 Inventory로 리다이렉트됨
    await loginPage.login("standard_user", "secret_sauce");
    // 로그인 및 페이지 이동 성공 여부 검증
    await expect(page).toHaveURL(/.*inventory/);
  });

  test(
    "상품 목록이 화면에 정상적으로 로드되는지 확인",
    {
      tag: "@P0",
      annotation: [
        { type: "2depth", description: "상품 목록" },
        { type: "3depth", description: "조회" },
        {
          type: "precondition",
          description: "로그인 완료 후 메인 페이지 진입",
        },
        { type: "teststep", description: "화면 내 상품 카드 존재 여부 확인" },
        {
          type: "expectedresult",
          description: "최소 1개 이상의 상품이 화면에 노출됨",
        },
      ],
    },
    async () => {
      const itemsCount = await inventoryPage.getInventoryItemsCount();
      expect(itemsCount).toBeGreaterThan(0);
    },
  );

  test(
    "장바구니에 상품을 추가하고 배지 숫자가 오르는지 확인",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "장바구니" },
        { type: "3depth", description: "상품 추가" },
        { type: "precondition", description: "상품 목록 페이지" },
        {
          type: "teststep",
          description: "첫 번째 상품의 [Add to cart] 버튼 클릭",
        },
        {
          type: "expectedresult",
          description: "우측 상단 장바구니 아이콘에 숫자 1이 표시됨",
        },
      ],
    },
    async () => {
      // 첫 번째 상품(인덱스 0) 장바구니에 추가
      await inventoryPage.addItemToCartByIndex(0);

      // 장바구니 아이콘에 '1' 이라는 배지가 생겼는지 확인
      await expect(inventoryPage.cartBadge).toHaveText("1");
    },
  );

  test(
    "장바구니에 담긴 상품을 제거하고 배지가 사라지는지 확인",
    { tag: "@P1" },
    async () => {
      // 첫 번째 상품 담기
      await inventoryPage.addItemToCartByIndex(0);
      await expect(inventoryPage.cartBadge).toHaveText("1");

      // 첫 번째 상품 제거하기 (Saucedemo에서는 버튼이 Remove로 바뀜)
      await inventoryPage.removeItemFromCartByIndex(0);

      // 장바구니 배지가 숨겨지는지(삭제되는지) 확인
      await expect(inventoryPage.cartBadge).not.toBeVisible();
    },
  );

  test(
    "6개 상품 각각 선택 후 상세 페이지 진입 시 해당 상품 상세 페이지가 맞는지 확인",
    { tag: "@P2" },
    async ({ page }) => {
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
        await expect(page.locator(".inventory_details_name")).toHaveText(
          expectedItemName!,
        );

        // 다시 상품 목록 페이지로 돌아오기
        await page.locator('[data-test="back-to-products"]').click();
      }
    },
  );

  test(
    "6개의 상품을 각 1개씩 담은 후 장바구니 페이지 진입 시 모든 상품이 노출되는지 확인",
    { tag: "@P2" },
    async ({ page }) => {
      const itemsCount = await inventoryPage.getInventoryItemsCount();
      expect(itemsCount).toBe(6);

      const addedItemNames: string[] = [];

      // 6개 상품 모두 한 번씩 클릭하여 장바구니에 담기
      for (let i = 0; i < itemsCount; i++) {
        const expectedItemName = await inventoryPage.getItemNameByIndex(i);
        if (expectedItemName) {
          addedItemNames.push(expectedItemName);
        }
        await inventoryPage.addItemToCartByIndex(i);
      }

      // 담은 후 숫자 배지가 6으로 업데이트 되는지 확인
      await expect(inventoryPage.cartBadge).toHaveText("6");

      // 장바구니 아이콘 클릭하여 장바구니 페이지 진입
      await inventoryPage.goToCart();

      // 장바구니 URL로 변경되었는지 확인
      await expect(page).toHaveURL(/.*cart\.html.*/);

      // 장바구니 내 상품 요소 개수 확인
      const cartItemsCount = await page.locator(".cart_item").count();
      expect(cartItemsCount).toBe(6);

      // 노출된 상품 이름이 담았던 상품 이름들과 일치하는지 검증
      for (let i = 0; i < cartItemsCount; i++) {
        const cartItemName = await page
          .locator(".cart_item .inventory_item_name")
          .nth(i)
          .textContent();
        expect(addedItemNames).toContain(cartItemName);
      }
    },
  );

  test(
    "장바구니 페이지에서 Remove 버튼 클릭 시 해당 상품이 각각 삭제되는지 확인",
    { tag: "@P0" },
    async ({ page }) => {
      // 테스트를 위해 임의로 3개의 상품을 장바구니에 담기
      const itemsToAdd = 3;
      for (let i = 0; i < itemsToAdd; i++) {
        await inventoryPage.addItemToCartByIndex(i);
      }

      // 장바구니 페이지로 이동
      await inventoryPage.goToCart();
      await expect(page).toHaveURL(/.*cart\.html.*/);

      // 담은 개수만큼 Cart에 아이템이 있는지 먼저 확인
      let currentCartItemsCount = await page.locator(".cart_item").count();
      expect(currentCartItemsCount).toBe(itemsToAdd);

      // 담긴 상품들을 차례대로(여기서는 항상 남아있는 항목 중 첫 번째 항목) 삭제하며 검증
      for (let i = 0; i < itemsToAdd; i++) {
        // 첫 번째 cart_item 내부의 'Remove' 버튼 클릭
        await page
          .locator(".cart_item")
          .nth(0)
          .locator('button:has-text("Remove")')
          .click();

        // 삭제 후 아이템 개수가 올바르게 1개 줄어들었는지 검증
        currentCartItemsCount--;
        const newCount = await page.locator(".cart_item").count();
        expect(newCount).toBe(currentCartItemsCount);
      }

      // 모든 상품을 삭제한 후 장바구니가 완전히 비어있는지 0개로 검증
      await expect(page.locator(".cart_item")).toHaveCount(0);

      // 장바구니 아이콘의 배지가 숨겨지는지 추가 검증
      await expect(inventoryPage.cartBadge).not.toBeVisible();
    },
  );
});
