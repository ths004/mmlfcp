import { mmlfcp_state, _state } from '../core/state.js';
import { apiService } from '../services/apiService.js';
import { app } from '../utils/app.js';
import { appConstants } from '../constants/constants.js';
import { userController } from './userController.js';

export const Controller = {
    /**
    * 초기 실행 함수
    */
    init() {
        if (!this.ensurePlans()) return;

        // 1. 기초 데이터 동기화 (기존 데이터나 input의 생년월일로부터 나이 계산 포함)
        this.syncStateAndUI();

        // 2. 세팅된 State를 바탕으로 UI 렌더링
        this.renderPlanOptions();           // 상품유형 리스트
        this.renderPayTermBySelectedPlan(); // 납기/만기 리스트
        this.renderUploadDate(); //손보, 생보 업데이트 날짜 랜더링
        this.renderPayTermSelectedAge();    // 조회가능 나이 안내 텍스트

        // 3. 이벤트 바인딩
        this.bindEvents();
    },

    resetBeforeSearch() {
        //console.log('[🔄 resetBeforeSearch] 조회 전 상태 초기화 시작');

        // 🔹 1️⃣ state에서 제거할 key 목록
        const resetKeys = [
            'coverage_ratio_map',
            'coverage_premiums',
            'product_insur_premiums',
            'plan_coverages',
            'default_plan_snapshot',
        ];

        resetKeys.forEach(key => {
            mmlfcp_state.remove(key);
            localStorage.removeItem(key);
        });

        // 🔹 2️⃣ detail_coverage 내부도 같이 초기화 (있다면)
        if (window.detail_coverage) {
            detail_coverage.coverage_ratio_map = {};
            detail_coverage.coverage_premiums_by_ages = [];
            detail_coverage.coverage_premiums_by_ages_totals = [];
        }

        if (window.simplified_detail_coverage) {
            simplified_detail_coverage.coverage_ratio_map = {};
            simplified_detail_coverage.simplified_coverage_premiums = [];
            simplified_detail_coverage.simplified_coverage_insur_premiums = [];
            simplified_detail_coverage.simplified_required_coverage_premiums = [];
        }

        // console.log('[✅ resetBeforeSearch] 초기화 완료');
    },


    // ====== Step 1: data guard ======
    ensurePlans() {
        const plans = mmlfcp_state.getPlans();
        if (!Array.isArray(plans) || plans.length == 0) {
            alert('[Controller] 플랜 데이터가 없습니다.');
            return false;
        }
        return true;
    },

    //0) 공통 유틸 : 페이징
    paginate(arr = [], page = 1, size = 10) {
        const totalPages = Math.max(1, Math.ceil(arr.length / size));
        const current = Math.min(Math.max(1, page), totalPages);
        const start = (current - 1) * size;
        return { current, totalPages, slice: arr.slice(start, start + size) };
    },

    //회사 "상품정보" 버튼 토글
    ensureCompanyInfoTogglesBound() {
        if (mmlfcp_state.get('companyInfoEventsBound')) return;
        const area = document.getElementById('companyInfo');
        if (!area) return;

        area.addEventListener("click", (e) => {
            const openBtn = e.target.closest('.btn__product-info');
            const closeBtn = e.target.closest('.btn-close__alert');

            if (openBtn) {
                const box = openBtn.parentElement.querySelector('.alert__product_info, .alert__product-info');
                if (box) box.classList.toggle("show");
            } else if (closeBtn) {
                const box = closeBtn.closest('.alert__product_info, .alert__product-info');
                if (box) box.classList.remove("show");// 숨기기
            }
        });

        mmlfcp_state.set('companyInfoEventsBound', true);
    },

    /**
     * 나이에 따른 기본 보험/상품/만기 자동 세팅
     */
    setDefaultByAge(age) {
        if (isNaN(age) || age === null) return;

        let insurance_type = 'F'; // 기본 손보
        let plan_type = '';
        let plan_payterm_type = '01'; // 기본 20년/100세

        if (age <= 15) {
            plan_type = '19'; // 손보 어린이(무해지)
        } else if (age > 15 && age <= 40) {
            plan_type = '20'; // 손보 청소년(표준환급)
        } else {
            plan_type = '06'; // 손보 종합(무해지)
        }

        // State에 값 저장
        mmlfcp_state.set('insurance_type', insurance_type);
        mmlfcp_state.set('plan_type_id', plan_type);
        mmlfcp_state.set('plan_payment_expiration_cd', plan_payterm_type);

        // 성별 제한 로직
        this.handleGenderByPlan(plan_type);

        // UI의 보험유형(생손보) 셀렉트박스 값도 동기화
        const insurSel = document.getElementById('selInsuranceType');
        if (insurSel) {
            insurSel.value = insurance_type;
        }

        // console.log('setDefaultByAge() 에서 생손보유형 코드,', insurance_type);
        // console.log('setDefaultByAge() 에서 상품유형 코드,', plan_type);
        // console.log('setDefaultByAge() 에서 만기유형 코드,', plan_payterm_type);
    },


    //가입 상태로 최초 setting
    setDefaultAssginFilter() {
        const assignChk = document.getElementById("assign");
        const allChk = document.getElementById("all");
        const notAssignChk = document.getElementById("not-assign");
        const all_coverageChk = document.getElementById("all_checked");

        if (assignChk) {
            assignChk.checked = true;
            if (allChk) allChk.checked = false;
            if (notAssignChk) notAssignChk.checked = false;
            if (all_coverageChk) all_coverageChk.checked = false;

        }
    },

    setPlanCoverageList() {
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const requiredPremiums = mmlfcp_state.get('required_premiums') || [];

        // 1️⃣ 기존 리스트 가공 (map 사용으로 깔끔하게)
        const updatedList = planCoverages.map(coverage => ({
            ...coverage,
            DispValue: true,
            plan_coverage_selected: coverage.is_selected_coverage === 'Y' ? 'checked' : '',
        }));

        // 2️⃣ 최저기본계약조건(aa00)이 필요하면 배열 맨 앞에 추가
        if (requiredPremiums.length > 0) {
            updatedList.unshift({
                plan_id: planCoverages[0].plan_id,
                coverage_cd: "aa00",
                coverage_name: "최저기본계약조건",
                guide_coverage_amount: 0,
                is_selected_coverage: "Y",
                DispValue: true,
                plan_coverage_selected: "checked",
                coverage_seq: -1
            });
        }
        // 3️⃣ 결과 반영
        mmlfcp_state.set("plan_coverages", updatedList);
        //console.log('plan_coverages,', updatedList);
    },


    setCoverageProductList() {
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const required_premiums = mmlfcp_state.get('required_premiums') || [];

        // 🔹 required를 빠르게 찾기 위한 Map
        const reqMap = required_premiums.reduce((map, r) => {
            const key = `${r.company_code}|${r.product_code}`; // 템플릿 리터럴이 조금 더 읽기 편해요!
            // 논리 할당 연산자 (||=)는 최신 브라우저에서 아주 잘 돌아갑니다.
            (map[key] ||= []).push(r);
            return map;
        }, Object.create(null));

        coverage_premiums.forEach(product => {
            product.DispValue = true;
            const key = product.company_code + '|' + product.product_code;
            const reqList = reqMap[key];

            //aa00 삽입
            if (reqList?.length) {
                const aa00 = reqList.map(r => ({
                    coverage_cd: "aa00",
                    coverage_seq: -1,
                    insur_cd: r.insur_cd,
                    insur_nm: r.insur_nm,
                    insur_bojang: r.insur_bojang,

                    guide_coverage_amount: parseInt(r.min_insur_amount),
                    guide_coverage_premium: parseInt(r.min_premium),

                    base_coverage_amount: parseInt(r.min_insur_amount),
                    base_premium: parseInt(r.min_premium),

                    coverage_amount: parseInt(r.min_insur_amount),
                    premium: parseInt(r.min_premium),

                    is_selected_coverage: "Y",
                    coverage_amount_ratio: 1,
                    cover_selected: "checked"
                }));
                product.detailList = [...aa00, ...(product.detailList || [])];
            }
            //total_premium 구하기
            let total_premium = 0;
            for (const d of product.detailList) {
                const selected = d.is_selected_coverage === 'Y';
                d.base_coverage_amount = d.guide_coverage_amount || 0;
                d.base_premium = d.guide_coverage_premium || 0;
                d.cover_selected = selected ? 'checked' : '';
                if (selected) {
                    total_premium += Math.floor(d.base_premium || 0);
                }
            }
            product.total_premium = total_premium;
        });

        mmlfcp_state.set('coverage_premiums', coverage_premiums);
        // console.log('coverage_premiums,', coverage_premiums);
    },

    setCoverageGuideData() {
        // 1️⃣ Map 대신 일반 객체({})를 사용합니다.
        const guideObj = {};
        const coverageList = mmlfcp_state.get('coverage_premiums') || [];

        for (const product of coverageList) {
            const baseCode = product.company_code;
            const details = product.detailList || [];

            details.forEach((detail, index) => {
                const key = baseCode + detail.coverage_cd;

                // 2️⃣ 객체 방식으로 데이터 할당
                if (!guideObj[key]) {
                    guideObj[key] = [];
                }
                guideObj[key].push(index);
            });
        }
        // 3️⃣ 이제 JSON.stringify를 해도 데이터가 깨지지 않습니다!
        _state.guide_coverage_item = guideObj;
        //console.log('guideObj 저장 완료:', guideObj);
    },


    setCoverageProductDetailList() {
        const product_insur_premiums = mmlfcp_state.get('product_insur_premiums') || [];
        const required_premiums = mmlfcp_state.get('required_premiums') || [];

        // 🔹 required를 빠르게 찾기 위한 Map
        const reqMap = required_premiums.reduce((map, r) => {
            const key = `${r.company_code}|${r.product_code}`;
            (map[key] ||= []).push(r);

            return map;
        }, Object.create(null));

        product_insur_premiums.forEach(product => {
            const key = product.company_code + '|' + product.product_code;
            const reqList = reqMap[key];

            //aa00 삽입
            if (reqList?.length) {
                const aa00 = reqList.map(r => ({
                    coverage_cd: "aa00",
                    insur_cd: r.insur_cd,
                    insur_nm: r.insur_nm,
                    pay_term: r.pay_term,
                    insur_bojang: r.insur_bojang,
                    guide_contract_amount: parseInt(r.min_insur_amount),
                    contract_amount: parseInt(r.min_insur_amount),
                    guide_premium: parseInt(r.min_premium),
                    premium: parseInt(r.min_premium),
                }));
                product.detailList = [...aa00, ...(product.detailList || [])];
            }
        });

        //product_insur_premiums 반영
        mmlfcp_state.set("product_insur_premiums", product_insur_premiums);
    },

    adjustProductInsurPremiums() {
        const coverageList = mmlfcp_state.get('coverage_premiums') || [];
        const productList = mmlfcp_state.get('product_insur_premiums') || [];

        // ===== 1️. ratioMap 생성 =====
        const ratioMap = new Map();

        for (const product of coverageList) {
            const baseKey = product.company_code + '|' + product.product_code;

            for (const detail of (product.detailList || [])) {
                const ratio = detail.coverage_amount_ratio;
                if (ratio > 0) {
                    ratioMap.set(baseKey + '|' + detail.coverage_cd, ratio);
                }
            }
        }

        // ===== 2️. 상세 premium 보정 =====
        for (const product of productList) {
            const baseKey = product.company_code + '|' + product.product_code;

            for (const detail of (product.detailList || [])) {
                const ratio = ratioMap.get(baseKey + '|' + detail.coverage_cd);
                if (!ratio) continue;

                // ⚠️ 기존 코드 버그 수정 (연산 우선순위)
                const adjusted = Math.floor((+detail.guide_premium || 0) / ratio);
                detail.guide_premium = adjusted;
                detail.premium = adjusted;
            }
        }

        // state 반영
        mmlfcp_state.set('product_insur_premiums', productList);
        //console.log('product_insur_premiums,', productList);
    },

    sortCoverageProductList(productList, checkedId) {

        if (!Array.isArray(productList)) return false;

        // 🔥 기존 순서 복사 (변경 여부 비교용)
        const originalOrder = productList.map(p => p.company_code);

        productList.sort((a, b) => {
            const aChecked = a.DispValue === true;
            const bChecked = b.DispValue === true;

            const aTotal = Number(a.total_premium) || 0;
            const bTotal = Number(b.total_premium) || 0;

            // 1️⃣ total 0은 항상 뒤
            if (aTotal === 0 && bTotal !== 0) return 1;
            if (bTotal === 0 && aTotal !== 0) return -1;

            // 2️⃣ assign / not-assign 우선순위
            if (aChecked !== bChecked) {

                if (checkedId === 'assign') { //가입
                    return aChecked ? -1 : 1;
                }

                if (checkedId === 'not-assign') { //미가입
                    return aChecked ? 1 : -1;
                }
                // all이면 표시 여부 무시
            }

            // 3️⃣ 표시된 것끼리는 보험료 오름차순
            return aTotal - bTotal;
        });

        // 🔥 실제 순서 변경 여부 체크
        for (let i = 0; i < productList.length; i++) {
            if (productList[i].company_code !== originalOrder[i]) {
                return true;
            }
        }
        return false;
    },

    //정렬
    setCoverageSortPremium() {
        // 1. 기준이 될 체크된 보험사 ID 가져오기
        const checkedId = document.querySelector("input[type=checkbox][name='checked_list']:checked")?.id;

        // 2. 상태값 가져오기 (죠르디러버님이 말씀하신 부분!)
        const coveragePremiums = mmlfcp_state.get('coverage_premiums') || [];

        // 3. 데이터가 없으면 실행 중단
        if (coveragePremiums.length === 0) return;

        // 4. 정렬 실행 (기존 sortCoverageProductList 활용)
        const isChanged = this.sortCoverageProductList(coveragePremiums, checkedId);

        // 5. 변경 사항이 있을 경우에만 상태 업데이트
        if (isChanged) {
            mmlfcp_state.set('coverage_premiums', coveragePremiums);
            //console.log('[✅ 정렬 완료] coverage_premiums 상태가 업데이트되었습니다.');
        }
    },

    //원본 리스트 따로 저장
    saveOriginalPlanSnapshot() {
        const snapshot = {
            plan_coverages: structuredClone(mmlfcp_state.get('plan_coverages') || []),
            required_premiums: structuredClone(mmlfcp_state.get('required_premiums') || []),
            coverage_premiums: structuredClone(mmlfcp_state.get('coverage_premiums') || []),
            product_insur_premiums: structuredClone(mmlfcp_state.get('product_insur_premiums') || []),
        };
        mmlfcp_state.set('default_plan_snapshot', snapshot);
    },

    //출력 데이터 만들기
    setCoveragesPrintData() {
        const print_gubun = document.querySelector("input[name='plan_title']:checked")?.value || '0';
        const cust_name = mmlfcp_state.get('cust_name');
        const age = mmlfcp_state.get('age');
        const gender = mmlfcp_state.get('gender');
        const birth_date = mmlfcp_state.get('birth_date');
        const plan_id = mmlfcp_state.get('plan_id');
        const plan_type_id = mmlfcp_state.get('plan_type_id');
        const plan_type_name = mmlfcp_state.get('plan_type_name');
        const plan_payment_expiration_cd = mmlfcp_state.get('plan_payment_expiration_cd');
        const plan_payment_expiration_name = mmlfcp_state.get('plan_payment_expiration_name');


        // 1. bojang_lists → coverages 생성
        const coverages = [];
        let is_required_coverage = "N";

        document.querySelectorAll('#bojang_lists input[type="checkbox"]').forEach(cb => {
            if (cb.checked) {
                const coverage_cd = cb.dataset.cd;
                const coverage_name = cb.getAttribute("coverage_name") || "";
                const coverage_amount = coverage_cd == 'aa00' ? 0 : parseInt(cb.getAttribute("guide_coverage_amount"));

                if (coverage_name == "최저기본계약조건") {
                    is_required_coverage = "Y";
                }

                if (coverage_name != '최저기본계약조건') {
                    coverages.push({
                        coverage_cd: coverage_cd,
                        coverage_name: coverage_name,
                        coverage_amount: coverage_amount
                    });
                }
            }
        });

        // 2. companyInfo → company_codes 생성
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const company_codes = [];

        coverage_premiums.forEach(product => {
            if (product.DispValue) {
                company_codes.push(product.company_code);
            }
        });


        // 최종 출력 데이터
        const printData = {
            print_gubun,
            cust_name,
            age,
            gender,
            birth_date,
            plan_id,
            plan_type_id,
            plan_type_name,
            plan_payment_expiration_cd,
            plan_payment_expiration_name,
            is_required_coverage,
            company_codes,
            coverages
        };
        return printData;
    },

    //전체선택 상태값 변경
    setDetailListSelectedAll(productList, checked_val) {
        if (!Array.isArray(productList)) return productList;

        productList.forEach(product => {
            if (!Array.isArray(product.detailList)) return;

            product.detailList.forEach(detail => {
                detail.cover_selected = checked_val; // "checked" 또는 ""
            });
        });
        return productList;
    },


    //전체선택 체크 시 setting
    setPlanCoverage_Display_all(checked_val) {
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];

        planCoverages.forEach(cov => {
            if (cov.DispValue) {
                cov.plan_coverage_selected = checked_val;
            }
        });

        // 2️⃣ 상품 detailList 전체 선택 (공통 처리)
        this.setDetailListSelectedAll(coverage_premiums, checked_val);

        // 3️⃣ state 반영
        mmlfcp_state.set('plan_coverages', planCoverages);
        mmlfcp_state.set('coverage_premiums', coverage_premiums);
    },


    //모두보기,가입,미가입 체크 시 setting
    setPlanCoverage_Display(checked_val) {
        // plan_coverages 상태 불러오기
        let planCoverages = mmlfcp_state.get('plan_coverages') || [];

        // checked_val에 따라 각 항목의 DispValue 값 업데이트
        planCoverages.forEach(cov => {
            switch (checked_val) {
                case "all":   //'all'일 경우: 모든 항목을 표시
                    cov.DispValue = true;
                    break;
                case "assign":  //'assign'일 경우: 선택된 항목만 표시
                    cov.DispValue = cov.plan_coverage_selected == "checked";
                    break;
                case "not-assign": //'not-assign'일 경우: 선택되지 않은 항목만 표시
                    cov.DispValue = cov.plan_coverage_selected != "checked";
                    break;
            }
        });

        // 업데이트된 상태 반영
        mmlfcp_state.set('plan_coverages', planCoverages);
    },

    /**
     * 상품유형 셀렉트 박스 렌더링
     * - plan_type 기준으로 중복 제거
     * - 각 option에 data-plan_id 부여
     */
    renderPlanOptions() {
        const selectEl = document.getElementById('selProductsGroupCD');
        if (!selectEl) return;

        const plans = mmlfcp_state.getPlans();
        const insurance_type = mmlfcp_state.get('insurance_type');
        let plan_type = mmlfcp_state.get('plan_type_id'); // State의 현재 값

        // 1) 보험유형 필터링 및 중복 제거
        const filteredPlans = plans.filter(p => p.insurance_type === insurance_type);
        const uniquePlanTypes = [...new Map(filteredPlans.map(p => [p.plan_type, p])).values()];

        selectEl.innerHTML = '';

        // 2) ⭐ [보완] 현재 필터링된 목록에 savedPlanTypeId가 실제로 존재하는지 확인
        const isExist = uniquePlanTypes.some(p => p.plan_type == plan_type);

        // 존재하지 않거나 값이 없다면, '무조건 첫 번째' 원칙에 따라 초기화 대상임
        if (!isExist) {
            plan_type = null;
        }

        uniquePlanTypes.forEach((plan, index) => {
            const option = document.createElement('option');
            option.value = plan.plan_type;
            option.textContent = plan.plan_name; // 필드명 확인 필요!

            // 3) 선택 로직 적용
            if (plan_type && plan.plan_type == plan_type) {
                option.selected = true;
                mmlfcp_state.set('plan_type_id', plan.plan_type);
                mmlfcp_state.set('plan_type_name', plan.plan_name);
            }
            else if (!plan_type && index === 0) {
                // 찾는 값이 없거나 처음이면 무조건 첫 번째 항목 선택
                option.selected = true;
                // ⭐ [핵심] 첫 번째가 선택되었음을 State에도 즉시 알려줌 (만기 렌더링 등을 위해)
                mmlfcp_state.set('plan_type_id', plan.plan_type);
                mmlfcp_state.set('plan_type_name', option.textContent);
            }
            selectEl.appendChild(option);
        });

        // 4) UI 강제 동기화
        if (selectEl.options.length > 0) {
            selectEl.value = mmlfcp_state.get('plan_type_id');
        }
    },

    syncStateAndUI() {
        const planSel = document.getElementById('selProductsGroupCD');
        const genderSel = document.getElementById('gender');
        const birthEl = document.getElementById('birth_date');
        const insurSel = document.getElementById('selInsuranceType');
        const payExpSel = document.getElementById('selPaymentExpirationCD'); // 만기 셀렉트 추가

        // 1️⃣ 이름 및 생년월일 기초 세팅
        if (!mmlfcp_state.get('cust_name')) {
            mmlfcp_state.set('cust_name', _state.cust_name);
        }
        if (!mmlfcp_state.get('birth_date')) {
            mmlfcp_state.set('birth_date', _state.birth_date || birthEl?.value);
        }

        // 2️⃣ 경로(path) 또는 나이에 따른 자동 상품 세팅
        const path = mmlfcp_state.get('url_path'); // main.js에서 저장한 path 값
        const currentBirthDate = mmlfcp_state.get('birth_date');
        const age = (currentBirthDate && currentBirthDate.length === 8) ? app.getAgefromString(currentBirthDate) : 0;
        mmlfcp_state.set('age', age);

        if (path === 'fire') {
            // 🔥 path=fire (손보) 우선 세팅
            mmlfcp_state.set('insurance_type', 'F');
            mmlfcp_state.set('plan_type_id', '06'); // 손보 종합(무해지)
            mmlfcp_state.set('plan_payment_expiration_cd', '01'); // 20년/100세
        }
        else if (path === 'lifefire') {
            // 🌿 path=lifefire (생손보) 우선 세팅
            mmlfcp_state.set('insurance_type', 'LF');
            mmlfcp_state.set('plan_type_id', '01'); // 생손보 건강(무해지)
            mmlfcp_state.set('plan_payment_expiration_cd', '01'); // 20년/100세
        }
        else if (age > 0) {
            // 경로 정보가 없을 때만 나이 기반 기본값 세팅
            this.setDefaultByAge(age);
        }

        // 3️⃣ 세팅된 State 값을 UI(DOM)에 반영
        if (insurSel) {
            insurSel.value = mmlfcp_state.get('insurance_type');
        }

        // 상품 유형 UI 반영 (선택된 옵션의 텍스트도 같이 저장)
        if (planSel) {
            const targetPlanType = mmlfcp_state.get('plan_type_id');
            if (targetPlanType) {
                planSel.value = targetPlanType;
                if (planSel.selectedOptions.length > 0) {
                    mmlfcp_state.set('plan_type_name', planSel.selectedOptions[0].textContent);
                }
            }
        }

        // 만기 UI 반영
        if (payExpSel) {
            const targetExp = mmlfcp_state.get('plan_payment_expiration_cd');
            if (targetExp) {
                payExpSel.value = targetExp;
            }
        }

        // 4️⃣ 성별 select 기본값 및 제한 적용
        const defaultGender = mmlfcp_state.get('gender') || _state.gender;
        if (genderSel && defaultGender) {
            Array.from(genderSel.options).forEach(opt => opt.disabled = false);

            const currentPlanType = mmlfcp_state.get('plan_type_id');
            this.handleGenderByPlan(currentPlanType);

            const finalGender = mmlfcp_state.get('gender') || defaultGender;
            genderSel.value = finalGender;
            mmlfcp_state.set('gender', finalGender);
        }

        // 5️⃣ 최종적으로 결정된 조합에 맞는 plan_id 찾기
        this.updatePlanIdByCurrentState();
    },

    //생년월일 랜더링
    renderInsuAge() {
        const insur_age = mmlfcp_state.get("age");
        const insuEl = document.getElementById('insur_age');
        if (!insuEl) return;
        insuEl.innerHTML = '';

        let html = '';
        html = `생년월일 ( 보험나이 : ${insur_age}세 )`;
        insuEl.innerHTML = html;
    },

    /**
    * 선택된 상품유형(plan_type)에 따른 납기/만기 옵션 랜더링
    */
    renderPayTermBySelectedPlan() {
        const plans = mmlfcp_state.getPlans();
        const planType = document.getElementById('selProductsGroupCD')?.value;
        const payTermSelect = document.getElementById('selPaymentExpirationCD');
        if (!payTermSelect || !planType) return;

        // 1️⃣ 나이에 따라 자동 세팅되는 특별 상품 코드 목록 (앞서 약속한 코드들)
        //const ageDefaultPlanTypes = ['19', '20', '06'];
        //const isSpecialPlan = ageDefaultPlanTypes.includes(planType);

        // 2️⃣ 현재 상품유형에 맞는 만기 필터링 및 중복 제거
        const filtered = plans.filter(p => p.plan_type == planType);
        const uniquePayTerms = [...new Map(filtered.map(p => [p.plan_payterm_type, p])).values()];

        payTermSelect.innerHTML = '';

        // 3️⃣ '20년/100세(01)'가 목록에 있는지 미리 확인
        //const has100YearOption = uniquePayTerms.some(p => p.plan_payterm_type === '01');

        uniquePayTerms.forEach((p, i) => {
            const opt = document.createElement('option');
            opt.value = p.plan_payterm_type;
            opt.textContent = p.plan_payterm_type_name;

            //20년/100세 만기가 있다면 -> 선택
            if (p.plan_payterm_type === '01') {
                opt.selected = true;
            }
            //20년/100세 종신이 있다면 -> 선택
            else if (p.plan_payterm_type === '06') {
                opt.selected = true;
            }
            else {
                // [조건 B] 일반 상품이거나 100세 만기가 없다면 -> 무조건 첫 번째 항목 선택
                if (i === 0) opt.selected = true;
            }
            payTermSelect.appendChild(opt);

            // // 4️⃣ ⭐ 조건별 선택 로직
            // if (isSpecialPlan && has100YearOption) {
            //     // [조건 A] 나이별 자동 세팅 상품이고 + 100세 만기가 있다면 -> 100세 선택
            //     if (p.plan_payterm_type === '01') opt.selected = true;
            // }
            // else {
            //     // [조건 B] 일반 상품이거나 100세 만기가 없다면 -> 무조건 첫 번째 항목 선택
            //     if (i === 0) opt.selected = true;
            // }
        });

        // 5️⃣ 최종 선택된 값을 다시 State에 동기화
        if (payTermSelect.options.length > 0) {
            const selectedIndex = payTermSelect.selectedIndex !== -1 ? payTermSelect.selectedIndex : 0;
            const selectedOption = payTermSelect.options[selectedIndex];

            mmlfcp_state.set('plan_payment_expiration_cd', selectedOption.value);
            mmlfcp_state.set('plan_payment_expiration_name', selectedOption.textContent);
        }
    },

    handlePlanTypeChange() {
        const planSel = document.getElementById('selProductsGroupCD');

        // 1️. 안전 장치: 선택된 옵션이 없는 경우 방어
        if (!planSel || planSel.selectedIndex === -1) return;

        const selectedPlanType = planSel.value;
        const selectedText = planSel.selectedOptions[0].textContent;

        // 2. State 반영
        mmlfcp_state.set('plan_type_id', selectedPlanType);
        mmlfcp_state.set('plan_type_name', selectedText);

        // 3. 성별 제어 (플랜에 따라 성별 선택 제한 등)
        this.handleGenderByPlan(selectedPlanType);

        // 4️. 상품 유형이 바뀌었으므로 그에 맞는 납기/만기 리스트 새로 렌더링
        // 이 함수 안에서 mmlfcp_state.set('plan_payment_expiration_cd', ...)가 실행됨
        this.renderPayTermBySelectedPlan();

        // 5️. ⭐ 헬퍼 함수를 사용하여 최종 plan_id 동기화
        // 직접 find를 돌리는 대신 공통 함수를 호출하는 것이 좋습니다.
        this.updatePlanIdByCurrentState();

        // 6️. 하단 조회가능 나이 안내 텍스트 갱신
        this.renderPayTermSelectedAge();

        // 7️. UI 초기화
        this.hide_content();
        _state.current_page = 1;
    },

    handleGenderByPlan(selectedPlanType) {
        const genderSel = document.getElementById('gender');
        if (!genderSel) return;

        const maleOpt = genderSel.querySelector('option[value="M"]');
        if (!maleOpt) return;

        // 1️⃣ 손보 여성건강(08) 플랜일 때: 철저하게 여성 전용으로!
        if (selectedPlanType === '08') {
            maleOpt.disabled = true; // 남성 선택 불가

            // 현재 선택된 값이 남성일 때만 여성으로 강제 전환 (불필요한 세팅 방지)
            if (genderSel.value === 'M') {
                genderSel.value = 'F';
                mmlfcp_state.set('gender', 'F');
            }
        }
        // 2️⃣ 그 외의 플랜일 때: 다시 자유를 줍니다.
        else {
            maleOpt.disabled = false; // 남성 선택 가능하게 해줌
            // 주의: 여기서 genderSel.value를 건드리지 않아야 
            // 사용자가 선택해둔 성별이 유지됩니다!
        }
    },


    //업데이트 날짜 랜더링
    renderUploadDate() {
        // 1. 구조 분해 할당을 통해 변수를 깔끔하게 추출합니다.
        const { fire_upload_date, life_upload_date } = mmlfcp_state.get('upload_date') || {};

        // 2. 템플릿 리터럴(`)을 사용하여 HTML 구조를 한눈에 보기 쉽게 작성합니다.
        const html = `
        <span style="font-weight: 600;">업데이트 일자 ( </span>
        <span style="color: #2f88ff; font-weight: 600;">손해보험 </span>
        <span style="font-weight: 400;"> ${fire_upload_date} </span>
        <i>/</i> 
        <span style="color: #2f88ff; font-weight: 600;">생명보험 </span>
        <span style="font-weight: 400;"> ${life_upload_date}</span>
        <span style="font-weight: 600;"> )</span>
        `;

        // 3. innerHTML을 사용합니다.
        const uploadDateElement = document.getElementById('uploadDate');
        if (uploadDateElement) {
            uploadDateElement.innerHTML = html;
        }
    },

    /**
    * 선택된 상품유형(plan_type)에 따른 조회나이 랜더링
    */
    renderPayTermSelectedAge() {
        const selectedResult = document.getElementById('selected_result');
        if (!selectedResult) return;

        const plans = mmlfcp_state.getPlans();
        const plan_id = mmlfcp_state.get('plan_id');
        const plan_type = mmlfcp_state.get('plan_type_id');
        const plan_payterm_type = mmlfcp_state.get('plan_payment_expiration_cd');
        const gender = mmlfcp_state.get('gender') == 'M' ? '남성' : '여성';

        // 1️⃣ 조건에 맞는 플랜을 정확히 하나만 찾음
        const selectedPlan = plans.find(p => p.plan_id == plan_id && p.plan_type == plan_type && p.plan_payterm_type == plan_payterm_type);
        //console.log({ plans: plans });


        // 찾지 못하면 그냥 리턴
        if (!selectedPlan) {
            selectedResult.textContent = "";
            return;
        }

        // 2️⃣ 성별에 따라 나이 범위 선택
        const minAge = gender == '남성' ? selectedPlan.plan_min_m_age : selectedPlan.plan_min_f_age;
        const maxAge = gender == '남성' ? selectedPlan.plan_max_m_age : selectedPlan.plan_max_f_age;

        // 3️⃣ 출력
        selectedResult.textContent = `${gender} / ${selectedPlan.plan_name} / ${selectedPlan.plan_payterm_type_name} 상품은 ` + `${minAge}세 ~ ${maxAge}세까지 조회가 가능합니다.`;
    },

    //상품유형에 따라 상세보기 버튼 활성화/비활성화
    setDetailMenu() {
        /*
           -- 종합(표준환급률),종합(무해지형),간편325(무해지형),간편335(무해지형),간편355(무해지형),
              어린이(표준환급률),어린이(무해지형), 청소년(표준환급률),청소년(무해지형) 대상으로,
           
           --예외사항
           1.만기보험료,연령별 보험료 비교만 보이기 -> 여성건강무해지
           2. 만기보험료 비교만 보이기 -> 치매-생보
           3.만기가 1년/갱신, 10년/갱신, 20년/갱신, 20년/100세,종신, 30년/갱신 인 상품들일 경우
            보험료vs최저최대, 연령대별 보험료 비교만 보여준다
       
           4. 나머지는
            보험료vs최저최대, 만기 보험료 비교, 연령대별 보험료 비교를 모두 보여준다.
       */

        const plan_type = mmlfcp_state.get('plan_type_id'); //01 - 상품유형 코드 
        const plan_payment_expiration_name = mmlfcp_state.get('plan_payment_expiration_name'); //20년/100세 -> 만기명

        //1️⃣ 기본 탭 상태(전부 숨김)
        const menu = {
            premium: false, // 보험료 최저vs최대
            payment: false, // 만기 보험료 비교
            aging: false    // 연령대별 보험료 비교
        };


        // 2️⃣ 상품유형 분류
        const BASE_TARGET_PRODUCTS = [
            "05", "06", "07", // 종합
            "14", "15", "16", "17",// 간편 325/335/355/31010
            "18", "19",// 어린이
            "20", "21", "22",// 청소년
            "25", //생보 치매(무해지)
        ];

        // 여성건강무해지
        const FEMALE_HEALTH = "08";

        //plan_payment_expiration_name.includes("갱신") ||

        // 3️⃣ 만기 조건 판별
        const isRenewalExpiration =
            plan_payment_expiration_name.includes("종신") ||
            plan_payment_expiration_name.includes("20년/100세,종신");

        // 4️⃣ 예외 조건 먼저 처리 (중요!)
        // 🔹 예외 1: 여성건강무해지
        if (plan_type === FEMALE_HEALTH) {
            menu.payment = true;
            menu.aging = true;
        }
        // 🔹 예외 3: 특정 만기 조건
        else if (isRenewalExpiration) {
            menu.premium = true;
            menu.aging = true;
        }

        // 5️⃣ 기본 대상 상품
        else if (BASE_TARGET_PRODUCTS.includes(plan_type)) {
            menu.premium = true;
            menu.payment = true;
            menu.aging = true;
        }
        //나머지 상품
        else {
            menu.premium = true;
            menu.aging = true;
        }

        // 한꺼번에 변경 사항을 모아서 브라우저에 전달합니다.
        window.requestAnimationFrame(() => {
            this._toggleMenu("openDetailModalBtn", menu.premium);
            this._toggleMenu("openPaymentModalBtn", menu.payment);
            this._toggleMenu("openAgingModalBtn", menu.aging);
        });
    },

    setSimplifiDetailMenu() {
        const plan_type = mmlfcp_state.get('plan_type_id'); //01 - 상품유형 코드 

        //1️⃣ 기본 탭 상태(전부 숨김)
        const menu = {
            simplifi: false,
        };

        // 2️⃣ 상품유형 분류
        const BASE_TARGET_PRODUCTS = [
            "01", "02", "03", "04", // 생손보
            "06", "07", "14", "15", "16", "17", "21", "22",// 손보 종합(무해지), 51010, 간편, 청소년
            "09", "11", "12", "13",// 생보건강, 생보간편
        ];

        //3. 활성화 구분
        if (BASE_TARGET_PRODUCTS.includes(plan_type)) {
            menu.simplifi = true;
        }

        //set display
        this._toggleMenu("openCoverageDetailModalBtn", menu.simplifi);
    },

    setPrintliMenu() {
        const plan_type = mmlfcp_state.get('plan_type_id'); //상품유형 코드

        const menu = {
            payment: false, //만기별 보험료 비교 출력
            simplifi: false, // 상품유형별 비교 출력
        };

        //만기별 비교 상품유형 코드
        const BASE_PAYMENT_PRODUCTS = [
            "05", "06", "07", // 종합
            "14", "15", "16", "17",// 간편 325/335/355/31010
            "18", "19",// 어린이
            "20", "21", "22",// 청소년
            "25", //생보 치매(무해지)
        ];

        //상품유형별 비교 상품유형 코드
        const BASE_SIMPLIFI_PRODUCTS = [
            "01", "02", "03", "04", // 생손보
            "06", "07", "14", "15", "16", "17", "21", "22",// 손보 종합(무해지), 51010, 간편, 청소년
            "09", "11", "12", "13",// 생보건강, 생보간편
        ];

        if (BASE_PAYMENT_PRODUCTS.includes(plan_type)) {
            menu.payment = true;
        }
        if (BASE_SIMPLIFI_PRODUCTS.includes(plan_type)) {
            menu.simplifi = true;
        }

        // 3. _toggleMenu 함수를 호출하여 실제 DOM 제어
        this._toggleMenu('product-title', menu.payment);
        this._toggleMenu('plan-type-title', menu.simplifi);
    },

    render_coverage_bojang() {
        // ✅ 추가 (user_coverages가 있을 때만 사용자 플랜 렌더)
        const user_coverages = mmlfcp_state.get('user_coverages') || [];
        const selected_user_plan_id = document.getElementById('user_coverages')?.value || '';

        // ✅ 선택된 플랜이 있을 경우 → 사용자 플랜 적용
        if (selected_user_plan_id && user_coverages.length > 0) {

            userController.getUserCoverage();
        }
        // ✅ 기본플랜일 경우 → 원본 데이터로 렌더링 복원
        else {
            userController.restoreDefaultPlanState();
        }
    },


    // 플랜기준보장 데이터 -> 화면 왼쪽
    renderPlanCoverages() {
        const lists = document.getElementById('bojang_lists');
        if (!lists) return;

        const plan_coverages = mmlfcp_state.get('plan_coverages') || [];

        const html = plan_coverages.map(c => {
            const is_disp = c.DispValue;
            //일반 담보 : 체크박스 + 금액 입력
            if (is_disp) {
                const coverage_cd = c.coverage_cd;
                const coverage_name = c.coverage_name;
                const guide_coverage_amount = coverage_cd == 'aa00' ? '-' : c.guide_coverage_amount;
                const plan_coverage_selected = c.plan_coverage_selected == 'checked';

                const checkId = `chk_${coverage_cd}`;
                const inputId = `input_${coverage_cd}`;

                const is_disabled = coverage_cd == 'aa00' ? 'disabled' : '';
                const is_checked = plan_coverage_selected ? 'checked' : '';
                const displayVal = coverage_cd == 'aa00' ? '-' : plan_coverage_selected ? app.formatNumber(guide_coverage_amount) : 0;

                // ✅ coverage_name이 "최저기본계약조건"일 때만 툴팁 span 추가
                const tooltip = coverage_name == "최저기본계약조건" ? `<span class="tooltip-icon" data-tooltip="최저기본계약조건 설명

• '최저 기본계약 조건'은 보험에 가입하기 위해 반드시 포함해야 하는 필수 의무가입 담보입니다.
• 실제 보험 상품을 설계할 때는 조건 및 금액이 변경될 수 있으니 비교를 위한 단순 참고용으로 사용하시기 바랍니다.">?</span>` : '';


                return `
                <li>
                    <div class="left">
                    <div class="checkbox-area">
                        <input type="checkbox" id="${checkId}" data-cd="${coverage_cd}" coverage_name="${coverage_name}" guide_coverage_amount="${guide_coverage_amount}"${is_checked}>
                        <label for="${checkId}">${coverage_name}</label>
                        ${tooltip}
                    </div>
                    </div>
                    <div class="right">
                    <input type="text" id="${inputId}" data-cd="${coverage_cd}" coverage_name="${coverage_name}" guide_coverage_amount="${guide_coverage_amount}" value="${displayVal}"${is_disabled}>
                    </div>
                </li>
                `;
            }
        }).join('');
        lists.innerHTML = html;
    },

    //회사 별 상세정보, 합계보험료 랜더링
    renderRequiredPremiums(page = 1) {
        const wrap = document.getElementById('companyInfo');
        if (!wrap) return;

        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];

        // ✅ 전체 데이터 기준으로 max/min 계산
        const { max: globalMax, min: globalMin } = this.getMaxMinPremium(coverage_premiums, 'total_premium');


        // ✅ 페이징 처리 (slice는 화면에 뿌릴 데이터)
        const { current, totalPages, slice } = this.paginate(coverage_premiums, page, 10);
        mmlfcp_state.set('required_premiums_grouped', coverage_premiums);

        // 플래그 초기화
        const flags = { maxAssigned: false, minAssigned: false };

        // 5) HTML rendering
        wrap.innerHTML = `<ul>
        ${slice.map(item => {
            const chk_id = `chk_${item.company_code}`;
            const btn_id = `btn_${item.company_code}`;
            const total_id = `total_${item.company_code}`;
            const total_premium = item.DispValue ? item.total_premium : 0;
            return `
                    <li>
                    <div class="inner">
                        <div class="checkbox-area">
                        <input type="checkbox" id="${chk_id}" company_code="${item.company_code}" company_name="${item.company_name}" ${item.DispValue == true ? "checked" : ""}>
                        <label for="${chk_id}"></label>
                        </div>

                        <div class="img-area">
                        <img src="./images/${item.company_code}.png" alt="${item.company_name}">
                        </div>

                        <div class="price-area">
                        <span id="${total_id}" total_premium="${total_premium}">${app.formatNumber(total_premium)}</span>
                        </div>

                        <button type="button" id="${btn_id}" class="btn__product-info">상품정보</button>

                        <div class="alert__product-info">
                        <img src="./images/ico__alert-close.svg" alt="닫기" class="btn-close__alert">
                        <div class="alert__top">
                            <span>${item.company_name}</span>
                            <strong>${item.product_name || ''}</strong>
                        </div>
                        <div class="alert__bottom">
                            <strong>${item.product_detail_name || ''}</strong><br>
                            <span>가입조건 :</span>
                            <strong>${item.product_conditions || ''}</strong>
                        </div>
                        </div>
                    </div>
                    </li>
                `;
        }).join('')}
        </ul>`;

        // ✅ applyPremiumStyle → 전체 기준(globalMax/globalMin)으로 스타일 적용
        slice.forEach(item => {
            const el = document.getElementById(`total_${item.company_code}`);
            if (el) {
                const total_premium = item.DispValue ? item.total_premium : 0;
                el.textContent = app.formatNumber(total_premium);
                el.setAttribute("total_premium", total_premium);
                // ⚠️ 0일 경우에는 스타일 적용 대상에서 제외
                if (total_premium > 0) {
                    this.applyPremiumStyle(el, total_premium, globalMax, globalMin, flags);
                }
                else {
                    el.classList.remove('company__red', 'company__blue', 'company__black');
                    el.classList.add('company__black');
                }
            }
        });

        // 5) 페이징 버튼 & 토글 보장
        this.bindSharedPager(totalPages, current);
        this.ensureCompanyInfoTogglesBound();
    },

    //회사별 보장별 보험료 랜더링
    renderCoveragePremiums(page = 1) {
        const ul = document.getElementById('premium_lists');
        if (!ul) return;

        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];

        // 페이징 처리
        const PER_PAGE = 10;
        const totalPages = Math.ceil(coverage_premiums.length / PER_PAGE) || 1;
        const current = Math.min(Math.max(1, page), totalPages);
        mmlfcp_state.set('coveragePremiums_page', current);

        const start = (current - 1) * PER_PAGE;
        const pageCompanies = coverage_premiums.slice(start, start + PER_PAGE);

        // ✅ 전체 기준 coverage_cd별 max/min 미리 계산
        const coverageMinMaxMap = {};
        planCoverages
            .filter(cov => cov.DispValue)
            .forEach(cov => {
                let premiums = [];

                coverage_premiums.forEach(product => {
                    const coverageKey = product.company_code + cov.coverage_cd;
                    const idxList = _state.guide_coverage_item[coverageKey] || [];
                    if (idxList) {
                        const premiumSum = idxList.reduce((sum, idx) => {
                            const detail = product.detailList[idx];
                            return sum + (detail?.base_premium || 0);
                        }, 0);

                        if (product.DispValue && cov.plan_coverage_selected === "checked") {
                            premiums.push(premiumSum);
                        }
                    }
                });
                coverageMinMaxMap[cov.coverage_cd] = this.getMaxMinPremium(premiums.map(v => ({ base_premium: v })), 'base_premium');
            });

        // HTML 생성
        const html = planCoverages
            .filter(cov => cov.DispValue)
            .map(cov => {
                const covCells = pageCompanies.map(product => {
                    const emId = `${product.company_code}_${cov.coverage_cd}`;
                    const coverageKey = product.company_code + cov.coverage_cd;
                    const idxList = _state.guide_coverage_item[coverageKey] || [];

                    let premiumSum = 0;
                    if (idxList) {
                        premiumSum = idxList.reduce((sum, idx) => {
                            const detail = product.detailList[idx];
                            return sum + Math.floor(detail?.base_premium || 0);
                        }, 0);
                    }
                    const displayPremium = premiumSum;
                    return `<span><em id="${emId}" coverage_cd="${cov.coverage_cd}" company_code="${product.company_code}" premium="${displayPremium}">${app.formatNumber(displayPremium)}</em></span>`;
                }).join('');

                return `<li>${covCells}</li>`;
            })
            .join('');

        ul.innerHTML = html;

        // ✅ 담보별 색상/값 갱신 (전체 기준 min/max 사용)
        planCoverages
            .filter(cov => cov.DispValue)
            .forEach(cov => {
                const { max: globalMax, min: globalMin } = coverageMinMaxMap[cov.coverage_cd] || { max: 0, min: 0 };
                const flags = { maxAssigned: false, minAssigned: false };
                this.updatePremiumCell(cov.coverage_cd, pageCompanies, globalMax, globalMin, flags);
            });

        // 페이징 버튼 바인딩
        this.bindSharedPager(totalPages, current);
    },


    //플랜 상품담보별보험료 상세보기 랜더링
    renderInsurPremiumsDetail(company_code, coverage_cd, page = 1) {
        const container = document.getElementById('priceList');
        if (!container) return;

        const product_insur_premiums = mmlfcp_state.get('product_insur_premiums') || [];

        let targetList = [];
        let product_name = '';

        targetList = product_insur_premiums.filter(r => r.company_code == company_code);
        product_name = targetList[0]?.product_name.trim() || '';

        container.innerHTML = `
        <div style="font-size: 1.6rem; margin: 35px 0px 10px 0px; font-weight: 500;">${product_name}</div>
        <div style="margin: 0; overflow: scroll; height: 200px;">
        <table>
            <tbody>
            ${targetList.map(insu_product =>
            insu_product.detailList
                // ✅ coverage_cd 조건 추가
                .filter(detail => detail.coverage_cd == coverage_cd)
                .map(detail => `
                            <tr>
                                <td style="font-size: 1.0rem; padding: 25px 0px 10px 0px;">
                                    <h3 id="${company_code}_${detail.coverage_cd}" style="color: #2f88ff;">
                                        ${detail.insur_nm} : ${app.formatNumber(detail.contract_amount)}만원
                                        (${app.formatNumber(detail.premium)}원)(${detail.pay_term})
                                    </h3>
                                    <br />
                                    ${(detail.insur_bojang || "").replace(/(?:\r\n|\r|\n)/g, '<br />')}
                                </td>
                            </tr>
                        `).join('')
        ).join('')}
         </tbody>
    </table>
        </div>

    <div class="button-area">
        <button type="button" class="btn-priceList-cancel">닫기</button>
    </div>
    `;
    },


    //플랜별 가입금액 변경
    updatePlanCoverageAmount(coverage_cd, change_coverage_amount) {
        // 1) plan_coverages guide_coverage_amount 업데이트
        let planCoverages = mmlfcp_state.get('plan_coverages') || [];

        // 안전한 숫자 처리
        const safeAmount = Number(change_coverage_amount) || 0;

        // 상태 업데이트
        planCoverages = planCoverages.map(cov => {
            if (cov.coverage_cd == coverage_cd && cov.plan_coverage_selected == 'checked') {
                // guide_coverage_amount 수정
                this.updateCoverageInputDOM(coverage_cd, safeAmount); // DOM 업데이트 분리
                return { ...cov, guide_coverage_amount: safeAmount };
            }
            return cov;
        });

        // 상태 저장
        mmlfcp_state.set('plan_coverages', planCoverages);
    },

    // 🔹 plan_coverages DOM 업데이트 분리
    updateCoverageInputDOM(coverage_cd, safeAmount) {
        const inputCheckEl = document.getElementById(`chk_${coverage_cd}`);
        const inputCoverEl = document.getElementById(`input_${coverage_cd}`);
        if (!inputCheckEl || !inputCoverEl) return;
        const formatted = Number.isFinite(safeAmount) ? app.formatNumber(safeAmount) : 0;

        //체크박스
        inputCheckEl.setAttribute("guide_coverage_amount", safeAmount);

        //가입금액 부분
        inputCoverEl.value = formatted;
        inputCoverEl.setAttribute("value", formatted);               // HTML 속성 반영
        inputCoverEl.setAttribute("guide_coverage_amount", safeAmount); // custom attribute 반영

    },

    updateCoveragePremiums(coverage_cd, change_coverage_amount) {

        // 1️⃣ 상태 불러오기 (배열인지 확인)
        let coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        let product_insur_premiums = mmlfcp_state.get('product_insur_premiums') || [];

        const amount = Number(change_coverage_amount) || 0;

        // 2️⃣ coverage_premiums 반영
        const ratio = this.applyCoverageAdjustment(coverage_premiums, coverage_cd, amount);

        // 3️⃣ product_insur_premiums 반영
        this.applyInsurAdjustment(product_insur_premiums, coverage_cd, ratio);

        // 4️⃣ 상태 반영 (수정된 객체가 담긴 리스트를 다시 세팅)
        mmlfcp_state.set('coverage_premiums', [...coverage_premiums]); // 스프레드 연산자로 새 배열 전달 권장
        mmlfcp_state.set('product_insur_premiums', [...product_insur_premiums]);

        // 5️⃣ Ratio Map 저장
        const ratioMap = mmlfcp_state.get('coverage_ratio_map') || {};
        ratioMap[coverage_cd] = ratio;
        mmlfcp_state.set('coverage_ratio_map', ratioMap);

        // console.log('[✅ 업데이트 완료]', coverage_cd, 'Ratio:', ratio);
    },

    //coverage_premiums 반영
    applyCoverageAdjustment(list, coverage_cd, change_coverage_amount) {
        if (!Array.isArray(list)) return 0;

        let ratio = 0;
        for (const product of list) {
            const details = product.detailList;
            if (!details) continue;

            for (const d of details) {
                if (d.coverage_cd !== coverage_cd) continue;

                // 비율 계산 (최초 한 번만 찾아도 됨)
                const guide_coverage_amount = d.guide_coverage_amount || 0;
                if (guide_coverage_amount > 0) {
                    ratio = guide_coverage_amount ? change_coverage_amount / guide_coverage_amount : 0;
                }

                // 객체 속성 직접 수정 (참조에 의한 변경)
                d.base_coverage_amount = change_coverage_amount;
                d.base_premium = Math.floor(ratio * (d.guide_coverage_premium || 0));
            }
        }
        return ratio;
    },

    //coverage_insur_premiums 반영
    applyInsurAdjustment(list, cd, ratio) {
        for (const product of list) {
            const details = product.detailList;
            if (!details) continue;
            for (const d of details) {
                if (d.coverage_cd !== cd) continue;
                d.contract_amount = Math.floor(ratio * (d.guide_contract_amount || 0));
                d.premium = Math.floor(ratio * (d.guide_premium || 0));
            }
        }
    },

    //플랜 보장별 가입금액, 보험료 변경
    updateCoveragePremiums(coverage_cd, change_coverage_amount) {
        const amount = Number(change_coverage_amount) || 0;

        // 1️⃣ 상태 불러오기 (배열인지 확인)
        let coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        let product_insur_premiums = mmlfcp_state.get('product_insur_premiums') || [];

        // 2️⃣ coverage_premiums 반영
        const ratio = this.applyCoverageAdjustment(coverage_premiums, coverage_cd, amount);

        // 3️⃣ coverage_insur_premiums 반영
        this.applyInsurAdjustment(product_insur_premiums, coverage_cd, ratio);

        // 4️⃣ 상태 반영 (수정된 객체가 담긴 리스트를 다시 세팅)
        mmlfcp_state.set('coverage_premiums', [...coverage_premiums]); // 스프레드 연산자로 새 배열 전달 권장
        mmlfcp_state.set('product_insur_premiums', [...product_insur_premiums]);

        // 5️⃣ Ratio Map 저장
        const ratioMap = mmlfcp_state.get('coverage_ratio_map') || {};
        ratioMap[coverage_cd] = ratio;
        mmlfcp_state.set('coverage_ratio_map', ratioMap);

        //console.log('[✅ 업데이트 완료]', coverage_cd, 'Ratio:', ratio);
    },



    //회사 클릭, 클릭해제 상태변경
    updateCompanyDispValue(company_code, isChecked) {
        // 1. 상태값 직접 가져오기
        const coveragePremiums = mmlfcp_state.get('coverage_premiums') || [];

        //2.데이터가 없으면 즉시 종료
        if (coveragePremiums.length === 0) return;

        let changed = false;

        // 3. 해당 회사의 DispValue 업데이트
        coveragePremiums.forEach(item => {
            if (item.company_code === company_code) {
                if (item.DispValue !== isChecked) {
                    item.DispValue = isChecked;
                    changed = true;
                }
            }
        });

        // 4. 실제로 데이터가 변경된 경우에만 상태 업데이트
        if (changed) {
            mmlfcp_state.set('coverage_premiums', coveragePremiums);
            //console.log(`[🏢 회사 필터 변경] ${company_code} -> ${isChecked}`);
        }
    },

    // 특정 coverage_cd 만 값/색상 업데이트 (전체 리스트 기준 min/max 적용)
    updatePremiumCell(coverage_cd, pageCompanies) {
        const plan_coverages = mmlfcp_state.get('plan_coverages') || [];
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];

        const cov = plan_coverages.find(c => c.coverage_cd == coverage_cd);
        const isSelected = cov?.plan_coverage_selected == 'checked';

        // ✅ 전체 기준 values: 모든 회사 데이터에서 base_premium 합산
        let allValues = coverage_premiums.map(product => {
            const totalPremium = product.detailList
                .filter(d => d.coverage_cd == coverage_cd)
                .reduce((sum, d) => sum + Math.floor(d.base_premium || 0), 0);

            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;
            return { code: product.company_code, base_premium: premiumValue };
        });

        // 전체 기준 min/max
        const { max: globalMax, min: globalMin } = this.getMaxMinPremium(allValues, 'base_premium');
        const flags = { maxAssigned: false, minAssigned: false };

        // ✅ 페이지 데이터만 DOM 반영 (색상은 global 기준)
        pageCompanies.forEach(product => {
            const totalPremium = product.detailList
                .filter(d => d.coverage_cd == coverage_cd)
                .reduce((sum, d) => sum + Math.floor(d.base_premium || 0), 0);

            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;
            const el = document.querySelector(`em[id="${product.company_code}_${coverage_cd}"][coverage_cd="${coverage_cd}"][company_code="${product.company_code}"]`);

            if (el) {
                this.applyPremiumStyle(el, premiumValue, globalMax, globalMin, flags);
            }
        });
    },


    //회사별 합계보험료 색상 갱신
    updateRequiredPremiumsCell(pageCompanies) {
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];

        // ✅ 전체 기준 min/max 계산
        const premiumsAll = coverage_premiums.filter(item => item.DispValue).map(item => item.total_premium);
        if (premiumsAll.length == 0) { return; } // fallback

        const maxPremium = Math.max(...premiumsAll);
        const minPremium = Math.min(...premiumsAll);

        const flags = { maxAssigned: false, minAssigned: false };

        // ✅ 페이지 데이터만 DOM 갱신 (색상은 global 기준)
        pageCompanies.forEach(item => {
            const total_id = `total_${item.company_code}`;
            const el = document.getElementById(total_id);
            if (el) {
                const total_premium = item.DispValue ? item.total_premium : 0;
                el.textContent = app.formatNumber(total_premium);
                el.setAttribute("total_premium", total_premium);
                this.applyPremiumStyle(el, total_premium, maxPremium, minPremium, flags);
            }
        });
    },

    // 기존 renderPlanCoverages를 호출하는 대신, 특정 항목만 갱신
    updatePlanCoverageItem(coverage_cd) {
        const lists = document.getElementById('bojang_lists');
        if (!lists) return;

        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const planCoverage = planCoverages.find(c => c.coverage_cd == coverage_cd);
        if (planCoverage) {
            // 해당 coverage_cd에 해당하는 항목만 갱신
            const guide_coverage_amount = planCoverage.guide_coverage_amount;
            const plan_coverage_selected = planCoverage.plan_coverage_selected == 'checked';
            const is_checked = plan_coverage_selected ? 'checked' : '';

            const displayVal = coverage_cd == 'aa00' ? '-' : app.formatNumber(guide_coverage_amount);
            const coverage_amount_val = (coverage_cd == 'aa00') ? '-' : (plan_coverage_selected ? displayVal : 0);

            const li = lists.querySelector(`#chk_${coverage_cd}`).closest('li'); // 해당 항목만 찾기
            if (li) {
                li.querySelector('.checkbox-area input').checked = is_checked;
                li.querySelector('.right input').value = coverage_amount_val;
            }
        }
    },

    updateCoverageState(coverage_cd, is_checked) {
        const selectedValue = is_checked ? 'checked' : '';

        // 1️⃣ plan_coverages 업데이트
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const targetCoverage = planCoverages.find(item => item.coverage_cd === coverage_cd);

        if (targetCoverage) {
            targetCoverage.plan_coverage_selected = selectedValue;
            mmlfcp_state.set('plan_coverages', planCoverages);
        }

        // 2️⃣ coverage_premiums(상품 리스트) 업데이트
        const coveragePremiums = mmlfcp_state.get('coverage_premiums') || [];
        if (coveragePremiums.length > 0) {
            this.updateCoverageProductList(coveragePremiums, coverage_cd, selectedValue);
            mmlfcp_state.set('coverage_premiums', coveragePremiums);
        }
    },


    updateCoverageProductList(productList, coverage_cd, selectedValue) {
        if (!Array.isArray(productList)) return;

        // 중첩 forEach 대신 조금 더 직관적인 루프 활용
        productList.forEach(product => {
            const detail = product.detailList?.find(d => d.coverage_cd === coverage_cd);
            if (detail) {
                detail.cover_selected = selectedValue;
            }
        });
    },


    // 보험료 합계 재계산 (aa00 등 동일 coverage_cd 다중 항목도 합산)
    calculatePremiums() {
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const isChanged = this.calculateTotalPremiumByList(coverage_premiums, planCoverages);

        if (isChanged) {
            mmlfcp_state.set('coverage_premiums', coverage_premiums);
        }
    },

    calculateTotalPremiumByList(productList, planCoverages) {
        if (!Array.isArray(productList) || productList.length === 0) return false;

        let totalChanged = false;

        // 1️⃣ 선택된 담보 코드 Set 생성 (Map보다 Set이 존재 여부 확인에 더 적합함)
        const selectedCoverageCodes = new Set(planCoverages.filter(cov => cov.plan_coverage_selected === 'checked').map(cov => String(cov.coverage_cd).trim()));// 공백 제거 및 문자열화

        // 2️⃣ 상품별 루프 및 보험료 합산
        productList.forEach(product => {
            // 노출되지 않는 상품은 합계를 0으로 처리 (Early Return 스타일)
            if (!product.DispValue) {
                if (product.total_premium !== 0) {
                    product.total_premium = 0;
                    totalChanged = true;
                }
                return;
            }

            // 3️⃣ 선택된 담보들의 보험료 합산 (수정 버전)
            const newTotalPremium = product.detailList.reduce((sum, detail) => {
                // 메인 화면에서 체크된 코드(Set)에 포함되어 있는지만 확인하면 됩니다.
                const isSelected = selectedCoverageCodes.has(detail.coverage_cd);
                return isSelected ? sum + Math.floor(detail.base_premium || 0) : sum;
            }, 0);


            // 4️⃣ 변경 사항이 있을 때만 반영
            if (product.total_premium !== newTotalPremium) {
                product.total_premium = newTotalPremium;
                totalChanged = true;
            }
        });
        return totalChanged;
    },


    updatePlanIdByCurrentState() {
        const plans = mmlfcp_state.getPlans();
        const plan_type = mmlfcp_state.get('plan_type_id');
        const plan_payterm_type = mmlfcp_state.get('plan_payment_expiration_cd');

        // [디버깅] 현재 찾으려는 조건 확인
        // console.log("🔍 [매칭 시도] 조건:", { plan_type, plan_payterm_type });
        // console.log("🔍 [전체 플랜 수]:", plans.length);


        const matched = plans.find(p => p.plan_type === plan_type && p.plan_payterm_type === plan_payterm_type);
        if (matched) {
            //console.log("✅ [매칭 성공] 찾은 plan_id:", matched.plan_id);
            mmlfcp_state.set('plan_id', matched.plan_id);
        }
        else {
            //console.error("❌ [매칭 실패] 일치하는 플랜을 찾을 수 없습니다.");
            mmlfcp_state.set('plan_id', ''); // 찾지 못했음을 명시적으로 저장
        }
    },


    //--------  초기 setting ---------- ///
    async onClickSearch() {

        // 1) 생년월일 및 나이 기초 데이터 확인
        const birthEl = document.getElementById('birth_date');
        const birth_date = birthEl ? birthEl.value : mmlfcp_state.get('birth_date');

        //2) 검증
        if (!app.isValidDate(birth_date)) {
            alert('생년월일을 확인해주세요.');
            return;
        }

        // ⭐ [보완] 조회 직전 최신 나이 계산 및 State 반영
        const age = app.getAgefromString(birth_date);
        mmlfcp_state.set('birth_date', birth_date);
        mmlfcp_state.set('age', age);

        // [핵심 추가] setDefaultByAge 이후, 바뀐 조건에 맞는 실제 plan_id를 매칭해야 함
        this.updatePlanIdByCurrentState();

        // 3) 최신화된 State에서 다시 값 수집
        const insurance_type = mmlfcp_state.get('insurance_type');
        const plan_id = mmlfcp_state.get('plan_id');
        const genderSel = document.getElementById('gender');
        const gender = genderSel?.value || mmlfcp_state.get('gender') || '';

        // console.log({ insurance_type, plan_id, gender });



        // 플랜 ID가 없으면 중단
        if (!plan_id) {
            alert("선택하신 조건에 맞는 플랜을 찾을 수 없습니다.");
            return;
        }

        // 4) 호출 시작
        this.setLoading(true);
        try {
            const res = await apiService.getProductPremiums({ plan_id, insurance_type, age, gender });
            if (res?.is_success == true && (res.coverage_premiums.length > 0 && res.product_insur_premiums.length > 0)) {

                mmlfcp_state.set('plan_coverages', res.plan_coverages || []);
                mmlfcp_state.set('required_premiums', res.required_premiums || []);
                mmlfcp_state.set('coverage_premiums', res.coverage_premiums || []);
                mmlfcp_state.set('product_insur_premiums', res.product_insur_premiums || []);

                mmlfcp_state.set('user_coverage', res.user_coverages.length > 0 ? res.user_coverages[0] : {});
                mmlfcp_state.set('user_coverages', res.user_coverages || []);

                // ✅ 캐시/페이지 초기화 (이 두 줄이 핵심)
                mmlfcp_state.remove && mmlfcp_state.remove('required_premiums_grouped');
                mmlfcp_state.set('required_premiums_page', 1);

                //생년월일 랜더링
                this.renderInsuAge();

                //플랜별기준보장 데이터 - 화면 왼쪽 데이터 생성
                this.setPlanCoverageList();

                //플랜  상품별 / 보장별 보험료 데이터 생성
                this.setCoverageProductList();

                //제어 데이터 생성
                this.setCoverageGuideData();

                //플랜 상품별, 보험료 상세 데이터 생성
                this.setCoverageProductDetailList();

                //보험료 상세 데이터 값 맞추기
                this.adjustProductInsurPremiums();

                // 👇 여기!
                this.saveOriginalPlanSnapshot();

                //최초에 사용자 플랜 옵션값 settig
                userController.renderUserCoverageList();

                //버튼 활성화
                this.setDetailMenu();

                //상품유형 비교 버튼 활성화
                this.setSimplifiDetailMenu();

                this.render_coverage_bojang();


                //화면보이기
                this.show_content();
            }
            else {
                alert("조회된 상품이 없습니다.");
                this.hide_content();
                return;
            }
        }
        catch (err) {
            console.error("[상품별 보험료 조회 중 오류 발생]", err);
            alert(err.message);
            return;
        }
        finally {
            this.setLoading(false);
        }
    },

    async onClickPrint() {
        this.setLoading(true);
        try {
            const printData = this.setCoveragesPrintData();
            const response = await apiService.PrintProducts(printData);

            if (response.is_success == true) {
                const printUrl = `${location.protocol}//${location.host}/${response.pdf_uri}`;
                window.open(printUrl, '_blank');
                this._closeModal();
            }

        }
        catch (err) {
            console.error("[출력 요청 중 오류 발생]", err);
            alert(err.message);
            return;
        }
        finally {
            this.setLoading(false);
            this._closeModal();
        }

    },

    async onClickUserCoverage() {
        const user_plan_name = document.getElementById('user_plan_name')?.value?.trim() || '';
        const plan_type = mmlfcp_state.get('plan_type_id');
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const consultant_id = mmlfcp_state.get('consultant_id') || '';
        const ga_id = mmlfcp_state.get('ga_id') || '';



        // 1️⃣ 검증
        if (!user_plan_name) {
            alert("플랜명을 입력해주세요.");
            return;
        }
        else if (user_plan_name.length > 20) {
            alert("플랜명은 최대 20자까지 입력 가능합니다.");
            return;
        }

        // 2️⃣ 선택된 담보만 필터링
        const details = planCoverages.filter(cov => cov.plan_coverage_selected == "checked").map(cov => ({
            coverage_cd: cov.coverage_cd,
            coverage_amount: cov.guide_coverage_amount
        }));

        if (details.length == 0) {
            alert("선택된 담보가 없습니다.");
            return;
        }

        // 3️⃣ API 요청 데이터 구성
        const add_data = {
            user_plan_id: "",  // 신규 저장 시 비워둠
            user_plan_name: user_plan_name,
            plan_type: plan_type,
            ga_id: ga_id,
            consultant_id: consultant_id,
            details: details
        };

        console.log('➡️ AddUserCoverage 요청 데이터:', add_data);

        try {
            if (confirm(`${add_data.user_plan_name} 플랜을 등록하시겠습니까?`)) {
                const res = await apiService.AddUserCoverages(add_data);
                //console.log('✅ 사용자 플랜 등록 성공:', res);
                alert("플랜저장이 완료되었습니다.");

                // 성공 후 모달 닫기 & 초기화
                document.querySelector(".modal03").style.display = "none";
                document.body.classList.remove("modal");

                //setting
                userController.setUserCoverageData(res.userCoverage);
            }


        } catch (err) {
            console.error("[사용자 플랜 등록 중 오류 발생]", err);
            alert(err.message);
            return;
        }

    },


    //이벤트 함수 실행
    bindEvents() {

        const custEl = document.getElementById('cust_name');
        const birthEl = document.getElementById('birth_date');
        const genderSel = document.getElementById('gender');
        const insurSel = document.getElementById('selInsuranceType');
        const planSel = document.getElementById('selProductsGroupCD');
        const paySel = document.getElementById('selPaymentExpirationCD');
        const searchBtn = document.getElementById('btn_search');


        const bojangList = document.getElementById('bojang_lists');
        const companyList = document.getElementById('companyInfo');
        const container = document.getElementById('priceList');
        const premiumListContainer = document.getElementById('premium_lists');
        const sortBtn = document.getElementById('sort_total_premium');

        const printBtn = document.getElementById('coverage_btn_print');
        const printDispOpen = document.getElementById('btn_print');
        const printDispClose = document.getElementById('btn_print_close');

        const detailModalBtn = document.getElementById("openDetailModalBtn");
        const detailPaymentModalBtn = document.getElementById("openPaymentModalBtn");
        const detailAgingModalBtn = document.getElementById("openAgingModalBtn");

        //무해지 및 간편보험료 비교
        const detailCoveragcemodalBtn = document.getElementById('openCoverageDetailModalBtn');

        //플랜 select 태그
        const userSelectEl = document.getElementById('user_coverages');

        //플랜설정
        const userSettingBtn = document.getElementById('btn_user_coverages_setting');
        //닫기
        const userSettingCloseBtn = document.getElementById('btn_user_cancel');
        //사용자 플랜명
        const usercoverEl = document.getElementById('user_plan_name');
        //플랜저장
        const userCoverageAddBtn = document.getElementById('btn_share_user_add');

        //사용자 플랜 랜더링
        const coverageList = document.getElementById('coverage_plans_list');

        // ✅ 공통 debounce 유틸
        const debounce = (fn, delay = 100) => {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        };

        //이름 입력
        if (custEl) {
            custEl.addEventListener("input", () => {
                const cust_name = custEl.value;
                mmlfcp_state.set('cust_name', cust_name);

                // ✅ 페이지 초기화
                this.hide_content();
                _state.current_page = 1;

            });
        }


        // 생년월일 입력 → 나이 계산/저장
        if (birthEl) {
            birthEl.addEventListener("input", () => {
                const birth_date = birthEl.value;
                if (birth_date.length === 8) {
                    const age = app.getAgefromString(birth_date);

                    //1. 데이터 업데이트
                    mmlfcp_state.set('birth_date', birth_date);
                    mmlfcp_state.set('age', age);

                    //2. 나이 기반 기본값 세팅 
                    this.setDefaultByAge(age);

                    //3. UI 렌더링 (이 과정에서 State가 유효한 값으로 최종 조정됨)
                    this.renderInsuAge();
                    this.renderPlanOptions();
                    this.renderPayTermBySelectedPlan();

                    // 4. ⭐ 모든 렌더링이 끝난 후 최종적으로 ID 업데이트
                    this.updatePlanIdByCurrentState();

                    // 5. 결과 안내 문구 출력
                    this.renderPayTermSelectedAge();

                }
                // 4) 페이지 초기화
                this.hide_content();
                _state.current_page = 1;
            });
        }


        // 성별 변경
        if (genderSel) {
            genderSel.addEventListener('change', () => {
                mmlfcp_state.set('gender', genderSel.value);

                //조회나이 랜더링
                this.renderPayTermSelectedAge();

                // ✅ 페이지 초기화
                this.hide_content();
                _state.current_page = 1;

            });
        }

        //생손보 유형 변경
        insurSel.addEventListener('change', () => {

            //생손보 유형 타입 저장
            mmlfcp_state.set('insurance_type', insurSel.value);

            // 1) 옵션을 그리면서 알아서 첫 번째꺼 선택 & State 업데이트까지 함
            this.renderPlanOptions();


            //2) 업데이트된 State(첫 번째 상품)를 기반으로 나머지 랜더링
            this.renderPayTermBySelectedPlan();
            this.updatePlanIdByCurrentState();
            this.renderPayTermSelectedAge();

            this.hide_content();
            _state.current_page = 1;
        });


        // 상품유형 변경
        if (planSel) {
            planSel.addEventListener('change', () => {
                this.handlePlanTypeChange();
            });
        }

        // 만기 변경
        if (paySel) {
            paySel.addEventListener('change', () => {

                // 1) 선택된 옵션이 있는지 안전하게 확인
                if (paySel.selectedIndex === -1) return;

                const selectedOption = paySel.selectedOptions[0];
                const payterm = paySel.value;

                // 2) State에 납기 코드와 이름 저장
                mmlfcp_state.set('plan_payment_expiration_cd', payterm);
                mmlfcp_state.set('plan_payment_expiration_name', selectedOption.textContent);

                // 3) ⭐ 공통 헬퍼 함수 호출
                this.updatePlanIdByCurrentState();

                // 4) 조회 가능 나이 안내 문구 갱신
                this.renderPayTermSelectedAge();

                // 5) 결과 화면 숨기기 및 페이지 초기화
                this.hide_content();
                _state.current_page = 1;
            });
        }


        // 조회하기 클릭
        if (searchBtn) {
            searchBtn.addEventListener("click", () => {

                //조회 전 reset
                this.resetBeforeSearch();

                this.onClickSearch();

                // ✅ 페이지 초기화
                _state.current_page = 1;
            });
        }


        //사용자 플랜명
        if (usercoverEl) {
            usercoverEl.addEventListener("input", (e) => {
                usercoverEl.removeAttribute("value");              // removeAttr("value")
                usercoverEl.setAttribute("value", e.target.value); // attr("value", ...)
                usercoverEl.value = e.target.value;                // val(...)
            });
        }

        //플랜 select 태그
        if (userSelectEl) {
            userSelectEl.addEventListener("change", (e) => {

                // ✅ 사용자 플랜 반영 실행
                userController.getUserCoverage();

                // ✅ 페이지 초기화
                _state.current_page = 1;
            });
        }


        //플랜 설정
        if (userSettingBtn) {
            userSettingBtn.addEventListener("click", () => {

                // ✅ 입력한 사용자 플랜명 초기화
                const usercoverEl = document.getElementById('user_plan_name');
                if (usercoverEl) {
                    usercoverEl.value = "";
                    usercoverEl.removeAttribute("value");
                }

                //나만의 플랜목록 창 띄우기
                document.querySelector(".modal03").style.display = "block";
                document.body.classList.add("modal");

                //사용자 플랜 리스트 랜더링
                userController.renderuserCoverageSetting();
            });
        }


        //플랜저장 클릭
        if (userCoverageAddBtn) {
            userCoverageAddBtn.addEventListener("click", () => {

                //api 실행
                this.onClickUserCoverage();

                //페이지 초기화
                _state.current_page = 1;
            });
        }

        //플랜 삭제
        if (coverageList) {
            coverageList.addEventListener('click', async (e) => {
                const btn = e.target.closest('#coverage_del'); // 버튼 ID 확인
                if (!btn) return; // 클릭한 게 버튼이 아니면 무시

                const user_plan_id = btn.getAttribute('user_plan_id');
                const user_plan_name = btn.getAttribute('user_plan_name');
                const plan_type = mmlfcp_state.get('plan_type_id');
                const ga_id = mmlfcp_state.get('ga_id') || '';
                const consultant_id = mmlfcp_state.get('consultant_id') || '';
                const planCoverages = mmlfcp_state.get('plan_coverages') || [];

                //선택된 담보만 필터링
                const details = planCoverages.filter(cov => cov.plan_coverage_selected == "checked").map(cov => ({
                    coverage_cd: cov.coverage_cd,
                    coverage_amount: cov.guide_coverage_amount
                }));

                //API 요청 데이터 구성
                const add_data = {
                    user_plan_id: user_plan_id,  // 신규 저장 시 비워둠
                    user_plan_name: user_plan_name,
                    plan_type: plan_type,
                    ga_id: ga_id,
                    consultant_id: consultant_id,
                    details: details,

                };

                //console.log('➡️ UpdateUserCoverages 요청 데이터:', add_data);

                try {
                    if (confirm(`${user_plan_name} 플랜을 삭제하시겠습니까?`)) {
                        const res = await apiService.UpdateUserCoverages(add_data);
                        // console.log('✅ 사용자 플랜 삭제 성공:', res);
                        alert(`"${user_plan_name}" 플랜이 삭제되었습니다.`);

                        // 성공 후 모달 닫기 & 초기화
                        document.querySelector(".modal03").style.display = "none";
                        document.body.classList.remove("modal");

                        //setting
                        userController.setDeleteUserCoverage(user_plan_id);
                    }

                } catch (err) {
                    console.error("[사용자 플랜 삭제 중 오류 발생]", err);
                    alert(err.message);
                    return;
                }


            });
        }


        //플랜설정 닫기
        if (userSettingCloseBtn) {
            userSettingCloseBtn.addEventListener("click", () => {
                document.querySelector(".modal03").style.display = "none";
                document.body.classList.remove("modal");
            });
        }


        //보험료 합계 정렬
        if (sortBtn) {
            sortBtn.addEventListener("click", () => {
                //1. 정렬
                this.setCoverageSortPremium();

                //1. 보장정보
                this.renderPlanCoverages();

                //2. 회사정보
                this.renderRequiredPremiums(1);

                //3. 보장별 보험료 정보
                this.renderCoveragePremiums(1);

            });
        }

        //출력하기 클릭
        if (printBtn) {
            // 출력항목 선택 초기화 & 기본값 설정
            printBtn.addEventListener("click", () => {

                const coverage_cd_checked = this.checked_coverage_cd();
                const company_code_checked = this.checked_company_code();

                if (!coverage_cd_checked) {
                    alert("보장항목을 1개 이상 선택해주세요");
                    return;
                }
                if (!company_code_checked) {
                    alert('회사를 1개 이상 선택해주세요.');
                    return;
                }

                const title01 = document.getElementById("title01");
                if (title01) title01.checked = true;

                // modal01 표시 (fade 효과 제거 → 깔끔하게 block만)
                const modal = document.querySelector(".modal01");
                if (modal) {
                    modal.style.display = "block";
                }

                //가입으로 강제 "설정"
                this.setDefaultAssginFilter();

                //최초 가입상태로 setting
                this.setPlanCoverage_Display("assign");

                // 보험료 최대, 최소값, 보험료 합계 정렬
                this.setCoverageSortPremium();

                //li 태그 활성화-비활성화
                this.setPrintliMenu();

                //1. 보장정보
                this.renderPlanCoverages();

                //2. 회사정보
                this.renderRequiredPremiums(1);

                //3. 보장별 보험료 정보
                this.renderCoveragePremiums(1);

                // body에 modal 클래스 추가
                document.body.classList.add("modal");

            });
        }

        //출력하기 화면에서 출력하기 클릭
        if (printDispOpen) {
            printDispOpen.addEventListener("click", () => {
                this.onClickPrint();
            });
        }


        //출력하기 화면에서 취소 클릭
        if (printDispClose) {
            printDispClose.addEventListener("click", () => {
                this._closeModal();
            });
        }

        //보험료 최저 vs 최대
        if (detailModalBtn) {
            detailModalBtn.addEventListener("click", () => {
                const coverage_cd_checked = this.checked_coverage_cd();
                const company_code_checked = this.checked_company_code();
                if (!coverage_cd_checked) {
                    alert("보장을 1개 이상 선택해주세요.");
                    return;
                }

                if (!company_code_checked) {
                    alert('회사를 1개 이상 선택해주세요.');
                    return;
                }
                else {
                    this._setlocalItem();
                    this.openDetailModal('premium');

                }
            });
        }

        //만기별 보험료 비교
        if (detailPaymentModalBtn) {
            detailPaymentModalBtn.addEventListener("click", () => {
                const coverage_cd_checked = this.checked_coverage_cd();
                const company_code_checked = this.checked_company_code();
                if (!coverage_cd_checked) {
                    alert("보장을 1개 이상 선택해주세요.");
                    return;
                }

                if (!company_code_checked) {
                    alert('회사를 1개 이상 선택해주세요.');
                    return;
                }
                else {
                    this._setlocalItem();
                    this.openDetailModal('payment');
                }
            });
        }

        //연령별 보험료 비교
        if (detailAgingModalBtn) {
            detailAgingModalBtn.addEventListener("click", () => {
                const coverage_cd_checked = this.checked_coverage_cd();
                const company_code_checked = this.checked_company_code();
                if (!coverage_cd_checked) {
                    alert("보장을 1개 이상 선택해주세요.");
                    return;
                }

                if (!company_code_checked) {
                    alert('회사를 1개 이상 선택해주세요.');
                    return;
                }
                else {
                    this._setlocalItem();
                    this.openDetailModal('aging');
                }
            });
        }

        //상품유형별 보험료
        if (detailCoveragcemodalBtn) {
            detailCoveragcemodalBtn.addEventListener("click", () => {
                const coverage_cd_checked = this.checked_coverage_cd();
                const company_code_checked = this.checked_company_code();

                if (!coverage_cd_checked) {
                    alert("보장을 1개 이상 선택해주세요.");
                    return;
                }
                if (!company_code_checked) {
                    alert('회사를 1개 이상 선택해주세요.');
                    return;
                }
                else {
                    mmlfcp_state.set('coverage_cd_checked', coverage_cd_checked);
                    mmlfcp_state.set('company_code_checked', company_code_checked);
                    this._setlocalItem();
                    this.openPlanDetailModalBtn();
                }
            });
        }


        if (bojangList) {
            //플랜별 기준보장 click 이벤트
            bojangList.addEventListener('click', (e) => {
                const cb = e.target.closest('input[type="checkbox"][id^="chk_"]');
                if (cb) {
                    const coverage_cd = cb.dataset.cd;
                    const input = document.getElementById(`input_${coverage_cd}`);
                    if (!input) return;

                    // 1. 보장별 상태 업데이트
                    this.updateCoverageState(coverage_cd, cb.checked);

                    //2. 보험료 합계 갱신
                    this.calculatePremiums();

                    // 3. 국소 업데이트 (입력창에만 반영) - 한 프레임에 몰아서
                    requestAnimationFrame(() => {
                        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
                        const currentPage = _state.current_page || 1;
                        const start = (currentPage - 1) * 10;
                        const pageCompanies = coverage_premiums.slice(start, start + 10);

                        // ✅ 해당 담보만 보장별 보험료 갱신
                        this.updatePremiumCell(coverage_cd, pageCompanies);

                        // ✅ 회사별 합계보험료만 갱신
                        this.updateRequiredPremiumsCell(pageCompanies);

                        // ✅ 플랜기준보장 특정 coverage_cd 만 갱신
                        this.updatePlanCoverageItem(coverage_cd);

                    }, 100);
                }
            });

            //플랜별 기준보장 input 이벤트
            bojangList.addEventListener("input", debounce((e) => {
                const target = e.target.closest('input[type="text"][id^="input_"]');
                if (!target) return;
                const coverage_cd = target.dataset.cd;
                const rawValue = target.value.replace(/,/g, '');
                let change_coverage_amount = Number(rawValue);

                // 숫자가 아니면 안전하게 0으로 처리
                if (isNaN(change_coverage_amount)) {
                    change_coverage_amount = 0;
                }

                // 1) 상태 업데이트
                this.updatePlanCoverageAmount(coverage_cd, change_coverage_amount);
                this.updateCoveragePremiums(coverage_cd, change_coverage_amount);
                this.calculatePremiums(); // 보험료 합계 갱신

                // 2) 국소 업데이트만 실행 → 한 프레임에 몰아서
                requestAnimationFrame(() => {
                    const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
                    const currentPage = _state.current_page || 1;
                    const start = (currentPage - 1) * 10;
                    const pageCompanies = coverage_premiums.slice(start, start + 10);

                    // ✅ 해당 담보만 보장별 보험료 갱신
                    this.updatePremiumCell(coverage_cd, pageCompanies);

                    // ✅ 회사별 합계보험료만 갱신
                    this.updateRequiredPremiumsCell(pageCompanies);

                });
            }, 100));
        }

        if (companyList) {
            companyList.addEventListener('change', (e) => {
                const cb = e.target.closest('input[type="checkbox"][id^="chk_"]');
                if (!cb) return;
                const company_code = cb.getAttribute("company_code"); // DB, HA, LABL

                // 1) 상태 업데이트
                this.updateCompanyDispValue(company_code, cb.checked);

                // 2) 보험료 합계 갱신
                this.calculatePremiums();

                // ✅ 정렬 수행 (합계 0인 회사는 뒤로 보내기 포함)
                this.setCoverageSortPremium();

                // 4) 전체 갱신 (회사별/보장별 동시에 다시 그림)
                requestAnimationFrame(() => {
                    const currentPage = _state.current_page || 1;

                    // 회사별 합계보험료 다시 랜더링
                    this.renderRequiredPremiums(currentPage);

                    // 보장별 보험료 다시 랜더링
                    this.renderCoveragePremiums(currentPage);
                });
            });
        }

        // 🔹 <em> 클릭 이벤트 (이벤트 위임)
        if (premiumListContainer) {
            premiumListContainer.addEventListener("click", (e) => {
                const em = e.target.closest('em[company_code]');
                if (!em) return;
                const company_code = em.getAttribute('company_code');
                const coverage_cd = em.getAttribute('coverage_cd') || em.id.slice(2);
                const premium = em.textContent;
                if (premium == 0) return;

                this.show_layer();
                this.renderInsurPremiumsDetail(company_code, coverage_cd, _state.current_page || 1);
            });
        }


        // ✅ 모두보기 / 가입 / 미가입 체크박스 (1개만 선택되도록 강제)
        const filterBoxes = document.querySelectorAll('#coverageFilters input[type="checkbox"]');
        filterBoxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    // 1️⃣ 다른 체크박스 해제
                    filterBoxes.forEach(other => {
                        if (other != e.target) other.checked = false;
                    });

                    // 2️⃣ 상태 갱신
                    this.setPlanCoverage_Display(e.target.id);
                    this.setCoverageSortPremium();
                } else {
                    // ✅ 최소 1개는 항상 선택되도록 → "전체" 기본값
                    const allBox = document.getElementById("all");
                    if (allBox) allBox.checked = true;

                    this.setPlanCoverage_Display("all");
                    this.setCoverageSortPremium();
                }

                // ✅ 페이지 초기화
                _state.current_page = 1;


                // 3️⃣ 렌더링 (공통 처리)
                requestAnimationFrame(() => {
                    this.renderPlanCoverages();
                    this.renderRequiredPremiums(_state.current_page || 1);
                    this.renderCoveragePremiums(_state.current_page || 1);
                });
            });
        });


        // ✅ '전체선택' 체크박스 이벤트
        const chkAll = document.getElementById('all_checked');
        if (chkAll) {
            chkAll.addEventListener('change', (e) => {
                let checked_val = e.target.checked ? 'checked' : '';
                // 각각 자기 책임 + 필터 보정까지 포함
                this.setPlanCoverage_Display_all(checked_val);
                this.calculatePremiums(); //보험료 합계 갱신

                requestAnimationFrame(() => {
                    this.renderPlanCoverages();
                    this.renderRequiredPremiums(_state.current_page || 1);
                    this.renderCoveragePremiums(_state.current_page || 1);
                });
            });
        }



        //닫기 버튼 클릭 이벤트
        container.addEventListener("click", (e) => {
            const closeBtn = e.target.closest('.btn-priceList-cancel');
            if (closeBtn) {
                const modal = document.querySelector('.modal02');
                const bottomContent = document.querySelector(".bottom-content .bottom");
                if (!modal) {
                    console.warn("modal02 요소가 아직 없습니다.");
                    return;
                }
                modal.style.display = 'none';
                if (bottomContent) bottomContent.style.display = "block";
                document.body.classList.remove('modal');
            }
        });

        // --- modal02, modal03 배경 클릭 → 닫기 (이벤트 위임) ---
        document.addEventListener("click", (e) => {
            const bgEl = e.target.closest('.modal02 .bg, .modal03 .bg');
            if (!bgEl) return;

            const contentList = bgEl.querySelector('.content_list');
            const content = bgEl.querySelector('.content');
            if ((contentList && contentList.contains(e.target)) || (content && content.contains(e.target))) {
                return;
            }

            const modal = bgEl.closest('.modal02, .modal03');
            if (modal) modal.style.display = 'none';

            const bottomContent = document.querySelector('.bottom-content .bottom');
            if (bottomContent) bottomContent.style.display = 'block';
            document.body.classList.remove('modal');
        });
    },

    //보장 선택 항목 체크
    checked_coverage_cd() {
        const plan_coverages = mmlfcp_state.get('plan_coverages') || [];
        let is_coverage_cd_checked = '';

        plan_coverages.forEach(coverages => {
            if (coverages.plan_coverage_selected === 'checked') {
                is_coverage_cd_checked += coverages.coverage_cd + ",";
            }
        });
        return is_coverage_cd_checked;
    },

    //회사 선택 항목 체크
    checked_company_code() {
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        let is_company_code = '';

        coverage_premiums.forEach(product => {
            if (product.DispValue) {
                is_company_code += product.company_code + ",";
            }
        });
        return is_company_code;
    },



    // 페이지 버튼 생성 + 스타일링
    bindSharedPager(totalPages, currentPage = 1) {

        const container = document.getElementById('div-page-btn');
        if (!container) return;

        container.innerHTML = ''; // 버튼 초기화

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'page-btn';
            btn.dataset.page = i;
            btn.textContent = i;

            // ✅ 현재 페이지 스타일 강조
            this.setPageButtonStyle(btn, i == currentPage);

            // ✅ 클릭 이벤트 → changePage 호출
            btn.addEventListener("click", () => this.changePage(i));

            container.appendChild(btn);
        }
    },

    //페이지 변경
    changePage(pageNum) {
        // ✅ 현재 페이지 저장
        _state.current_page = pageNum;

        // ✅ 페이지 버튼 갱신 (여기서 스타일 포함됨)
        const totalPages = Math.ceil((mmlfcp_state.get('coverage_premiums').length || 0) / 10) || 1;
        this.bindSharedPager(totalPages, pageNum);

        // ✅ 해당 페이지 렌더링
        this.renderRequiredPremiums(pageNum);
        this.renderCoveragePremiums(pageNum);

    },


    //로딩바
    setLoading(on) {
        const $loader = document.querySelector('.loader-container');
        if ($loader) $loader.style.display = on ? 'flex' : 'none';
    },

    /**
    * 버튼 스타일 적용 (선택 여부에 따라)
    */
    setPageButtonStyle(btn, isActive) {
        btn.style.cssText = `
        height: 30px; width: 30px; border: none;
        border - radius: 3px; font - size: 11px; cursor: pointer;
        background - color: ${isActive ? '#2b579a' : '#f0f0f0'};
        color: ${isActive ? '#fff' : '#333'};
        `;
    },


    /**
      * 특정 셀에 보험료 숫자 + 색상 적용 (공용)
      */
    applyPremiumStyle(el, premium, maxVal, minVal, flags) {

        // 클래스 초기화
        el.classList.remove('company__red', 'company__blue', 'company__black');

        // 보험료 포맷팅
        const formattedPremium = app.formatNumber(premium);
        el.textContent = formattedPremium;


        // premium이 0일 경우 black 색상 적용
        if (premium == 0) {
            el.classList.add('company__black');
            return;
        }

        // 최대/최소값 처리
        if (premium == maxVal && !flags.maxAssigned) {
            el.classList.add('company__red');
            flags.maxAssigned = true;
        } else if (premium == minVal && !flags.minAssigned) {
            el.classList.add('company__blue');
            flags.minAssigned = true;
        } else {
            el.classList.add('company__black');
        }
    },



    show_layer() {
        this.wrapWindowByMask();
        const modal = document.querySelector('.modal02');
        const contentList = document.querySelector('.content_list');
        if (!modal || !contentList) return;

        modal.style.display = 'block';
        modal.style.opacity = '1';

        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const scrollTop = window.scrollY;
        const scrollLeft = window.scrollX;

        contentList.style.position = 'absolute';
        contentList.style.top = `${Math.max(0, ((windowHeight - contentList.offsetHeight) / 2) + scrollTop - 100)}px`;
        contentList.style.left = `${Math.max(0, ((windowWidth - contentList.offsetWidth) / 2) + scrollLeft)}px`;
        contentList.style.display = 'block';

        document.body.classList.add('modal');

    },

    wrapWindowByMask() {
        const mask = document.querySelector('.modal02');
        if (!mask) return;

        const maskHeight = document.documentElement.scrollHeight;
        const maskWidth = window.innerWidth;

        mask.style.width = `${maskWidth}px`;
        mask.style.height = `${maskHeight}px`;
    },

    show_content() {
        // .bottom-content 보이기
        const bottomContent = document.querySelector('.bottom-content');
        if (bottomContent) {
            bottomContent.style.display = "block";
        }

        // #mainContent 보이기
        const mainContent = document.getElementById("mainContent");
        if (mainContent) {
            mainContent.style.display = "block";
        }
    },


    hide_content() {
        // .bottom-content 숨기기
        const bottomContent = document.querySelector('.bottom-content');
        if (bottomContent) {
            bottomContent.style.display = "none";
        }

        // #mainContent 숨기기
        const mainContent = document.getElementById("mainContent");
        if (mainContent) {
            mainContent.style.display = "none";
        }
    },



    /**
     * * 최대·최소 보험료 계산 (담보 셀 & 합계 셀 공통)
     * */
    getMaxMinPremium(values, key = 'base_premium') {
        if (!values.length) return { max: 0, min: 0 };
        const filtered = values.map(v => Number(v[key]) || 0).filter(v => v > 0); // 0 제외
        if (!filtered.length) return { max: 0, min: 0 };
        return {
            max: Math.max(...filtered),
            min: Math.min(...filtered)
        };
    },




    // 공용 오픈 함수 (tab 파라미터 추가) (detail.html 호출)
    openDetailModal(tabName = 'premium') {
        const modal = document.getElementById("detailmodal");
        const iframe = document.getElementById("detail_modal_iframe");
        const url = `${location.protocol}//${location.host}/detail.html?token=${appConstants.jwt}&tab=${tabName}`;

        this._showModal(modal, iframe, url);
    },

    //상품유형별 보험료 비교 열기 (detail_c.html 호출)
    openPlanDetailModalBtn() {
        const modal = document.getElementById("detailmodal"); // 통합된 ID 사용
        const iframe = document.getElementById("detail_modal_iframe");
        const url = `${location.protocol}//${location.host}/detail_c.html?token=${appConstants.jwt}`;
        this._showModal(modal, iframe, url);
    },


    _setlocalItem() {

        localStorage.clear();

        // ✅ 필요한 key만 갱신
        localStorage.setItem('cust_name', mmlfcp_state.get('cust_name'));
        localStorage.setItem('birth_date', mmlfcp_state.get('birth_date'));
        localStorage.setItem('age', mmlfcp_state.get('age'));
        localStorage.setItem('gender', mmlfcp_state.get('gender'));

        //생손보유형
        localStorage.setItem("insurance_type", mmlfcp_state.get('insurance_type'));

        //상품유형
        localStorage.setItem('plan_id', mmlfcp_state.get('plan_id'));
        localStorage.setItem('plan_type_id', mmlfcp_state.get('plan_type_id'));
        localStorage.setItem('plan_type_name', mmlfcp_state.get('plan_type_name'));

        //만기
        localStorage.setItem('plan_payment_expiration_cd', mmlfcp_state.get('plan_payment_expiration_cd'));
        localStorage.setItem('plan_payment_expiration_name', mmlfcp_state.get('plan_payment_expiration_name'));

        //리스트
        localStorage.setItem("plan_coverages", JSON.stringify(mmlfcp_state.get('plan_coverages') || []));
        localStorage.setItem("coverage_premiums", JSON.stringify(mmlfcp_state.get('coverage_premiums') || []));
        localStorage.setItem("product_insur_premiums", JSON.stringify(mmlfcp_state.get('product_insur_premiums') || []));
        localStorage.setItem("coverage_ratio_map", JSON.stringify(mmlfcp_state.get('coverage_ratio_map') || {}));

        //체크한 coverage_cd, company_code
        localStorage.setItem("coverage_cd_checked", JSON.stringify(mmlfcp_state.get('coverage_cd_checked') || {}));
        localStorage.setItem("company_code_checked", JSON.stringify(mmlfcp_state.get('company_code_checked') || {}));
    },


    //내부에서만 쓰는 실제 실행 함수 (중복 로직 제거)
    _showModal(modal, iframe, url) {
        if (iframe) {
            iframe.removeAttribute("src");
            iframe.setAttribute("src", url);
        }
        if (modal) {
            modal.style.display = "block";
            // 뒤로가기 처리를 위한 히스토리 추가
            history.pushState({ modal: "open" }, null, "");
        }
    },

    _closeModal() {
        // #modal-layout 보이기
        const modalLayout = document.getElementById("modal-layout");
        if (modalLayout) modalLayout.style.display = "block";

        // .bottom-content .top 보이기
        const topEl = document.querySelector(".bottom-content .top-section");
        if (topEl) topEl.style.display = "block";

        // .bottom-content .bottom 보이기
        const bottomEl = document.querySelector(".bottom-content .bottom-section");
        if (bottomEl) bottomEl.style.display = "block";

        // .modal01 닫기 (opacity 효과 없이 단순히 닫기)
        const modal = document.querySelector(".modal01");
        if (modal) {
            modal.style.display = "none";
        }
        // body에서 modal 클래스 제거
        document.body.classList.remove("modal");
    },

    _toggleMenu(id, isShow) {
        const el = document.getElementById(id);
        if (!el) return;

        if (isShow) {
            el.style.display = ""; // 공간 차지
            // 아주 짧은 지연시간 뒤에 투명도를 올려 부드럽게 나타나게 함
            setTimeout(() => {
                el.style.opacity = "1";
            }, 10);
        } else {
            el.style.opacity = "0";
            el.style.display = "none"; // 공간 제거
        }
    }

}
