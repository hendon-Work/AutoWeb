import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage'; // 클래스 불러오기

test.describe('로그인 페이지 유효성 검사 테스트', () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        await loginPage.goto();
    });

    test('정상적인 계정으로 로그인 성공 테스트', { tag: '@P0' }, async ({ page }) => {
        await loginPage.login('standard_user', 'secret_sauce');
        await expect(page).toHaveURL(/.*inventory/);
    });

    test('아이디를 입력하지 않고 로그인 시도', { tag: '@P1' }, async () => {
        await loginPage.login('', 'secret_sauce');
        await expect(loginPage.getErrorMessage()).toHaveText('Epic sadface: Username is required');
    });

    test('비밀번호를 입력하지 않고 로그인 시도', { tag: '@P1' }, async () => {
        await loginPage.login('standard_user', '');
        await expect(loginPage.getErrorMessage()).toHaveText('Epic sadface: Password is required');
    });

    test('일치하지 않는 계정 정보로 로그인 시도', { tag: '@P1' }, async () => {
        await loginPage.login('invalid_user', 'wrong_password');
        await expect(loginPage.getErrorMessage()).toHaveText('Epic sadface: Username and password do not match any user in this service');
    });

    test('블락(잠긴) 처리된 계정으로 로그인 시도', { tag: '@P2' }, async () => {
        await loginPage.login('locked_out_user', 'secret_sauce');
        await expect(loginPage.getErrorMessage()).toHaveText('Epic sadface: Sorry, this user has been locked out.');
    });
});