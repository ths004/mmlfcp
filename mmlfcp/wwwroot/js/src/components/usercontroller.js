// /js/components/mmcp/userController.js

import { mmlfcp_state, _state, deepCopy } from '../core/state.js';
import { Controller } from './controller.js';
import { app } from '../utils/app.js';

const PREFERRED_PLANS_KEY = 'mmlfcp_default_user_plans';

export const userController = {
    /**
     * 사용자 플랜 갱신
     * - 기존 user_coverages 배열에서 동일한 ID 제거 후, 새 항목을 맨 앞에 추가
     */

    _preferredMapKey() {
        const ga = String(mmlfcp_state.get('ga_id') || '').trim();
        const cons = String(mmlfcp_state.get('consultant_id') || '').trim();
        return `${ga}|${cons}`;
    },

    _readPreferredMap() {
        try {
            const raw = localStorage.getItem(PREFERRED_PLANS_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    },

    _writePreferredMap(map) {
        try {
            localStorage.setItem(PREFERRED_PLANS_KEY, JSON.stringify(map || {}));
        } catch (_) { /* ignore */ }
    },

    /** 저장된 기본 플랜 id ('' = 시스템 기본플랜). 없으면 null */
    getPreferredDefaultPlanId() {
        const map = this._readPreferredMap();
        const key = this._preferredMapKey();
        if (!Object.prototype.hasOwnProperty.call(map, key)) return null;
        return String(map[key] ?? '');
    },

    setPreferredDefaultPlanId(userPlanId) {
        const map = this._readPreferredMap();
        map[this._preferredMapKey()] = String(userPlanId ?? '');
        this._writePreferredMap(map);
    },

    /**
     * 조회/렌더 시 적용할 기본 플랜 id
     * - 선호값 있고 목록에 있으면 그 값
     * - 선호값이 '' 이면 시스템 기본플랜
     * - 미설정이면 시스템 기본플랜('')
     */
    resolveDefaultPlanId(userCoverages = []) {
        const preferred = this.getPreferredDefaultPlanId();
        if (preferred === null || preferred === '') return '';
        const exists = (userCoverages || []).some((p) => String(p.user_plan_id) === String(preferred));
        return exists ? preferred : '';
    },

    applyResolvedDefaultPlan() {
        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const planId = this.resolveDefaultPlanId(user_coverages);
        const selected = user_coverages.find((p) => String(p.user_plan_id) === String(planId)) || {};
        mmlfcp_state.set('user_coverage', selected);

        const selectEl = document.getElementById('user_coverages');
        if (selectEl) selectEl.value = planId;

        this.renderUserCoverageList();
    },

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

            // 기본 선택 플랜이 삭제된 경우 → 시스템 기본플랜으로
            const preferred = this.getPreferredDefaultPlanId();
            if (preferred != null && String(preferred) === String(user_plan_id)) {
                this.setPreferredDefaultPlanId('');
            }

            const resolvedId = this.resolveDefaultPlanId(user_coverages);
            const newCurrent = user_coverages.find((p) => String(p.user_plan_id) === String(resolvedId)) || {};
            mmlfcp_state.set('user_coverage', newCurrent);
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
        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const selectedId = this.resolveDefaultPlanId(user_coverages)
            || String((mmlfcp_state.get('user_coverage') || {}).user_plan_id || '');

        if (user_coverages.length > 0) {
            user_coverages.forEach(coverage => {
                const option = document.createElement('option');
                option.value = coverage.user_plan_id;
                option.textContent = coverage.user_plan_name;

                // 선택 상태 설정
                if (String(coverage.user_plan_id) === String(selectedId)) {
                    option.selected = true;
                }
                selectEl.appendChild(option);
            });
        }

        selectEl.value = selectedId;
        const matched = user_coverages.find((p) => String(p.user_plan_id) === String(selectedId));
        mmlfcp_state.set('user_coverage', matched || {});
    },

    restoreDefaultPlanState() {
        const snapshot = mmlfcp_state.get('default_plan_snapshot');
        if (!snapshot) return;

        mmlfcp_state.set('plan_coverages', deepCopy(snapshot.plan_coverages));
        mmlfcp_state.set('required_premiums', deepCopy(snapshot.required_premiums));
        mmlfcp_state.set('coverage_premiums', deepCopy(snapshot.coverage_premiums));
        mmlfcp_state.set('product_insur_premiums', deepCopy(snapshot.product_insur_premiums));
        mmlfcp_state.set('coverage_ratio_map', {});

        // ✅ 복원 후 필터 및 렌더링 재설정
        Controller.setDefaultAllFilter();                 // 전체/가입/미가입 필터 초기화
        Controller.setPlanCoverage_Display("all");        // 기본 '모두보기' 기준으로 표시
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
                    detail.base_coverage_amount = detail.guide_coverage_amount;
                    detail.base_premium = detail.guide_coverage_premium;
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
                    detail.base_premium = Math.floor(ratio * basePremium) || 0;
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
                    totalPremium += (Math.floor(detail.base_premium) || 0);
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
                    premium: Math.floor((detail.guide_premium || 0) * ratio),
                    contract_amount: Math.floor((detail.guide_contract_amount || 0) * ratio)
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

        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const preferredId = this.resolveDefaultPlanId(user_coverages);

        const hint = document.createElement('p');
        hint.className = 'coverage-plans-hint';
        hint.textContent = '기본으로 사용할 플랜을 선택하면, 다음 조회부터 해당 플랜이 기본으로 표시됩니다.';
        container.appendChild(hint);

        // 헤더
        const headerDiv = document.createElement('div');
        headerDiv.className = 'coverage-plan-row coverage-plan-row--head';
        headerDiv.innerHTML = `
            <span class="coverage-plan-col coverage-plan-col--default">기본</span>
            <span class="coverage-plan-col coverage-plan-col--name">플랜명</span>
            <span class="coverage-plan-col coverage-plan-col--date">생성일시</span>
            <span class="coverage-plan-col coverage-plan-col--action"></span>
        `;
        container.appendChild(headerDiv);

        // 시스템 기본플랜 행
        const systemRow = document.createElement('div');
        systemRow.className = 'coverage-plan-row'
            + (preferredId === '' ? ' is-default' : '');
        systemRow.innerHTML = `
            <label class="coverage-plan-col coverage-plan-col--default">
                <input type="radio" name="default_user_plan" value="" ${preferredId === '' ? 'checked' : ''} aria-label="시스템 기본플랜을 기본값으로">
            </label>
            <span class="coverage-plan-col coverage-plan-col--name">시스템 기본플랜</span>
            <span class="coverage-plan-col coverage-plan-col--date">—</span>
            <span class="coverage-plan-col coverage-plan-col--action"></span>
        `;
        container.appendChild(systemRow);

        if (user_coverages.length > 0) {
            user_coverages.forEach((plan) => {
                const date = app.convertDateFormat(new Date(plan.up_date));
                const planId = String(plan.user_plan_id || '');
                const isDefault = String(preferredId) === planId;

                const planDiv = document.createElement('div');
                planDiv.className = 'coverage-plan-row' + (isDefault ? ' is-default' : '');

                const radioLabel = document.createElement('label');
                radioLabel.className = 'coverage-plan-col coverage-plan-col--default';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'default_user_plan';
                radio.value = planId;
                radio.checked = isDefault;
                radio.setAttribute('aria-label', `${plan.user_plan_name}을(를) 기본값으로`);
                radioLabel.appendChild(radio);

                const nameDiv = document.createElement('span');
                nameDiv.className = 'coverage-plan-col coverage-plan-col--name';
                nameDiv.textContent = plan.user_plan_name;

                const dateDiv = document.createElement('span');
                dateDiv.className = 'coverage-plan-col coverage-plan-col--date';
                dateDiv.textContent = date;

                const btnDiv = document.createElement('span');
                btnDiv.className = 'coverage-plan-col coverage-plan-col--action';
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.id = 'coverage_del';
                delBtn.setAttribute('user_plan_id', plan.user_plan_id);
                delBtn.setAttribute('user_plan_name', plan.user_plan_name);
                delBtn.textContent = '삭제';
                btnDiv.appendChild(delBtn);

                planDiv.appendChild(radioLabel);
                planDiv.appendChild(nameDiv);
                planDiv.appendChild(dateDiv);
                planDiv.appendChild(btnDiv);
                container.appendChild(planDiv);
            });
        }

        container.querySelectorAll('input[name="default_user_plan"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                this.onSelectDefaultUserPlan(radio.value);
            });
        });
    },

    onSelectDefaultUserPlan(userPlanId) {
        const planId = String(userPlanId ?? '');
        this.setPreferredDefaultPlanId(planId);

        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const selected = user_coverages.find((p) => String(p.user_plan_id) === planId) || {};
        mmlfcp_state.set('user_coverage', selected);

        const selectEl = document.getElementById('user_coverages');
        if (selectEl) selectEl.value = planId;

        this.renderUserCoverageList();
        this.renderuserCoverageSetting();
        this.getUserCoverage();
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
        Controller.setDefaultAllFilter();
        Controller.setPlanCoverage_Display("all");
        Controller.setCoverageSortPremium();
        Controller.bindSharedPager(Math.ceil((mmlfcp_state.get('coverage_premiums').length || 0) / 10) || 1, 1);
        Controller.renderPlanCoverages();
        Controller.renderRequiredPremiums(1);
        Controller.renderCoveragePremiums(1);
    }
};
