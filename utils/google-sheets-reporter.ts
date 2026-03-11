import { Reporter, TestCase, TestResult, FullConfig, Suite, FullResult } from '@playwright/test/reporter';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as path from 'path';

class GoogleSheetsReporter implements Reporter {
    private rows: Record<string, string | number>[] = [];

    onBegin(config: FullConfig, suite: Suite) {
        // 테스트 시작 시 리스트 초기화
        this.rows = [];
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const filename = path.basename(test.location.file);
        const title = test.title;
        const status = result.status;
        const duration = result.duration;
        const errorMsg = result.error?.message?.replace(/\n/g, ' ') || '';

        const match = title.match(/\[?(P\d+)\]?/i);
        const priority = match ? match[1].toUpperCase() : '-';

        // 테스트 제목에서 [P0] 등의 태그 제거 및 공백 정리
        const cleanTitle = title.replace(/\[?(P\d+)\]?/i, '').trim();

        // 한국 시간(KST)으로 현재 시각 계산
        const kstDate = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date());

        // 구글 시트에 추가할 포맷으로 1건씩 맵핑 (시트의 헤더와 컬럼명이 정확히 일치해야 합니다)
        this.rows.push({
            'No.': this.rows.length + 1,
            'Priority': priority,
            'File': filename,
            'Test Title': cleanTitle,
            'Status': status,
            'Date': kstDate,
            'Duration(ms)': duration,
            'Error Message': errorMsg,
        });
    }

    async onEnd(result: FullResult) {
        console.log('\n[Google Sheets Reporter] 테스트 완료, 구글 스프레드시트 기록을 시도합니다...');

        // 1. 보안을 위한 환경 변수 가져오기
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        // 팁: 줄바꿈 문자를 이스케이프 해제해주어야 제대로 된 인증키로 읽힙니다.
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!spreadsheetId || !serviceEmail || !privateKey) {
            console.warn('⚠️ (경고) 구글 스프레드시트 전송용 인증키 정보가 없어 업로드를 건너뜁니다.');
            return;
        }

        try {
            // 2. 서비스 계정 인증 (JWT)
            const serviceAccountAuth = new JWT({
                email: serviceEmail,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            // 3. 구글 스프레드시트 문서 불러오기
            const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
            await doc.loadInfo();

            // 4. 한국 시간(KST) 기준으로 탭 이름 생성 (예: 리포트_20260310_155823)
            const kstParts = new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).formatToParts(new Date()).reduce((acc, part) => {
                acc[part.type] = part.value;
                return acc;
            }, {} as Record<string, string>);

            const sheetTitle = `리포트_${kstParts.year}${kstParts.month}${kstParts.day}_${kstParts.hour}${kstParts.minute}${kstParts.second}`;

            // 5. 안에 데이터가 담길 '새로운 시트(탭)'를 생성하며 제목(Header) 선언 
            const sheet = await doc.addSheet({
                title: sheetTitle,
                headerRowIndex: 10, // 헤더를 10번째 줄로 지정하여 상단에 통계 공간 9줄 확보
                headerValues: ['No.', 'Priority', 'File', 'Check List', 'Result', 'Date', 'Duration(ms)', 'Error Message'],
                gridProperties: { frozenRowCount: 10 } // 10번째 줄(헤더 부분) 전체까지 틀 고정
            });

            // 6. 열 너비(픽셀) 조정
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 30 }, { startIndex: 0, endIndex: 1 }); // 대상 컬럼 인덱스 0 (No.)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 60 }, { startIndex: 1, endIndex: 2 }); // 대상 컬럼 인덱스 1 (Priority)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 129 }, { startIndex: 2, endIndex: 3 }); // 대상 컬럼 인덱스 2 (File)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 600 }, { startIndex: 3, endIndex: 4 }); // 대상 컬럼 인덱스 3 (Test Title)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 164 }, { startIndex: 5, endIndex: 6 }); // 대상 컬럼 인덱스 5 (Date)

            // 7. 방금 만들어진 새 탭에 테스트 결과 행들을 추가
            await sheet.addRows(this.rows);

            // 8. 통계 집계
            let total = this.rows.length;
            let passed = 0, failed = 0, flaky = 0, skipped = 0;
            let p0Total = 0, p0Passed = 0;

            this.rows.forEach(row => {
                const isP0 = row['Priority'] === 'P0';
                if (isP0) p0Total++;

                if (row.Status === 'passed') {
                    passed++;
                    if (isP0) p0Passed++;
                } else if (row.Status === 'failed') {
                    failed++;
                } else if (row.Status === 'flaky') {
                    flaky++;
                } else if (row.Status === 'skipped') {
                    skipped++;
                }
            });
            const fullRate = total > 0 ? Math.round((passed / total) * 100) + '%' : '0%';
            const p0Rate = p0Total > 0 ? Math.round((p0Passed / p0Total) * 100) + '%' : '0%';

            // 9. 셀 서식(볼드, 통계 등) 적용을 위해 전체 셀 로드
            await sheet.loadCells(`A1:M${this.rows.length + 10}`); // 열 1개 추가로 M열까지 범위 확장

            // 사용자 요청 양식(왼쪽 블록: Row 3, 4 / Col F, G)
            const leftData = [
                ['Total', total],
                ['P0 Total', p0Total]
            ];

            // 공통 테두리 스타일
            const defaultBorders: any = {
                top: { style: 'SOLID' as const },
                bottom: { style: 'SOLID' as const },
                left: { style: 'SOLID' as const },
                right: { style: 'SOLID' as const }
            };
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 2; c++) {
                    const cell = sheet.getCell(r + 2, c + 5); // 3행(2), 4행(3) / Col F(5), Col G(6)
                    cell.value = leftData[r][c];
                    cell.textFormat = { bold: true };
                    cell.horizontalAlignment = 'CENTER';
                    cell.borders = defaultBorders;
                    // 테이블 헤더 느낌으로 첫 열(Col F) 음영
                    if (c === 0) cell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                }
            }

            // 사용자 요청 양식(오른쪽 블록: Row 1~7 / Col H~L)
            const rightLabels = ['P', 'F', 'N/I', 'N/A', 'B', 'Full 진행률', 'P0 진행률'];
            const rightValues = [passed, failed, flaky, skipped, 0, fullRate, p0Rate];

            for (let r = 0; r < 7; r++) {
                // 라벨 열 (Col H = index 7)
                const labelCell = sheet.getCell(r, 7);
                labelCell.value = rightLabels[r];
                labelCell.textFormat = { bold: true };
                labelCell.horizontalAlignment = 'CENTER';
                labelCell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                labelCell.borders = defaultBorders;

                // 데이터 열 (Col I = index 8 ~ L = 11) - 요청 이미지와 동일하게 4칸 구성
                for (let c = 8; c <= 11; c++) {
                    const valCell = sheet.getCell(r, c);
                    if (c === 8) {
                        valCell.value = rightValues[r]; // 첫 번째 열에만 실제 수치 기입
                    } else {
                        valCell.value = '-'; // 나머지 3개 열 빈칸 처리
                    }
                    valCell.horizontalAlignment = 'CENTER';
                    valCell.borders = defaultBorders;
                    if (r >= 5) valCell.textFormat = { bold: true }; // 진행률 볼드 처리
                }
            }

            // 헤더 영역(10행, 인덱스 9) 스타일 지정: 볼드 처리, 옅은 회색 배경, 가운데 정렬
            for (let i = 0; i < 8; i++) {
                const headerCell = sheet.getCell(9, i);
                headerCell.textFormat = { bold: true };
                headerCell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                headerCell.horizontalAlignment = 'CENTER';
            }

            // 본문 영역 스타일 지정 (File 정렬, Status 컬러 및 정렬)
            for (let i = 0; i < this.rows.length; i++) {
                const rowIndex = i + 10; // 실제 데이터는 11행(인덱스 10)부터 시작

                // Priority 열(인덱스 1) 가운데 정렬
                const priorityCell = sheet.getCell(rowIndex, 1);
                priorityCell.horizontalAlignment = 'CENTER';

                // File 열(인덱스 2) 가운데 정렬
                const fileCell = sheet.getCell(rowIndex, 2);
                fileCell.horizontalAlignment = 'CENTER';

                // Status 열(인덱스 4) 배경 컬러 및 가운데 정렬 부여
                const statusCell = sheet.getCell(rowIndex, 4);
                statusCell.horizontalAlignment = 'CENTER';

                if (statusCell.value === 'passed') {
                    // 녹색 바탕, 굵은 글씨
                    statusCell.backgroundColor = { red: 0.6, green: 0.9, blue: 0.6 };
                    statusCell.textFormat = { bold: true };
                } else if (statusCell.value === 'failed') {
                    // 빨간색 바탕, 굵은 글씨
                    statusCell.backgroundColor = { red: 0.9, green: 0.6, blue: 0.6 };
                    statusCell.textFormat = { bold: true };
                }
            }

            // 변경된 서식 원격 저장 반영
            await sheet.saveUpdatedCells();

            console.log(`✅ 성공적으로 구글 스프레드시트에 실시간 리포트가 새 탭 [${sheetTitle}]에 작성되었습니다!`);

        } catch (error) {
            console.error('❌ 구글 스프레드시트 에러 발생:', error);
        }
    }
}

export default GoogleSheetsReporter;
