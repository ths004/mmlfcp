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
        const snapshot = mmlfcp_state.get('default_plan_snapshot');
        if (!snapshot) return;

        mmlfcp_state.set('plan_coverages', structuredClone(snapshot.plan_coverages));
        mmlfcp_state.set('required_premiums', structuredClone(snapshot.required_premiums));
        mmlfcp_state.set('coverage_premiums', structuredClone(snapshot.coverage_premiums));
        mmlfcp_state.set('product_insur_premiums', structuredClone(snapshot.product_insur_premiums));
        mmlfcp_state.set('coverage_ratio_map', {});


        // ✅ 복원 후 필터 및 렌더링 재설정
        Controller.setDefaultAssginFilter();                 // 전체/가입/미가입 필터 초기화
        Controller.setPlanCoverage_Display("assign");        // 기본 '가입' 기준으로 표시
        Controller.setCoverageSortPremium();                 // 보험료 정렬
        Controller.bindSharedPager(Math.ceil((mmlfcp_state.get('coverage_premiums').length || 0) / 10) || 1, 1);

        // ✅ 렌더링 시작
        Controller.renderPlanCoverages();                    // 보장정보
        Controller.renderRequiredPremiums(1);                // 회사정보
        Controller.renderCoveragePremiums(1);                // 보장별 보험료 정보
    },



    updateStateFromSelectedUserCoverage() {
        const selected_user_plan_id = document.getElementById('user_coverages')?.value || '';

        // ✅ 기본플랜 복원
        if (!selected_user_plan_id) {
            this.restoreDefaultPlanState();
            console.log('🔁 기본플랜으로 복원되었습니다.');
            // console.log({ default_plan_snapshot: mmlfcp_state.get('default_plan_snapshot'), coverage_ratio_map: mmlfcp_state.get('coverage_ratio_map') });
            return;
        }

        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const selectedPlan = user_coverages.find(p => p.user_plan_id == selected_user_plan_id);
        if (!selectedPlan) return;


        const userDetailMap = new Map(selectedPlan.details.map(d => [d.coverage_cd, d.coverage_amount]));

        //1. plan_coverages 업데이트
        this.updateStateFromSelectedUserCoveragePlan(userDetailMap);

        //2. coverage_premiums 업데이트 + ratioMap 생성
        const ratioMap = this.updateStateFromSelectedUserCoveragePremium(userDetailMap);

        //3. product_insur_premiums 업데이트
        this.updateStateFromSelectedUserInsurPremium(ratioMap);

    },

    //plan_coverages
    updateStateFromSelectedUserCoveragePlan(userDetailMap) {
        const plan_coverages = mmlfcp_state.get('plan_coverages') || [];

        const updated = plan_coverages.map(cov => {
            if (userDetailMap.has(cov.coverage_cd)) {
                const amount = userDetailMap.get(cov.coverage_cd);
                return {
                    ...cov,
                    guide_coverage_amount: amount == "-" ? 0 : amount,
                    plan_coverage_selected: 'checked'
                };
            }
            return {
                ...cov,
                plan_coverage_selected: ''
            };
        });

        mmlfcp_state.set('plan_coverages', updated);
    },

    //coverage_premiums
    // coverage_premiums 업데이트 및 비율 맵 생성
    updateStateFromSelectedUserCoveragePremium(userDetailMap) {
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const ratioMap = {};
        const coverage_ratio_map = {};

        if (!coverage_premiums.length) return ratioMap;

        // 1️. 제품(product) 순회
        for (const product of coverage_premiums) {
            const { company_code, detailList } = product;
            if (!Array.isArray(detailList)) continue;

            let totalPremium = 0;
            // 2️. 담보(detail) 순회
            for (const detail of detailList) {
                const coverage_cd = detail.coverage_cd;

                // [1] 사용자 플랜에 없는 담보 → 미선택 처리
                if (!userDetailMap.has(coverage_cd)) {
                    detail.cover_selected = ''; // 선택되지 않은 담보는 합산 및 계산에서 제외되도록 처리

                }

                // [2] aa00 (최저기본계약조건) 일 경우 고정값 세팅
                else if (coverage_cd === 'aa00') {
                    detail.coverage_amount = detail.contract_amount;
                    detail.premium = detail.base_premium;
                    detail.cover_selected = 'checked';
                }

                // [3] 일반 담보 계산
                else {

                    // 1. 기준 보험료 초기화 (값이 없을 경우 가이드 보험료로 세팅)
                    detail.base_premium ??= (detail.guide_coverage_premium || 0);

                    // 2. 연산에 필요한 값들을 상수로 추출 (가독성 및 Number 타입 보장)
                    const targetAmount = Number(userDetailMap.get(coverage_cd)) || 0;
                    const baseAmount = Number(detail.guide_coverage_amount) || 0;
                    const basePremium = Number(detail.guide_coverage_premium) || 0;

                    // 3. 비율 계산 (0으로 나누기 방지)
                    const ratio = baseAmount > 0 ? targetAmount / baseAmount : 0;

                    // 이전 요청에서 언급하신 'base' 관련 필드도 업데이트가 필요하다면 아래를 포함하세요.
                    detail.base_coverage_amount = ratio * baseAmount;
                    detail.base_premium = Math.round(ratio * basePremium) || 0;
                    detail.cover_selected = 'checked';


                    // ratioMap 세팅 (회사별 -> 담보별 비율 저장)
                    if (!ratioMap[company_code]) {
                        ratioMap[company_code] = {};
                    }
                    ratioMap[company_code][coverage_cd] = ratio;
                    coverage_ratio_map[coverage_cd] = ratio;

                    //coverage_ratio_map setting
                    mmlfcp_state.set('coverage_ratio_map', {});
                    mmlfcp_state.set('coverage_ratio_map', coverage_ratio_map);
                }

                // [5] 선택된 담보만 합계 보험료에 누적
                if (detail.cover_selected === 'checked') {
                    totalPremium += (Math.round(detail.base_premium) || 0);
                }
            }
            // 3️. 제품별 최종 합계 및 노출 상태 반영
            product.total_premium = totalPremium;
            product.DispValue = true;
        }

        // 4️. 최종 상태 저장 및 결과 반환
        mmlfcp_state.set('coverage_premiums', coverage_premiums);
        return ratioMap;
    },

    //product_insur_premiums
    updateStateFromSelectedUserInsurPremium(ratioMap) {
        const product_insur_premiums = mmlfcp_state.get('product_insur_premiums') || [];
        const updated = product_insur_premiums.map(prod => {

            const updatedDetails = prod.detailList.map(detail => {
                const ratio = ratioMap?.[prod.company_code]?.[detail.coverage_cd];
                if (!ratio) return detail;

                return {
                    ...detail,
                    premium: Math.round((detail.guide_premium || 0) * ratio),
                    contract_amount: Math.round((detail.guide_contract_amount || 0) * ratio)
                };
            });
            return {
                ...prod,
                detailList: updatedDetails
            };
        });
        mmlfcp_state.set('product_insur_premiums', updated);
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
        Controller.bindSharedPager(Math.ceil((mmlfcp_state.get('coverage_premiums').length || 0) / 10) || 1, 1);
        Controller.renderPlanCoverages();
        Controller.renderRequiredPremiums(1);
        Controller.renderCoveragePremiums(1);
    }
};

