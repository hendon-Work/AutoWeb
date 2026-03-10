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
            'Date': kstDate,
            'File': filename,
            'Test Title': title,
            'Status': status,
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
                headerValues: ['No.', 'Date', 'File', 'Test Title', 'Status', 'Duration(ms)', 'Error Message']
            });

            // 6. 열 너비(픽셀) 조정: 'No.' 열(index 0)은 30px, 'Test Title' 열(index 3)은 600px
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 30 }, { startIndex: 0, endIndex: 1 }); // 대상 컬럼 인덱스 0 (No.)
            await sheet.updateDimensionProperties('COLUMNS', { pixelSize: 600 }, { startIndex: 3, endIndex: 4 }); // 대상 컬럼 인덱스 3 (Test Title)

            // 7. 방금 만들어진 새 탭에 테스트 결과 행들을 추가
            await sheet.addRows(this.rows);
            console.log(`✅ 성공적으로 구글 스프레드시트에 실시간 리포트가 새 탭 [${sheetTitle}]에 작성되었습니다!`);

        } catch (error) {
            console.error('❌ 구글 스프레드시트 에러 발생:', error);
        }
    }
}

export default GoogleSheetsReporter;
