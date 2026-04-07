import { mmlfcp_state } from '../core/state.js';
import { app } from '../utils/app.js';

export const excelController = {

    // 1. 저장될 엑셀 파일명 생성
    generateExcelFileName() {
        const cust_name = mmlfcp_state.get('cust_name');
        const today = app.getToday();
        return `${cust_name}_한장보험료비교_${today}.xlsx`;
    },

    // 2. 체크된 보험사 정보 추출
    extractSelectedCompanies() {
        // id가 "chk_"로 시작(^=)하는 체크박스 중 체크된(:checked) 요소만 선택
        const selectedCompanies = mmlfcp_state.get('coverage_premiums') || [];
        return selectedCompanies
            .filter(item => item.DispValue === true) // 1. DispValue가 true인 항목만 필터링
            .map(item => ({ // 2. 필터링된 항목에서 필요한 필드만 매핑
                company_code: item.company_code,
                company_name: item.company_name,
            }));
    },

    //3. 체크된 보장별 정보 추출
    extractSelectedPlanCoverages() {
        const selectedPlanCoverages = mmlfcp_state.get('plan_coverages') || [];
        return selectedPlanCoverages
            .filter(item => item.plan_coverage_selected === "checked") //plan_coverage_selected 가 checked 인 항목만
            .map(item => ({ // 2. 필터링된 항목에서 필요한 필드만 매핑
                coverage_cd: item.coverage_cd,
                coverage_name: item.coverage_name,
                guide_coverage_amount: item.guide_coverage_amount,
            }));
    },


    //4. 담보별 보험료 정보 추출
    extractCoverageData() {
        const selectedCompanies = this.extractSelectedCompanies(); // 체크된 회사들
        const selectedPlanCoverages = this.extractSelectedPlanCoverages(); // 체크된 담보들
        const allCompanyData = mmlfcp_state.get('coverage_premiums') || []; // 원본 회사 데이터

        //체크된 담보들을 기준으로 데이터 구성
        return selectedPlanCoverages.map(planCoverage => {
            const details = [];

            //선택된 각 회사별로 해당 담보의 보험료 찾기
            selectedCompanies.forEach(selectedComp => {
                // 1. 전체 데이터에서 해당 회사코드 찾음
                const companyTarget = allCompanyData.find(c => c.company_code === selectedComp.company_code);

                // 2. 해당 회사코드의 detailList에서 현재 담보코드와 일치하는 항목 찾기
                const coverageMatch = companyTarget?.detailList?.find(d => d.coverage_cd === planCoverage.coverage_cd);

                details.push({
                    company_code: selectedComp.company_code,
                    // 매칭되는 담보가 있으면 premium을, 없으면 0을 반환
                    premium: coverageMatch ? coverageMatch.base_premium : 0,
                    // 해당 회사의 총 보험료 (합계 영역에서 쓰일 수 있음)
                    total_premium: companyTarget ? companyTarget.total_premium : 0
                });
            });

            return {
                coverage_name: planCoverage.coverage_name,
                coverage_cd: planCoverage.coverage_cd,
                guide_coverage_amount: planCoverage.coverage_cd === 'aa00' ? "-" : planCoverage.guide_coverage_amount,
                details: details // 이 배열의 순서는 selectedCompanies의 순서와 동일하게 유지돼!
            };
        });
    },

    // 5. ExcelJS를 이용한 파일 생성 및 다운로드
    async exportToExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('한장 보험료 비교', {
            // [A1:B3] 영역까지 틀 고정 (담보명과 헤더가 항상 보이게)
            views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
        });

        const selectedCompanies = this.extractSelectedCompanies(); // 헤더용 회사 리스트
        const coverageResults = this.extractCoverageData(); // 본문용 담보 데이터
        const fileName = this.generateExcelFileName(); //파일명

        // --- [스타일 정의] ---
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE6F1' } };
        const borderStyle = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        const centerAlign = { horizontal: 'center', vertical: 'middle' };

        // --- [1. 상단 고객 정보 영역] ---
        // mmlfcp_state나 global state에서 정보를 가져온다고 가정


        const cust_name = mmlfcp_state.get('cust_name'); //홍길동님
        const gender = mmlfcp_state.get('gender') === 'M' ? "남" : "여"; //남
        const birth_date = mmlfcp_state.get('birth_date'); //19800101
        const age = "보험연령:" + mmlfcp_state.get('age') + "세"; //보험연령:46세
        const plan_type_name = mmlfcp_state.get('plan_type_name'); // 종합(무해지형)
        const plan_payment_expiration_name = mmlfcp_state.get('plan_payment_expiration_name'); //20년/100세

        // 요렇게 조립하면 주석이랑 똑같이 나와!
        const custInfo = `${cust_name}님 (${gender},${birth_date},${age}) ${plan_type_name}-${plan_payment_expiration_name}`;  //홍길동님 (남,19800101,보험연령:46세) 종합(무해지형)-20년/100세
        // console.log({ custInfo: custInfo });

        worksheet.mergeCells('A1:B1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = custInfo;
        titleCell.font = { bold: true, size: 12 };

        // --- [2. 헤더 영역 구성 (A2:B3)] ---
        worksheet.mergeCells('A2:A3');
        worksheet.getCell('A2').value = '담보명';
        worksheet.mergeCells('B2:B3');
        worksheet.getCell('B2').value = '가입금액';

        // 회사별 헤더 (C열부터 시작)
        const COL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
        selectedCompanies.forEach((comp, index) => {
            const col = COL_LETTERS[index];
            if (!col) return;

            // 2행: 회사명, 3행: 상품명(데이터가 있다면)
            const compCell = worksheet.getCell(`${col}2`);
            compCell.value = comp.company_name;

            // 해당 회사의 전체 원본 데이터를 찾아 상품명 출력 (선택 사항)
            const fullData = mmlfcp_state.get('coverage_premiums').find(c => c.company_code === comp.company_code);
            const prodCell = worksheet.getCell(`${col}3`);
            prodCell.value = fullData?.product_name || '-';

            [compCell, prodCell].forEach(cell => {
                cell.fill = headerFill;
                cell.font = { bold: true };
            });
        });

        // A2, B2 헤더 스타일 적용
        [worksheet.getCell('A2'), worksheet.getCell('B2')].forEach(cell => {
            cell.fill = headerFill;
            cell.font = { bold: true };
        });

        // --- [3. 본문 데이터 작성 (4행부터)] ---
        let currentRowIdx = 4;
        coverageResults.forEach(row => {
            worksheet.getCell(`A${currentRowIdx}`).value = row.coverage_name;
            worksheet.getCell(`B${currentRowIdx}`).value = row.guide_coverage_amount;
            worksheet.getCell(`B${currentRowIdx}`).numFmt = '#,##0'; // 숫자 포맷

            // 각 회사별 보험료 매핑
            row.details.forEach((detail, colIdx) => {
                const col = COL_LETTERS[colIdx];
                if (col) {
                    const cell = worksheet.getCell(`${col}${currentRowIdx}`);
                    cell.value = detail.premium;
                    cell.numFmt = '#,##0';
                }
            });
            currentRowIdx++;
        });

        // --- [4. 하단 합계 영역] ---
        const totalRowIdx = currentRowIdx;
        worksheet.mergeCells(`A${totalRowIdx}:B${totalRowIdx}`);
        const totalLabelCell = worksheet.getCell(`A${totalRowIdx}`);
        totalLabelCell.value = '합계 보험료';
        totalLabelCell.fill = headerFill;
        totalLabelCell.font = { bold: true };

        if (coverageResults.length > 0) {
            // 첫 번째 담보의 details 구조를 참조하여 회사별 총 합계 입력
            coverageResults[0].details.forEach((detail, colIdx) => {
                const col = COL_LETTERS[colIdx];
                if (col) {
                    const cell = worksheet.getCell(`${col}${totalRowIdx}`);
                    cell.value = detail.total_premium;
                    cell.numFmt = '#,##0';
                    cell.font = { bold: true };
                }
            });
        }

        // --- [5. 전체 스타일 및 너비 조정] ---
        worksheet.columns.forEach((column, i) => {
            // i는 0부터 시작 (0: A열, 1: B열, 2: C열...)
            if (i === 0) {
                column.width = 45; // A열 (담보명): 가장 길기 때문에 아주 넓게!
            } else if (i === 1) {
                column.width = 25; // B열 (가입금액): 숫자 위주이므로 적당히 넓게
            } else {
                column.width = 50; // C열 이후 (보험사별 보험료): 전체적으로 시원하게 넓힘
            }
        });

        worksheet.eachRow((row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = borderStyle;
                cell.alignment = centerAlign;
            });
        });

        // --- [6. 파일 다운로드] ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // FileSaver.js의 saveAs 사용 (없다면 원본 JS 방식 사용)
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
        }
    }
};