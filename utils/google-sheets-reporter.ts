import { Reporter, TestCase, TestResult, FullConfig, Suite, FullResult } from '@playwright/test/reporter';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as path from 'path';

class GoogleSheetsReporter implements Reporter {
    // 테스트 이름을 키(key)로 하여, 그 테스트의 파일명, 우선순위, 테스트명, 시간, 그리고 각 브라우저별 결과를 저장합니다.
    private rows: Record<string, any> = {};

    onBegin(config: FullConfig, suite: Suite) {
        // 테스트 시작 시 맵 초기화
        this.rows = {};
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const filename = path.basename(test.location.file);
        const title = test.title;
        const status = result.status;
        const duration = result.duration;
        const errorMsg = result.error?.message?.replace(/\n/g, ' ') || '';

        let priority = '-';

        // 1. Playwright annotation 객체에서 우선순위 추출 (예: test('...', { annotation: { type: 'priority', description: 'P0' } }))
        const priorityAnnotation = test.annotations.find(a => a.type.toLowerCase() === 'priority');
        if (priorityAnnotation?.description) {
            priority = priorityAnnotation.description.toUpperCase();
        }

        // 2. Playwright Test 태그에서 우선순위 추출 (예: test('...', { tag: '@P0' }))
        if (priority === '-' && test.tags) {
            const pTag = test.tags.find(tag => /@p\d+/i.test(tag));
            if (pTag) {
                priority = pTag.replace('@', '').toUpperCase();
            }
        }

        // 3. 기존 제목 파싱 호환성 유지 ([P0] 형태)
        if (priority === '-') {
            const match = title.match(/\[?(P\d+)\]?/i);
            if (match) {
                priority = match[1].toUpperCase();
            }
        }

        // 기능 테스트 제목(Check List)에서 [P0]이나 @P0 같은 우선순위 문자열 완전 제거
        const cleanTitle = title.replace(/\[?(P\d+)\]?/i, '').replace(/@p\d+/i, '').trim();

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

        // 테스트를 식별할 고유 키 (파일명 + 태그를 제외한 제목)
        const rowKey = `${filename}_${cleanTitle}`;

        // 해당 테스트가 아직 맵에 없으면 초기 구조를 만들어 줍니다.
        if (!this.rows[rowKey]) {
            this.rows[rowKey] = {
                'No.': Object.keys(this.rows).length + 1,
                'Priority': priority,
                'File': filename,
                'Check List': cleanTitle,
                'Chrome': '-',
                'Firefox': '-',
                'Safari': '-',
                'Date': kstDate,
                'Duration(ms)': 0, // 전체 소요시간 합산을 위해 0으로 시작
                'Error Message': ''
            };
        }

        // 현재 보고된 브라우저(프로젝트명)를 확인합니다.
        const projectName = test.parent.project()?.name || '';
        if (projectName === 'chromium') {
            this.rows[rowKey]['Chrome'] = status;
        } else if (projectName === 'firefox') {
            this.rows[rowKey]['Firefox'] = status;
        } else if (projectName === 'webkit') {
            this.rows[rowKey]['Safari'] = status;
        }

        // 전체 실행 시간 누적 및 오류 메시지 병합 로직
        this.rows[rowKey]['Duration(ms)'] += duration;
        if (errorMsg) {
            this.rows[rowKey]['Error Message'] += (this.rows[rowKey]['Error Message'] ? ' | ' : '') + `[${projectName}] ` + errorMsg;
        }
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
                headerValues: ['No.', 'Priority', 'File', 'Check List', 'Chrome', 'Firefox', 'Safari', 'Date', 'Duration(ms)', 'Error Message'],
                gridProperties: { frozenRowCount: 10 } // 10번째 줄(헤더 부분) 전체까지 틀 고정
            });

            // 6. 열 너비(픽셀) 조정
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 30 }, { startIndex: 0, endIndex: 1 }); // 대상 컬럼 인덱스 0 (No.)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 60 }, { startIndex: 1, endIndex: 2 }); // 대상 컬럼 인덱스 1 (Priority)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 129 }, { startIndex: 2, endIndex: 3 }); // 대상 컬럼 인덱스 2 (File)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 600 }, { startIndex: 3, endIndex: 4 }); // 대상 컬럼 인덱스 3 (Check List)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 75 }, { startIndex: 4, endIndex: 7 }); // 인덱스 4~6 (Chrome, Firefox, Safari) 너비 75px
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 164 }, { startIndex: 7, endIndex: 8 }); // 인덱스 7 (Date)

            // 맵에 저장된 row들을 배열로 변환
            const rowsArray = Object.values(this.rows);

            // 7. 방금 만들어진 새 탭에 변환된 행 배열들을 추가
            await sheet.addRows(rowsArray);

            // 8. 통계 집계
            let total = 0; // 이제 전체 수는 브라우저별 실행 수의 총합으로 계산할 수 있습니다 (여기선 편의상 고유 테스트 수로 유지하거나 변경 가능. 요청 맥락상 rowsArray 길이를 유지합니다)
            let passed = 0, failed = 0, flaky = 0, skipped = 0;
            let p0Total = 0, p0Passed = 0;

            rowsArray.forEach(row => {
                total++;
                const isP0 = row['Priority'] === 'P0';
                if (isP0) p0Total++;

                // 브라우저 3종류(Chrome, Firefox, Safari) 결과를 순회하며 통계 수집
                ['Chrome', 'Firefox', 'Safari'].forEach(browser => {
                   if (row[browser] === 'passed') {
                       passed++;
                       if (isP0) p0Passed++;
                   } else if (row[browser] === 'failed') {
                       failed++;
                   } else if (row[browser] === 'flaky') {
                       flaky++;
                   } else if (row[browser] === 'skipped') {
                       skipped++;
                   }
                });
            });
            // Total = 모든 브라우저별 수행된 총 테스트(케이스당 3개)로 변경
            total = passed + failed + flaky + skipped;
            // P0Total 역시 브라우저 실행 기준 총합 (P0인 케이스당 브라우저 개수만큼 누적 필요)
            p0Total = rowsArray.filter(r => r['Priority'] === 'P0').length * Object.keys(rowsArray.length ? rowsArray[0] : {}).filter(k => ['Chrome','Firefox','Safari'].includes(k) && rowsArray[0][k] !== '-').length;
             // 실행하지 않은 브라우저('-')는 통계에서 제외

            const fullRate = total > 0 ? Math.round((passed / total) * 100) + '%' : '0%';
            const p0Rate = p0Total > 0 ? Math.round((p0Passed / p0Total) * 100) + '%' : '0%';

            // 9. 셀 서식(볼드, 통계 등) 적용을 위해 전체 셀 로드
            // 열 구조가 확장되어 O열(Chrome, Firefox Safari Date Duratin Error) 반영을 위해 P열까지 확장
            await sheet.loadCells(`A1:P${rowsArray.length + 10}`);

            // 사용자 요청 양식(왼쪽 블록: Row 3, 4 / Col H, I)
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
                    const cell = sheet.getCell(r + 2, c + 7); // 3행(2), 4행(3) / Col H(7), Col I(8)
                    cell.value = leftData[r][c];
                    cell.textFormat = { bold: true };
                    cell.horizontalAlignment = 'CENTER';
                    cell.borders = defaultBorders;
                    // 테이블 헤더 느낌으로 첫 열(Col H) 음영
                    if (c === 0) cell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                }
            }

            // 사용자 요청 양식(오른쪽 블록: Row 1~7 / Col J~N)
            const rightLabels = ['P', 'F', 'N/I', 'N/A', 'B', 'Full 진행률', 'P0 진행률'];
            const rightValues = [passed, failed, flaky, skipped, 0, fullRate, p0Rate];

            for (let r = 0; r < 7; r++) {
                // 라벨 열 (Col J = index 9)
                const labelCell = sheet.getCell(r, 9);
                labelCell.value = rightLabels[r];
                labelCell.textFormat = { bold: true };
                labelCell.horizontalAlignment = 'CENTER';
                labelCell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                labelCell.borders = defaultBorders;

                // 데이터 열 (Col K = index 10 ~ N = 13) - 4칸 구성
                for (let c = 10; c <= 13; c++) {
                    const valCell = sheet.getCell(r, c);
                    if (c === 10) {
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
            for (let i = 0; i < 10; i++) { // 헤더 필드 개수가 10개(No~Error message)로 늘어남에 따라 범위 확장
                const headerCell = sheet.getCell(9, i);
                headerCell.textFormat = { bold: true };
                headerCell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
                headerCell.horizontalAlignment = 'CENTER';
            }

            // 본문 영역 스타일 지정 (Priority, File 정렬, Chrome/Firefox/Safari 컬러 및 정렬)
            for (let i = 0; i < rowsArray.length; i++) {
                const rowIndex = i + 10; // 실제 데이터는 11행(인덱스 10)부터 시작

                // Priority 열(인덱스 1) 가운데 정렬
                const priorityCell = sheet.getCell(rowIndex, 1);
                priorityCell.horizontalAlignment = 'CENTER';

                // File 열(인덱스 2) 가운데 정렬
                const fileCell = sheet.getCell(rowIndex, 2);
                fileCell.horizontalAlignment = 'CENTER';

                // 브라우저 3종 열(인덱스 4=Chrome, 5=Firefox, 6=Safari) 배경 컬러 및 가운데 정렬 부여
                for (let j = 4; j <= 6; j++) {
                    const statusCell = sheet.getCell(rowIndex, j);
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
