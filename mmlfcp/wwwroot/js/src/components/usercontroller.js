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
    updateStateFromSelectedUserCoveragePremium(userDetailMap) {
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const ratioMap = {};

        const updatedProducts = coverage_premiums.map(product => {
            const updatedDetails = product.detailList.map(detail => {
                const coverage_cd = detail.coverage_cd;

                //1. 사용자 플랜에 없는 담보 → 미선택
                if (!userDetailMap.has(coverage_cd)) {
                    return { ...detail, cover_selected: '' };
                }

                //2. aa00 (최저기본계약조건) 일 경우 계산 x
                if (coverage_cd === 'aa00') {
                    return {
                        ...detail,
                        contract_amount: detail.contract_amount,
                        premium: detail.premium,
                        cover_selected: 'checked'
                    };
                }

                // base_premium 원본 보존
                if (detail.base_premium === undefined || detail.base_premium === null) {
                    detail.base_premium = Number(detail.premium) || 0;
                }

                const newAmount = Number(userDetailMap.get(coverage_cd)) || 0;
                const baseAmount = Number(detail.guide_coverage_amount) || 0;
                const basePremium = Number(detail.base_premium) || 0;

                //3. 담보 계산
                const ratio = newAmount / baseAmount;
                const coverage_amount = Math.round(ratio * baseAmount);
                const premium = Math.round(ratio * basePremium);


                //4. ratioMap setting
                if (!ratioMap[product.company_code]) {
                    ratioMap[product.company_code] = {};
                }
                ratioMap[product.company_code][detail.coverage_cd] = ratio;

                return {
                    ...detail,
                    coverage_amount: coverage_amount,
                    premium: premium,
                    cover_selected: 'checked'
                };
            });
            // 5. 합계 계산
            const totalPremium = updatedDetails.filter(d => d.cover_selected === 'checked').reduce((sum, d) => sum + (Number(d.premium) || 0), 0);
            return {
                ...product,
                detailList: updatedDetails,
                total_premium: totalPremium,
                DispValue: true
            };
        });

        mmlfcp_state.set('coverage_premiums', updatedProducts);
        //console.log('userConotroller에서 coverage_premiums,', updatedProducts);
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

