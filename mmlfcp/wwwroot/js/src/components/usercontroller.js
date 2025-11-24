// /js/components/mmcp/userController.js

import { mmlfcp_state, _state } from '../core/state.js';
import { Controller } from './controller.js';
import { app } from '../utils/app.js';

export const userController = {
    /**
     * 사용자 플랜 갱신
     * - 기존 user_coverages 배열에서 동일한 ID 제거 후, 새 항목을 맨 앞에 추가
     */
    setUserCoverageData(userCoverage) {
        // 기존 리스트 가져오기
        const user_coverages = mmlfcp_state.get('user_coverages') || [];

        // 1️⃣ 동일한 user_plan_id가 있으면 삭제
        const updatedList = user_coverages.filter((item) => item.user_plan_id != userCoverage.user_plan_id);

        // 2️⃣ 새로 추가한 항목을 배열 맨 앞에 삽입
        updatedList.unshift(userCoverage);

        // 3️⃣ 상태 갱신
        mmlfcp_state.set('user_coverage', updatedList[0]);
        mmlfcp_state.set('user_coverages', updatedList);

        console.log('✅ 사용자 플랜 갱신 완료!');
        console.log('🧩 기존 → 갱신 후 리스트:', updatedList);

        //페이지 초기화
        _state.current_page = 1;

        //옵션값 갱신
        this.renderUserCoverageList();

        // DOM 반영 대기 후 getUserCoverage 실행
        setTimeout(() => {
            this.getUserCoverage();
        }, 150); // 혹은 100~200ms 정도 딜레이

    },

    /**
     * 
     * @returns 
     * 사용자 플랜 삭제 
     * 
     */
    setDeleteUserCoverage(user_plan_id) {
        // 현재 user_coverages 상태 가져오기
        const user_coverages = mmlfcp_state.get('user_coverages') || [];

        // 삭제할 인덱스 찾기
        const idx = user_coverages.findIndex(plan => plan.user_plan_id == user_plan_id);

        // 삭제 및 순서 갱신
        if (idx > -1) {
            user_coverages.splice(idx, 1);

            // 최신 상태 반영
            mmlfcp_state.set('user_coverages', user_coverages);

            // 🔄 삭제 후 첫 번째 플랜으로 선택 변경
            const newCurrent = user_coverages[0] || {};
            mmlfcp_state.set('user_coverage', newCurrent);

            //console.log(`🗑️ 플랜 삭제 완료: ${user_plan_id}`);
        }

        //옵션값 갱신
        this.renderUserCoverageList();

        //페이지 초기화
        _state.current_page = 1;

        // ✅ 플랜 상태 갱신 (삭제 후 첫 번째 or 기본플랜으로 복원)
        this.getUserCoverage();

    },


    renderUserCoverageList() {
        const selectEl = document.getElementById('user_coverages');
        if (!selectEl) return;

        // 1️⃣ 기존 option 전부 제거
        selectEl.innerHTML = '';

        // 2️⃣ "기본플랜" 기본 옵션 추가
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '기본플랜';
        selectEl.appendChild(defaultOption);

        // 3️⃣ 사용자 플랜 목록이 있는 경우 옵션 추가
        const user_coverage = mmlfcp_state.get('user_coverage') || {};
        const user_coverages = mmlfcp_state.get('user_coverages') || [];

        if (user_coverages.length > 0) {
            user_coverages.forEach(coverage => {
                const option = document.createElement('option');
                option.value = coverage.user_plan_id;
                option.textContent = coverage.user_plan_name;

                // 선택 상태 설정
                if (coverage.user_plan_id == user_coverage.user_plan_id) {
                    option.selected = true;
                }
                selectEl.appendChild(option);
            });
        }

    },

    restoreDefaultPlanState() {
        // 원본 데이터 가져오기
        const originalPlanCoverages = mmlfcp_state.get('original_plan_coverages') || [];
        const originalProducts = mmlfcp_state.get('original_coverage_product_lists') || [];
        const originalRequired = mmlfcp_state.get('original_required_premiums') || [];
        const originalDetailProducts = mmlfcp_state.get('original_product_insur_premiums_lists') || [];

        // ✅ 복원 적용
        mmlfcp_state.set('plan_coverages', JSON.parse(JSON.stringify(originalPlanCoverages)));
        mmlfcp_state.set('required_premiums', JSON.parse(JSON.stringify(originalRequired)));
        mmlfcp_state.set('coverage_product_lists', JSON.parse(JSON.stringify(originalProducts)));
        mmlfcp_state.set('product_insur_premiums_lists', JSON.parse(JSON.stringify(originalDetailProducts)));

        // ✅ 복원 후 필터 및 렌더링 재설정
        Controller.setDefaultAssginFilter();                 // 전체/가입/미가입 필터 초기화
        Controller.setPlanCoverage_Display("assign");        // 기본 '가입' 기준으로 표시
        Controller.setCoverageSortPremium();                 // 보험료 정렬
        Controller.bindSharedPager(Math.ceil((mmlfcp_state.get('coverage_product_lists').length || 0) / 10) || 1, 1);

        // ✅ 렌더링 시작
        Controller.renderPlanCoverages();                    // 보장정보
        Controller.renderRequiredPremiums(1);                // 회사정보
        Controller.renderCoveragePremiums(1);                // 보장별 보험료 정보

    },



    updateStateFromSelectedUserCoverage() {
        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const selected_user_plan_id = document.getElementById('user_coverages')?.value || '';

        // ✅ 기본플랜 복원
        if (!selected_user_plan_id || selected_user_plan_id == '') {
            this.restoreDefaultPlanState();
            console.log('🔁 기본플랜으로 복원되었습니다.');
            return;
        }

        //console.log('selected_user_plan_id', selected_user_plan_id);

        // ✅ 사용자 플랜 적용
        const selectedPlan = user_coverages.find(p => p.user_plan_id == selected_user_plan_id);
        if (!selectedPlan) return;

        const userDetailMap = new Map(selectedPlan.details.map(d => [d.coverage_cd, d.coverage_amount]));
        //console.log('userDetailMap', userDetailMap);

        // ✅ plan_coverages 업데이트
        const plan_coverages = mmlfcp_state.get('plan_coverages') || [];
        const updatedPlanCoverages = plan_coverages.map(cov => {
            if (userDetailMap.has(cov.coverage_cd)) {
                return {
                    ...cov,
                    guide_coverage_amount: userDetailMap.get(cov.coverage_cd) == "-" ? 0 : userDetailMap.get(cov.coverage_cd),
                    plan_coverage_selected: 'checked'
                };
            }
            return { ...cov, plan_coverage_selected: '' };
        });
        mmlfcp_state.set('plan_coverages', updatedPlanCoverages);
        //console.log('updatedPlanCoverages', updatedPlanCoverages);

        // ✅ ratioMap 저장용 객체 생성
        const ratioMap = {}; // { company_code: { coverage_cd: ratio } }


        // ✅ coverage_product_lists 업데이트
        const coverage_product_lists = mmlfcp_state.get('coverage_product_lists') || [];
        const updatedCoverageProductLists = coverage_product_lists.map(prod => {
            const updatedDetailList = prod.DetailList.map(detail => {
                if (userDetailMap.has(detail.coverage_cd)) {
                    const newAmount = userDetailMap.get(detail.coverage_cd);
                    const ratio = newAmount / (detail.guide_coverage_amount || 1);

                    const updatePremium = Math.round(detail.guide_coverage_premium * ratio);
                    const requiredPremium = detail.premium; //필수보험료
                    const newPremium = isNaN(updatePremium) ? requiredPremium : updatePremium;

                    // ratioMap 저장
                    if (!ratioMap[prod.company_code]) ratioMap[prod.company_code] = {};
                    ratioMap[prod.company_code][detail.coverage_cd] = ratio;

                    return {
                        ...detail,
                        premium: newPremium,
                        coverage_amount_ratio: ratio,
                        cover_selected: 'checked'
                    };
                }
                return {
                    ...detail,
                    cover_selected: ''
                };
            });

            //회사별 합계 보험료 계산
            const totalPremium = updatedDetailList.filter(d => d.cover_selected == 'checked').reduce((sum, d) => sum + (d.premium || 0), 0);
            return {
                ...prod,
                DetailList: updatedDetailList,
                total_premium: totalPremium,
                DispValue: true // ✅ 기존 표시 상태 유지
            };
        });
        mmlfcp_state.set('coverage_product_lists', updatedCoverageProductLists);
        //console.log('updatedCoverageProductLists', updatedCoverageProductLists);


        // ✅ product_insur_premiums_lists 업데이트 (coverage_product_lists와 동일 ratio 사용)
        const product_insur_premiums_lists = mmlfcp_state.get('product_insur_premiums_lists') || [];
        const updatedProductInsurPremiums = product_insur_premiums_lists.map(prod => {
            const updatedDetails = prod.DetailList.map(detail => {
                const companyRatios = ratioMap[prod.company_code];
                const ratio = companyRatios?.[detail.coverage_cd];

                if (ratio) {
                    const newPremium = Math.round(detail.guide_premium * ratio);
                    const newContractAmount = Math.round((detail.guide_contract_amount || 0) * ratio);
                    return {
                        ...detail,
                        premium: newPremium,
                        contract_amount: newContractAmount,
                    };
                }

                return {
                    ...detail,
                    cover_selected: ''
                };
            });
            return {
                ...prod,
                DetailList: updatedDetails
            };
        });
        mmlfcp_state.set('product_insur_premiums_lists', updatedProductInsurPremiums);

    },

    renderuserCoverageSetting() {
        const container = document.getElementById('coverage_plans_list');
        if (!container) return;

        // 기존 내용 초기화
        container.innerHTML = '';

        // 헤더 생성
        const headerDiv = document.createElement('div');
        headerDiv.style.padding = '15px 5px';
        headerDiv.style.border = 'solid 2px #ffffff';
        headerDiv.style.borderBottomColor = '#aaaaaa';
        headerDiv.style.fontWeight = '600';
        headerDiv.style.position = 'sticky';
        headerDiv.style.top = '0px';
        headerDiv.style.zIndex = '10';
        headerDiv.style.backgroundColor = '#ffffff';
        headerDiv.innerHTML = `플랜명<span style="margin-left: 426px;">생성일시</span>`;
        container.appendChild(headerDiv);

        // ✅ user_coverages 배열이 있는지 확인
        const user_coverages = mmlfcp_state.get('user_coverages') || [];

        if (user_coverages.length > 0) {
            user_coverages.forEach((plan) => {
                const date = app.convertDateFormat(new Date(plan.up_date));

                // 바깥 div
                const planDiv = document.createElement('div');
                planDiv.style.padding = '30px 5px';
                planDiv.style.border = 'solid 1px #ffffff';
                planDiv.style.borderBottomColor = '#eeeeee';

                // 플랜명
                const nameDiv = document.createElement('div');
                nameDiv.style.float = 'left';
                nameDiv.style.width = '300px';
                nameDiv.style.paddingBottom = '5px';
                nameDiv.textContent = plan.user_plan_name;

                // 날짜
                const dateDiv = document.createElement('div');
                dateDiv.style.float = 'left';
                dateDiv.style.marginLeft = '170px';
                dateDiv.textContent = date;

                // 삭제 버튼
                const btnDiv = document.createElement('div');
                btnDiv.style.float = 'right';
                btnDiv.style.marginLeft = '20px';
                btnDiv.style.marginRight = '20px';

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.id = 'coverage_del';
                delBtn.setAttribute('user_plan_id', plan.user_plan_id);
                delBtn.setAttribute('user_plan_name', plan.user_plan_name);
                delBtn.textContent = '삭제';

                btnDiv.appendChild(delBtn);

                // 조립
                planDiv.appendChild(nameDiv);
                planDiv.appendChild(dateDiv);
                planDiv.appendChild(btnDiv);

                container.appendChild(planDiv);
            });
        }
    },


    getUserCoverage() {

        // 1) 선택된 플랜 기준으로 갱신
        this.updateStateFromSelectedUserCoverage();

        // ✅ 기본플랜일 경우, 전체 렌더링 로직 실행 (Controller.render_coverage_bojang())
        const selected_user_plan_id = document.getElementById('user_coverages')?.value || '';
        if (!selected_user_plan_id || selected_user_plan_id == '') {
            Controller.render_coverage_bojang();
            return;
        }

        // 이하 기존 동일 ↓↓↓
        Controller.setDefaultAssginFilter();
        Controller.setPlanCoverage_Display("assign");
        Controller.setCoverageSortPremium();
        Controller.bindSharedPager(Math.ceil((mmlfcp_state.get('coverage_product_lists').length || 0) / 10) || 1, 1);
        Controller.renderPlanCoverages();
        Controller.renderRequiredPremiums(1);
        Controller.renderCoveragePremiums(1);
    }
};