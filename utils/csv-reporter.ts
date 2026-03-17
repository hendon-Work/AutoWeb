import {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

class CSVReporter implements Reporter {
  private rows: string[] = [];

  onBegin(config: FullConfig, suite: Suite) {
    // CSV 헤더 작성
    this.rows.push("File,Test Title,Status,Duration(ms),Error Message");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // CSV 포맷에 맞게 특수문자 및 줄바꿈 처리
    const filename = path.basename(test.location.file);
    const title = test.title.replace(/"/g, '""');
    const status = result.status;
    const duration = result.duration;
    const errorMsg =
      result.error?.message?.replace(/\n/g, " ").replace(/"/g, '""') || "";

    // 행 데이터 추가
    this.rows.push(
      `"${filename}","${title}","${status}","${duration}","${errorMsg}"`,
    );
  }

  onEnd(result: FullResult) {
    // CSV 파일로 저장
    fs.writeFileSync("test-report.csv", "\uFEFF" + this.rows.join("\n")); // \uFEFF for Excel/Sheets UTF-8 BOM
    console.log("\n✅ CSV test report generated at test-report.csv");
    console.log(
      "이 파일을 Google 스프레드시트에서 [파일] -> [가져오기]를 통해 열 수 있습니다.",
    );
  }
}

export default CSVReporter;
