import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage'; // 클래스 불러오기

test('POM을 이용한 로그인 테스트', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 페이지 이동
    await loginPage.goto();

    // 로그인 동작 수행 (내부 로직을 몰라도 메서드만 호출하면 됨)
    await loginPage.login('standard_user', 'secret_sauce');

    // 검증
    await expect(page).toHaveURL(/.*inventory/);
});