import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage"; // 클래스 불러오기

test.describe("로그인 페이지 유효성 검사 테스트", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

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
