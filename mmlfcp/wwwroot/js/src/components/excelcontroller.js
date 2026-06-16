import { appConstants } from '../constants/constants.js';
import { mmlfcp_state } from '../core/state.js';
import { apiService } from '../services/apiService.js';
import { app } from '../utils/app.js';
import { Controller } from './controller.js';

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

        // --- [도움 함수: 인덱스를 엑셀 열 문자로 변환] ---
        // index 0 -> C, 1 -> D, ... 24 -> Z, 25 -> AA
        const getColumnLetter = (index) => {
            let n = index + 3; // C열(3번째)부터 시작하도록 offset 3 부여
            let letter = '';
            while (n > 0) {
                let remainder = (n - 1) % 26;
                letter = String.fromCharCode(65 + remainder) + letter;
                n = Math.floor((n - 1) / 26);
            }
            return letter;
        };



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

        const ga_id = mmlfcp_state.get('ga_id') || '';
        const cust_name = mmlfcp_state.get('cust_name'); //홍길동님
        const gender = mmlfcp_state.get('gender') === 'M' ? "남" : "여"; //남
        const birth_date = mmlfcp_state.get('birth_date'); //19800101
        const birthStr = ga_id === 'A210' ? '' : `${birth_date},`;
        const age = "보험연령:" + mmlfcp_state.get('age') + "세"; //보험연령:46세
        const plan_type_name = mmlfcp_state.get('plan_type_name'); // 종합(무해지형)
        const plan_payment_expiration_name = mmlfcp_state.get('plan_payment_expiration_name'); //20년/100세

        const custInfo = `${cust_name}님 (${gender},${birthStr}${age}) ${plan_type_name}-${plan_payment_expiration_name}`;


        worksheet.mergeCells('A1:B1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = custInfo;
        titleCell.font = { bold: true, size: 12 };

        // --- [2. 헤더 영역 구성 (A2:B3)] ---
        worksheet.mergeCells('A2:A3');
        worksheet.getCell('A2').value = '담보명';
        worksheet.mergeCells('B2:B3');
        worksheet.getCell('B2').value = '가입금액';

        // 회사별 헤더 (C열부터 동적 생성)
        selectedCompanies.forEach((comp, index) => {
            const col = getColumnLetter(index); // 함수 호출!

            const compCell = worksheet.getCell(`${col}2`);
            compCell.value = comp.company_name;

            const fullData = mmlfcp_state.get('coverage_premiums').find(c => c.company_code === comp.company_code);
            const prodCell = worksheet.getCell(`${col}3`);
            prodCell.value = fullData?.product_name || '-';

            [compCell, prodCell].forEach(cell => {
                cell.fill = headerFill;
                cell.font = { bold: true };
            });
        });

        [worksheet.getCell('A2'), worksheet.getCell('B2')].forEach(cell => {
            cell.fill = headerFill;
            cell.font = { bold: true };
        });

        // --- [3. 본문 데이터 작성 (4행부터)] ---
        let currentRowIdx = 4;
        coverageResults.forEach(row => {
            worksheet.getCell(`A${currentRowIdx}`).value = row.coverage_name;
            worksheet.getCell(`B${currentRowIdx}`).value = row.guide_coverage_amount;
            worksheet.getCell(`B${currentRowIdx}`).numFmt = '#,##0';

            row.details.forEach((detail, colIdx) => {
                const col = getColumnLetter(colIdx); // 함수 호출!
                const cell = worksheet.getCell(`${col}${currentRowIdx}`);
                cell.value = detail.premium;
                cell.numFmt = '#,##0';
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
            coverageResults[0].details.forEach((detail, colIdx) => {
                const col = getColumnLetter(colIdx); // 함수 호출!
                const cell = worksheet.getCell(`${col}${totalRowIdx}`);
                cell.value = detail.total_premium;
                cell.numFmt = '#,##0';
                cell.font = { bold: true };
            });
        }

        // --- [5. 전체 스타일 및 너비 조정] ---
        // 데이터가 들어간 마지막 열까지 너비를 조정하기 위해 columns를 설정함
        const totalColumnCount = selectedCompanies.length + 2;
        for (let i = 1; i <= totalColumnCount; i++) {
            const column = worksheet.getColumn(i);
            if (i === 1) column.width = 45;
            else if (i === 2) column.width = 25;
            else column.width = 50;
        }

        worksheet.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = borderStyle;
                cell.alignment = centerAlign;
            });
        });

        // --- [6. 파일 다운로드] ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
        }
    },

    //6. 엑셀 로그 생성
    async exportExcelLog() {
        const device = app.getUrlParameter("device");
        let excel_checked = false;

        if (!device) {
            appConstants.device = "WEB";
        }
        try {
            const res = await apiService.ExcelLog();
            if (res.is_success === true) {
                excel_checked = true;
            }
            else {
                // 서버에서 정의한 비즈니스 에러 메시지 처리
                alert(res.error_message || "엑셀 로그 생성 중 오류가 발생하였습니다.");
            }
        }
        catch (err) {
            console.error("[엑셀 로그 생성 중 오류 발생]", err);
            alert(err.message);
            return;
        }
        finally {
            //모달창 닫기
            Controller._closeModal();
            excel_checked = false;
        }
    }
}