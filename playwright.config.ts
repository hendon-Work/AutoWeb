import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // 1. 테스트 폴더 경로를 'pcweb'으로 변경 (기존 './e2e'에서 수정)
  testDir: "./e2e",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["./utils/csv-reporter.ts"],
    ["./utils/google-sheets-reporter.ts"], // 구글 스프레드시트 직결 리포터 추가
  ],

  /* 공유 설정 (모든 브라우저 프로젝트에 적용됨) */
  use: {
    /* 2. 실패 시 스크린샷 자동 저장 설정 추가 */
    screenshot: "only-on-failure",

    /* 3. 실패 시 비디오 녹화 설정 추가 (선택사항이지만 QA에 강력 추천) */
    video: "retain-on-failure",

    /* 기존 Trace 설정 (실패 시 상세 로그 저장) */
    trace: "on-first-retry",
  },

  /* 브라우저별 프로젝트 설정 */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
