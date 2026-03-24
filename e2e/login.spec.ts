import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage"; // 클래스 불러오기

test.describe("로그인 페이지 유효성 검사 테스트", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test(
    "로그인 페이지 기본 요소 UI 확인",
    {
      tag: "@P0",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "UI 확인" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "아이디, 패스워드 입력 필드와 로그인 버튼 노출 확인",
        },
        {
          type: "expectedresult",
          description: "아이디 필드, 패스워드 필드, 로그인 버튼이 정상적으로 표시됨",
        },
      ],
    },
    async () => {
      await expect(loginPage.getUsernameInput()).toBeVisible();
      await expect(loginPage.getPasswordInput()).toBeVisible();
      await expect(loginPage.getLoginButton()).toBeVisible();
    },
  );

  test(
    "아이디/패스워드 입력 필드 placeholder 확인",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "UI 확인" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "아이디 및 패스워드 입력 필드의 placeholder 텍스트 확인",
        },
        {
          type: "expectedresult",
          description: "각각 Username, Password로 표시됨",
        },
      ],
    },
    async () => {
      await expect(loginPage.getUsernameInput()).toHaveAttribute("placeholder", "Username");
      await expect(loginPage.getPasswordInput()).toHaveAttribute("placeholder", "Password");
    },
  );

  test(
    "아이디/패스워드 입력 시 placeholder가 미노출되는지 확인",
    {
      tag: "@P2",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "UI 확인" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "아이디 및 패스워드 입력 필드에 텍스트 입력",
        },
        {
          type: "expectedresult",
          description: "입력 필드에 텍스트가 채워지며 기존 placeholder가 화면에 미노출됨 (입력값으로 덮어씌워짐)",
        },
      ],
    },
    async () => {
      const usernameInput = loginPage.getUsernameInput();
      const passwordInput = loginPage.getPasswordInput();

      await usernameInput.fill("testuser");
      await passwordInput.fill("testpassword");

      // HTML의 placeholder는 value가 채워지면 브라우저 상에서 시각적으로 미노출됩니다.
      // 따라서 입력된 값이 정확하게 설정되었는지 검증합니다.
      await expect(usernameInput).toHaveValue("testuser");
      await expect(passwordInput).toHaveValue("testpassword");
    },
  );

  test(
    "패스워드 입력 시 마스킹(암호화) 처리 확인",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "UI 확인" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "패스워드 입력 필드의 type 속성 확인",
        },
        {
          type: "expectedresult",
          description: "패스워드 필드의 type 속성이 'password'로 설정되어 입력 문자가 화면에 마스킹 처리됨",
        },
      ],
    },
    async () => {
      const passwordInput = loginPage.getPasswordInput();
      // 패스워드 입력 필드가 password 타입인지 확인하여 브라우저에서 자동 마스킹 처리되는지 검증
      await expect(passwordInput).toHaveAttribute("type", "password");
    },
  );

  test(
    "정상적인 계정으로 로그인 성공 테스트",
    {
      tag: "@P0",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "로그인 성공" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "유효한 아이디/비밀번호 입력 후 로그인 클릭",
        },
        {
          type: "expectedresult",
          description: "상품 목록(inventory) 페이지로 정상 이동됨",
        },
      ],
    },
    async ({ page }) => {
      await loginPage.login("standard_user", "secret_sauce");
      await expect(page).toHaveURL(/.*inventory/);
    },
  );

  test(
    "아이디를 입력하지 않고 로그인 시도",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "입력 유효성" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "아이디 빈칸 상태에서 비밀번호 입력 후 로그인 클릭",
        },
        {
          type: "expectedresult",
          description: "Username is required 에러 메시지가 표시됨",
        },
      ],
    },
    async () => {
      await loginPage.login("", "secret_sauce");
      await expect(loginPage.getErrorMessage()).toHaveText(
        "Epic sadface: Username is required",
      );
    },
  );

  test(
    "비밀번호를 입력하지 않고 로그인 시도",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "입력 유효성" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "아이디 입력 후 비밀번호 빈칸 상태에서 로그인 클릭",
        },
        {
          type: "expectedresult",
          description: "Password is required 에러 메시지가 표시됨",
        },
      ],
    },
    async () => {
      await loginPage.login("standard_user", "");
      await expect(loginPage.getErrorMessage()).toHaveText(
        "Epic sadface: Password is required",
      );
    },
  );

  test(
    "일치하지 않는 계정 정보로 로그인 시도",
    {
      tag: "@P1",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "로그인 실패" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "등록되지 않은 계정 정보 입력 후 로그인 클릭",
        },
        {
          type: "expectedresult",
          description:
            "Username and password do not match 에러 메시지가 표시됨",
        },
      ],
    },
    async () => {
      await loginPage.login("invalid_user", "wrong_password");
      await expect(loginPage.getErrorMessage()).toHaveText(
        "Epic sadface: Username and password do not match any user in this service",
      );
    },
  );

  test(
    "블락(잠긴) 처리된 계정으로 로그인 시도",
    {
      tag: "@P2",
      annotation: [
        { type: "2depth", description: "로그인" },
        { type: "3depth", description: "계정 상태" },
        {
          type: "precondition",
          description: "로그인 페이지(https://www.saucedemo.com/) 접속 완료",
        },
        {
          type: "teststep",
          description: "잠긴 계정(locked_out_user) 정보 입력 후 로그인 클릭",
        },
        {
          type: "expectedresult",
          description: "user has been locked out 에러 메시지가 표시됨",
        },
      ],
    },
    async () => {
      await loginPage.login("locked_out_user", "secret_sauce");
      await expect(loginPage.getErrorMessage()).toHaveText(
        "Epic sadface: Sorry, this user has been locked out.",
      );
    },
  );
});
