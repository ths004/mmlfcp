import { mmlfcp_state, _state, deepCopy } from '../core/state.js';
import { apiService } from '../services/apiService.js';
import { app } from '../utils/app.js?v=26.08.26.26';
import { appConstants } from '../constants/constants.js';
import { userController } from './userController.js?v=26.08.26.25';
import { excelController } from './excelcontroller.js';
import { compareView } from '../utils/compareView.js';


export const Controller = {
    /**
    * 초기 실행 함수
    */
    init() {
        if (!this.ensurePlans()) return;

        this.ensurePlansType();

        // 1. 기초 데이터 동기화 (기존 데이터나 input의 생년월일로부터 나이 계산 포함)
        this.syncStateAndUI();

        // GA별 생손보 유형 제한 (A266 → 손보만)
        this.applyGaInsuranceTypeRestriction();

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

    //생손보 ,손보일때마다 type 정해주기
    ensurePlansType() {
        const url_path = mmlfcp_state.get('url_path');
        // GA A266: 손보 전용 (path와 무관)
        if (this.isFireOnlyGa()) {
            _state.plan_id = "000000111041";
            _state.plan_type_id = "06";
            _state.plan_type_name = "손보 종합(무해지)";
            _state.plan_payment_expiration_cd = "01";
            _state.plan_payment_expiration_name = "20년/100세";
            _state.insurance_type = "F";
            return;
        }

        //lifefire -> 생손보일때
        if (url_path === 'lifefire') {
            _state.plan_id = "921081111041";
            _state.plan_type_id = "01";
            _state.plan_type_name = "생손보 건강(무해지)";
            _state.plan_payment_expiration_cd = "06";
            _state.plan_payment_expiration_name = "20년/100세,종신";
            _state.insurance_type = "LF";


        }
        //fire- > 손보일때
        else if (url_path === 'fire') {
            _state.plan_id = "000000111041";
            _state.plan_type_id = "06";
            _state.plan_type_name = "손보 종합(무해지)";
            _state.plan_payment_expiration_cd = "01";
            _state.plan_payment_expiration_name = "20년/100세";
            _state.insurance_type = "F";
        }
    },

    /** GA 코드가 손보 전용인지 (A266) */
    isFireOnlyGa() {
        return String(mmlfcp_state.get('ga_id') || '').trim().toUpperCase() === 'A266';
    },

    /**
     * GA A266: 생손보 유형 셀렉트에 손보(F)만 표시하고 강제 적용
     * @returns {boolean} 제한이 적용되었으면 true
     */
    applyGaInsuranceTypeRestriction() {
        if (!this.isFireOnlyGa()) return false;

        const insurSel = document.getElementById('selInsuranceType');
        if (insurSel) {
            Array.from(insurSel.options).forEach((opt) => {
                if (opt.value !== 'F') opt.remove();
            });
            if (![...insurSel.options].some((o) => o.value === 'F')) {
                const opt = document.createElement('option');
                opt.value = 'F';
                opt.textContent = '손보';
                insurSel.appendChild(opt);
            }
            insurSel.value = 'F';
            insurSel.disabled = true;
            insurSel.title = '해당 GA는 손보만 조회할 수 있습니다.';
            const insuranceTrigger = document.getElementById('insurancePickerTrigger');
            if (insuranceTrigger) {
                insuranceTrigger.disabled = true;
                insuranceTrigger.title = insurSel.title;
            }
            this.syncHeaderSelectPicker('insurance');
        }

        mmlfcp_state.set('insurance_type', 'F');
        // 손보 기본 상품/만기가 아니면 손보 기본으로 맞춤
        if (mmlfcp_state.get('insurance_type') === 'F') {
            const planType = mmlfcp_state.get('plan_type_id') || '';
            // 생손보/생보 플랜 코드가 남아 있으면 손보 종합(무해지)로 교체
            if (!planType || ['01', '02', '03', '04', '33', '34'].includes(planType)) {
                mmlfcp_state.set('plan_type_id', _state.plan_type_id || '06');
                mmlfcp_state.set('plan_type_name', _state.plan_type_name || '손보 종합(무해지)');
                mmlfcp_state.set('plan_payment_expiration_cd', _state.plan_payment_expiration_cd || '01');
                mmlfcp_state.set('plan_payment_expiration_name', _state.plan_payment_expiration_name || '20년/100세');
                mmlfcp_state.set('plan_id', _state.plan_id || '');
            }
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

        const BOX_SEL = '.alert__product-info, .alert__product_info';

        const restoreProductInfoHome = (box) => {
            if (!box) return;
            const homeId = box.dataset.homeParentId;
            const home = homeId ? document.getElementById(homeId) : null;
            box.classList.remove('show');
            box.style.top = '';
            box.style.left = '';
            box.style.visibility = '';
            box.style.removeProperty('display');
            box.removeAttribute('data-anchor-btn');
            delete box.dataset.homeParentId;

            // 원본 부모가 있으면 복귀, 없으면(재렌더 후 orphan) 제거
            if (home && document.contains(home)) {
                if (box.parentElement !== home) home.appendChild(box);
            } else if (box.parentElement === document.body) {
                box.remove();
            }
        };

        const closeAllProductInfo = (except = null) => {
            document.querySelectorAll(`${BOX_SEL}.show`).forEach((el) => {
                if (except && el === except) return;
                restoreProductInfoHome(el);
            });
            // body에 남은 비정상 orphan 정리
            document.querySelectorAll(`body > ${BOX_SEL}`).forEach((el) => {
                if (except && el === except) return;
                if (!el.classList.contains('show')) {
                    const homeId = el.dataset.homeParentId;
                    const home = homeId ? document.getElementById(homeId) : null;
                    if (!home || !document.contains(home)) el.remove();
                }
            });
        };

        const placeProductInfoBelow = (box, anchorBtn) => {
            if (!box || !anchorBtn || !document.contains(anchorBtn)) return;

            // Escape sticky stacking contexts (toolbar z-index) by mounting on body
            const home = anchorBtn.parentElement;
            if (home && !home.id) {
                home.id = `product_info_home_${anchorBtn.id || Math.random().toString(36).slice(2, 8)}`;
            }
            if (home) box.dataset.homeParentId = home.id;
            box.dataset.anchorBtn = anchorBtn.id || '';
            if (box.parentElement !== document.body) {
                document.body.appendChild(box);
            }

            box.classList.add('show');
            box.style.visibility = 'hidden';

            // Chrome: html zoom 과 fixed top/left 좌표계 불일치 보정
            const placed = app.placeFixedBelowAnchor(box, anchorBtn, { gap: 6 });
            if (!placed) {
                restoreProductInfoHome(box);
                return;
            }

            box.style.visibility = '';
        };

        area.addEventListener('click', (e) => {
            const openBtn = e.target.closest('.btn__product-info');
            if (!openBtn) return;

            e.stopPropagation();
            let box = openBtn.parentElement.querySelector(BOX_SEL);
            // already moved to body from a previous open
            if (!box && openBtn.id) {
                box = document.querySelector(`body > ${BOX_SEL}[data-anchor-btn="${openBtn.id}"]`);
            }
            if (!box) return;

            const willOpen = !box.classList.contains('show');
            closeAllProductInfo(willOpen ? box : null);
            if (willOpen) {
                placeProductInfoBelow(box, openBtn);
            } else {
                restoreProductInfoHome(box);
            }
        });

        // body로 옮겨진 팝오버의 닫기/바깥클릭 처리
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.btn-close__alert');
            if (closeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const box = closeBtn.closest(BOX_SEL);
                if (box) restoreProductInfoHome(box);
                return;
            }
            if (e.target.closest(BOX_SEL) || e.target.closest('.btn__product-info')) return;
            closeAllProductInfo();
        });

        // 리사이즈/스크롤 시에는 재배치하지 않고 닫기
        // (재배치 시 앵커 유실 → 다른 버튼에 붙어 잘못 보이는 오류 방지)
        const onViewportChange = () => closeAllProductInfo();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('orientationchange', onViewportChange);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onViewportChange);
            window.visualViewport.addEventListener('scroll', onViewportChange);
        }
        area.addEventListener('scroll', onViewportChange, true);
        document.addEventListener('scroll', onViewportChange, true);

        mmlfcp_state.set('companyInfoEventsBound', true);
    },

    /** body에 남은 상품정보 팝오버 전부 제거 */
    cleanupOrphanProductInfo() {
        document.querySelectorAll('body > .alert__product-info, body > .alert__product_info').forEach((el) => {
            el.classList.remove('show');
            el.remove();
        });
        document.querySelectorAll('#companyInfo .alert__product-info.show, #companyInfo .alert__product_info.show').forEach((el) => {
            el.classList.remove('show');
            el.style.top = '';
            el.style.left = '';
            el.style.visibility = '';
        });
    },

    /**
     * 상단 보험사 헤더(#companyInfo) ↔ 하단 보험료 목록(.table-area) 가로 스크롤 동기화
     */
    ensureCompanyTableScrollSync() {
        if (mmlfcp_state.get('companyTableScrollSyncBound')) return;
        const company = document.getElementById('companyInfo');
        const table = document.querySelector('.product-table-wrap .table-area');
        if (!company || !table) return;

        let locking = false;
        const syncFrom = (source, target) => {
            if (locking) return;
            if (target.scrollLeft === source.scrollLeft) return;
            locking = true;
            target.scrollLeft = source.scrollLeft;
            locking = false;
        };

        table.addEventListener('scroll', () => syncFrom(table, company), { passive: true });
        company.addEventListener('scroll', () => syncFrom(company, table), { passive: true });

        // 헤더 위에서 가로 휠/트랙패드 → 하단 목록과 함께 이동
        company.addEventListener('wheel', (e) => {
            const absX = Math.abs(e.deltaX);
            const absY = Math.abs(e.deltaY);
            if (absX <= absY && !(e.shiftKey && absY > 0)) return;
            const delta = absX > absY ? e.deltaX : e.deltaY;
            if (!delta) return;
            e.preventDefault();
            table.scrollLeft += delta;
            company.scrollLeft = table.scrollLeft;
        }, { passive: false });

        window.addEventListener('resize', () => {
            requestAnimationFrame(() => {
                company.scrollLeft = table.scrollLeft;
            });
        });

        mmlfcp_state.set('companyTableScrollSyncBound', true);
    },

    /** 렌더 후 가로 스크롤 위치 맞춤 (reset=true면 맨 앞으로) */
    syncCompanyTableScroll(reset = false) {
        const company = document.getElementById('companyInfo');
        const table = document.querySelector('.product-table-wrap .table-area');
        if (!company || !table) return;
        if (reset) {
            company.scrollLeft = 0;
            table.scrollLeft = 0;
            return;
        }
        company.scrollLeft = table.scrollLeft;
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


    //모두보기 상태로 최초 setting
    setDefaultAllFilter() {
        const allChk = document.getElementById("all");
        const assignChk = document.getElementById("assign");
        const notAssignChk = document.getElementById("not-assign");
        const bulkSelect = document.getElementById("coverage_bulk_select");

        if (allChk) {
            allChk.checked = true;
            if (assignChk) assignChk.checked = false;
            if (notAssignChk) notAssignChk.checked = false;
            if (bulkSelect) bulkSelect.value = "";
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

    sortCoverageProductList(productList, checkedId, direction = 'asc') {

        if (!Array.isArray(productList)) return false;

        // 🔥 기존 순서 복사 (변경 여부 비교용)
        const originalOrder = productList.map(p => p.company_code);
        const dir = direction === 'desc' ? -1 : 1;

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

            // 3️⃣ 표시된 것끼리는 보험료 합계 정렬 (오름/내림)
            return (aTotal - bTotal) * dir;
        });

        // 🔥 실제 순서 변경 여부 체크
        for (let i = 0; i < productList.length; i++) {
            if (productList[i].company_code !== originalOrder[i]) {
                return true;
            }
        }
        return false;
    },

    //정렬 (클릭 시 오름차순 ↔ 내림차순 토글)
    _premiumSortDirection: 'asc',

    setCoverageSortPremium({ toggle = false } = {}) {
        // 1. 기준이 될 체크된 보험사 ID 가져오기
        const checkedId = document.querySelector("input[type=checkbox][name='checked_list']:checked")?.id;

        // 2. 상태값 가져오기
        const coveragePremiums = mmlfcp_state.get('coverage_premiums') || [];

        // 3. 데이터가 없으면 실행 중단
        if (coveragePremiums.length === 0) return;

        // 4. 툴바 정렬 버튼: 토글 / 그 외(출력 등): 현재 방향 유지(기본 오름차순)
        if (toggle) {
            this._premiumSortDirection = this._premiumSortDirection === 'asc' ? 'desc' : 'asc';
        } else if (!this._premiumSortDirection) {
            this._premiumSortDirection = 'asc';
        }

        const direction = this._premiumSortDirection;

        // 5. 정렬 실행
        this.sortCoverageProductList(coveragePremiums, checkedId, direction);

        // 6. 항상 상태 반영 (이미 같은 방향이어도 렌더와 동기화)
        mmlfcp_state.set('coverage_premiums', coveragePremiums);

        // 7. 버튼 라벨에 정렬 방향 표시
        const sortBtn = document.getElementById('sort_total_premium');
        if (sortBtn) {
            const arrow = direction === 'asc' ? '↑' : '↓';
            sortBtn.setAttribute('data-sort-dir', direction);
            sortBtn.setAttribute('aria-label', `보험료 합계 정렬 (${direction === 'asc' ? '낮은순' : '높은순'})`);
            const label = sortBtn.querySelector('.toolbar-sort-label') || sortBtn;
            // 버튼 텍스트 노드만 갱신 (아이콘 img 유지)
            const textNode = Array.from(sortBtn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (textNode) {
                textNode.textContent = ` 보험료 합계 정렬 ${arrow} `;
            } else if (!sortBtn.querySelector('img')) {
                sortBtn.textContent = `보험료 합계 정렬 ${arrow}`;
            } else {
                // img + 텍스트 혼합: 마지막 텍스트 보강
                let found = false;
                sortBtn.childNodes.forEach((n) => {
                    if (n.nodeType === Node.TEXT_NODE && n.textContent.includes('보험료')) {
                        n.textContent = ` 보험료 합계 정렬 ${arrow} `;
                        found = true;
                    }
                });
                if (!found) sortBtn.append(` ${arrow}`);
            }
        }
    },

    //원본 리스트 따로 저장
    saveOriginalPlanSnapshot() {

        const snapshot = {
            plan_coverages: deepCopy(mmlfcp_state.get('plan_coverages') || []),
            required_premiums: deepCopy(mmlfcp_state.get('required_premiums') || []),
            coverage_premiums: deepCopy(mmlfcp_state.get('coverage_premiums') || []),
            product_insur_premiums: deepCopy(mmlfcp_state.get('product_insur_premiums') || []),
        };
        mmlfcp_state.set('default_plan_snapshot', snapshot);

        // const snapshot = {
        //     plan_coverages: structuredClone(mmlfcp_state.get('plan_coverages') || []),
        //     required_premiums: structuredClone(mmlfcp_state.get('required_premiums') || []),
        //     coverage_premiums: structuredClone(mmlfcp_state.get('coverage_premiums') || []),
        //     product_insur_premiums: structuredClone(mmlfcp_state.get('product_insur_premiums') || []),
        // };
        //mmlfcp_state.set('default_plan_snapshot', snapshot);
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


    //전체선택 / 전체해제 setting
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

    //조회 시점(또는 is_selected_coverage) 초기 선택값으로 복원
    setPlanCoverage_Display_default() {
        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const snapshot = mmlfcp_state.get('default_plan_snapshot') || {};
        const snapCoverages = Array.isArray(snapshot.plan_coverages) ? snapshot.plan_coverages : [];
        const snapSelectedMap = new Map(
            snapCoverages.map(cov => [String(cov.coverage_cd), cov.plan_coverage_selected === 'checked'])
        );

        planCoverages.forEach(cov => {
            const key = String(cov.coverage_cd);
            let selected;
            if (snapSelectedMap.has(key)) {
                selected = snapSelectedMap.get(key);
            } else if (cov.coverage_cd === 'aa00') {
                selected = true;
            } else {
                selected = cov.is_selected_coverage === 'Y';
            }
            cov.plan_coverage_selected = selected ? 'checked' : '';
        });

        coverage_premiums.forEach(product => {
            if (!Array.isArray(product.detailList)) return;
            product.detailList.forEach(detail => {
                const key = String(detail.coverage_cd);
                let selected;
                if (snapSelectedMap.has(key)) {
                    selected = snapSelectedMap.get(key);
                } else if (detail.coverage_cd === 'aa00') {
                    selected = true;
                } else {
                    selected = detail.is_selected_coverage === 'Y';
                }
                detail.cover_selected = selected ? 'checked' : '';
            });
        });

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
     * 상품유형 셀렉트 표시명 — 앞의 '생손보'/'손보'/'생보' 접두어 숨김
     * (생손보를 생보보다 먼저 매칭해야 '생손보 …'가 '손보 …'로 깨지지 않음)
     */
    formatPlanTypeLabel(planName) {
        return String(planName || '').replace(/^(생손보|손보|생보)\s+/, '');
    },

    /** 상품군 표시 순서 */
    PLAN_CATEGORY_ORDER: ['종합', '건강', '간편', '어린이·청소년', '기타'],

    /**
     * 표시용 상품명 → 상품군 키
     * (간편실손은 '간편'이 아닌 '기타')
     */
    getPlanCategoryKey(displayLabel) {
        const t = String(displayLabel || '').trim();
        if (!t) return '기타';
        if (/^간편실손/.test(t)) return '기타';
        if (/^간편/.test(t)) return '간편';
        // 여성건강(무해지) → 종합 카테고리
        if (/^종합|^여성건강/.test(t) || /^\d+(\.\d+)+/.test(t)) return '종합';
        if (/^건강/.test(t)) return '건강';
        if (/^어린이|^청소년/.test(t)) return '어린이·청소년';
        return '기타';
    },

    /** 세부 목록 표시명 — 간편군에서는 '간편' 접두 생략 */
    formatPlanDetailLabel(displayLabel, categoryKey) {
        const t = String(displayLabel || '');
        if (categoryKey === '간편') {
            return t.replace(/^간편\s*/, '') || t;
        }
        return t;
    },

    /** 트리거 표시: 간편은 '군 · 세부', 그 외는 세부명만 */
    formatPlanPickerTriggerText(categoryKey, displayLabel) {
        const detail = this.formatPlanDetailLabel(displayLabel, categoryKey);
        if (!detail) return categoryKey || '상품 선택';
        if (categoryKey === '간편') return `간편 · ${detail}`;
        return detail;
    },

    /** 여성 전용 상품유형 여부 (남성 선택 시 목록에서 숨김) */
    isFemaleOnlyPlan(plan) {
        const type = String(plan?.plan_type ?? '');
        if (type === '08') return true; // 여성건강(무해지)
        const label = String(
            plan?.displayLabel
            || this.formatPlanTypeLabel(plan?.plan_name)
            || plan?.plan_name
            || ''
        ).trim();
        return /^여성/.test(label);
    },

    /** 손보(F) 기본 상품유형 — 종합(무해지) */
    applyFireDefaultPlanType() {
        const plans = this.getUniquePlansForInsurance();
        const preferred = plans.find((p) => String(p.plan_type) === '06')
            || plans.find((p) => /^종합\s*\(무해지\)/.test(String(p.displayLabel || '')));

        if (preferred) {
            mmlfcp_state.set('plan_type_id', preferred.plan_type);
            mmlfcp_state.set('plan_type_name', preferred.plan_name || '손보 종합(무해지)');
            mmlfcp_state.set('plan_category', preferred.categoryKey || '종합');
            return;
        }

        mmlfcp_state.set('plan_type_id', '06');
        mmlfcp_state.set('plan_type_name', '손보 종합(무해지)');
        mmlfcp_state.set('plan_category', '종합');
    },

    /** 현재 보험유형의 고유 상품유형 목록 */
    getUniquePlansForInsurance() {
        const plans = mmlfcp_state.getPlans();
        const insurance_type = mmlfcp_state.get('insurance_type');
        const gender = mmlfcp_state.get('gender')
            || document.getElementById('gender')?.value
            || '';
        const filteredPlans = plans.filter(p => p.insurance_type === insurance_type);
        let unique = [...new Map(filteredPlans.map(p => [p.plan_type, p])).values()].map((plan) => {
            const label = this.formatPlanTypeLabel(plan.plan_name);
            return {
                ...plan,
                displayLabel: label,
                categoryKey: this.getPlanCategoryKey(label),
            };
        });
        // 남성: 여성 관련 상품유형 숨김
        if (gender === 'M') {
            unique = unique.filter((p) => !this.isFemaleOnlyPlan(p));
        }
        return unique;
    },

    /**
     * 상품 유형 단일 피커 렌더링
     * - 숨은 select 동기화 (기존 로직 호환)
     * - 가로 상품군 + 세로 세부 목록
     */
    renderPlanOptions() {
        const selectEl = document.getElementById('selProductsGroupCD');
        const valueEl = document.getElementById('planPickerValue');
        if (!selectEl) return;

        const uniquePlanTypes = this.getUniquePlansForInsurance();
        this._planPickerPlans = uniquePlanTypes;

        let plan_type = mmlfcp_state.get('plan_type_id');
        const isExist = uniquePlanTypes.some(p => p.plan_type == plan_type);
        if (!isExist) {
            plan_type = null;
        }

        // 손보: 유효한 선택이 없으면 종합(무해지) 우선
        if (!plan_type && mmlfcp_state.get('insurance_type') === 'F') {
            const fireDefault = uniquePlanTypes.find((p) => String(p.plan_type) === '06')
                || uniquePlanTypes.find((p) => /^종합\s*\(무해지\)/.test(String(p.displayLabel || '')));
            if (fireDefault) {
                plan_type = fireDefault.plan_type;
            }
        }

        let categoryKey = mmlfcp_state.get('plan_category');
        if (plan_type) {
            const matched = uniquePlanTypes.find(p => p.plan_type == plan_type);
            categoryKey = matched?.categoryKey || categoryKey;
        }
        const availableCategories = this.PLAN_CATEGORY_ORDER.filter(
            (key) => uniquePlanTypes.some((p) => p.categoryKey === key)
        );
        if (!categoryKey || !availableCategories.includes(categoryKey)) {
            categoryKey = availableCategories[0] || '기타';
        }
        mmlfcp_state.set('plan_category', categoryKey);

        // 숨은 select: 전체 상품유형 유지 (값 조회용)
        selectEl.innerHTML = '';
        uniquePlanTypes.forEach((plan, index) => {
            const option = document.createElement('option');
            option.value = plan.plan_type;
            option.dataset.planName = plan.plan_name || '';
            option.dataset.category = plan.categoryKey;
            option.textContent = this.formatPlanDetailLabel(plan.displayLabel, plan.categoryKey);

            if (plan_type && plan.plan_type == plan_type) {
                option.selected = true;
                mmlfcp_state.set('plan_type_id', plan.plan_type);
                mmlfcp_state.set('plan_type_name', plan.plan_name);
            } else if (!plan_type && index === 0) {
                option.selected = true;
                mmlfcp_state.set('plan_type_id', plan.plan_type);
                mmlfcp_state.set('plan_type_name', plan.plan_name);
                categoryKey = plan.categoryKey;
                mmlfcp_state.set('plan_category', categoryKey);
            }
            selectEl.appendChild(option);
        });

        if (selectEl.options.length > 0) {
            selectEl.value = mmlfcp_state.get('plan_type_id');
        }

        const selected = uniquePlanTypes.find(p => p.plan_type == mmlfcp_state.get('plan_type_id'));
        if (valueEl && selected) {
            valueEl.textContent = this.formatPlanPickerTriggerText(selected.categoryKey, selected.displayLabel);
        } else if (valueEl) {
            valueEl.textContent = '상품 선택';
        }

        this.renderPlanPickerList();
        this.fitProductTypeSelectWidth();
    },

    /**
     * 상품군 가로 × 세부 세로 — table로 격자/라인 유지, 항목 1줄·왼쪽 정렬
     */
    renderPlanPickerList() {
        const listEl = document.getElementById('planPickerList');
        if (!listEl) return;

        const plans = this._planPickerPlans || this.getUniquePlansForInsurance();
        const categories = this.PLAN_CATEGORY_ORDER.filter(
            (key) => plans.some((p) => p.categoryKey === key)
        );
        const columns = categories.map((category) => ({
            category,
            items: plans.filter((p) => p.categoryKey === category),
        }));
        const selectedType = String(mmlfcp_state.get('plan_type_id') || '');
        const maxRows = columns.reduce((max, col) => Math.max(max, col.items.length), 0);

        listEl.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'plan-picker-table';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        columns.forEach(({ category }) => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = category;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let row = 0; row < maxRows; row += 1) {
            const tr = document.createElement('tr');
            columns.forEach(({ category, items }) => {
                const td = document.createElement('td');
                const plan = items[row];
                if (plan) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'plan-picker-item'
                        + (String(plan.plan_type) === selectedType ? ' is-selected' : '');
                    btn.setAttribute('role', 'option');
                    btn.setAttribute(
                        'aria-selected',
                        String(plan.plan_type) === selectedType ? 'true' : 'false'
                    );
                    btn.dataset.planType = plan.plan_type;
                    btn.dataset.planName = plan.plan_name || '';
                    btn.dataset.category = plan.categoryKey;
                    btn.textContent = this.formatPlanDetailLabel(plan.displayLabel, category);
                    td.appendChild(btn);
                } else {
                    td.className = 'is-empty';
                    td.innerHTML = '&nbsp;';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        listEl.appendChild(table);

        const selectedBtn = listEl.querySelector('.plan-picker-item.is-selected');
        if (selectedBtn) {
            selectedBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    },

    ensurePlanPickerBackdrop() {
        return this.ensureHeaderMenuBackdrop();
    },

    ensureHeaderMenuBackdrop() {
        let backdrop = document.getElementById('planPickerBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'planPickerBackdrop';
            backdrop.className = 'plan-picker-backdrop';
            backdrop.hidden = true;
            backdrop.setAttribute('aria-hidden', 'true');
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', () => {
                this.closeAllHeaderPickers();
            });
        }
        return backdrop;
    },

    /** 헤더 커스텀 피커 정의 (숨은 select와 동기화) */
    HEADER_SELECT_PICKERS: [
        {
            key: 'gender',
            selectId: 'gender',
            pickerId: 'genderPicker',
            triggerId: 'genderPickerTrigger',
            valueId: 'genderPickerValue',
            panelId: 'genderPickerPanel',
            listId: 'genderPickerList',
        },
        {
            key: 'insurance',
            selectId: 'selInsuranceType',
            pickerId: 'insurancePicker',
            triggerId: 'insurancePickerTrigger',
            valueId: 'insurancePickerValue',
            panelId: 'insurancePickerPanel',
            listId: 'insurancePickerList',
        },
        {
            key: 'payterm',
            selectId: 'selPaymentExpirationCD',
            pickerId: 'paytermPicker',
            triggerId: 'paytermPickerTrigger',
            valueId: 'paytermPickerValue',
            panelId: 'paytermPickerPanel',
            listId: 'paytermPickerList',
        },
    ],

    getHeaderSelectPickerConfig(selectIdOrKey) {
        return this.HEADER_SELECT_PICKERS.find(
            (c) => c.selectId === selectIdOrKey || c.key === selectIdOrKey
        ) || null;
    },

    /**
     * 헤더 목록 열림 시 배경 블러
     */
    setHeaderMenuBackdrop(open, options = {}) {
        const backdrop = this.ensureHeaderMenuBackdrop();
        const interactive = options.interactive !== false;
        const owner = options.owner || '';

        if (open) {
            this._headerBackdropOwner = owner;
            backdrop.hidden = false;
            backdrop.classList.toggle('is-interactive', interactive);
            backdrop.setAttribute('aria-hidden', 'false');
            document.body.classList.add('header-menu-open');
            return;
        }

        if (owner && this._headerBackdropOwner && this._headerBackdropOwner !== owner) {
            return;
        }

        this._headerBackdropOwner = '';
        backdrop.hidden = true;
        backdrop.classList.remove('is-interactive');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('header-menu-open');
    },

    closeAllHeaderPickers(exceptKey = '') {
        this.HEADER_SELECT_PICKERS.forEach((cfg) => {
            if (exceptKey && cfg.key === exceptKey) return;
            this.setHeaderSelectPickerOpen(cfg.key, false);
        });
        if (exceptKey !== 'planPicker') {
            this.setPlanPickerOpen(false);
        }
        if (!exceptKey) {
            this.setHeaderMenuBackdrop(false);
        }
    },

    /** 숨은 select → 트리거 문구/목록 동기화 */
    syncHeaderSelectPicker(selectIdOrKey) {
        const cfg = this.getHeaderSelectPickerConfig(selectIdOrKey);
        if (!cfg) return;

        const selectEl = document.getElementById(cfg.selectId);
        const valueEl = document.getElementById(cfg.valueId);
        const listEl = document.getElementById(cfg.listId);
        if (!selectEl || !valueEl || !listEl) return;

        const selected = selectEl.selectedOptions[0]
            || [...selectEl.options].find((o) => !o.disabled)
            || null;
        valueEl.textContent = selected ? selected.textContent : '선택';

        const selectedValue = String(selectEl.value || '');
        listEl.innerHTML = '';
        Array.from(selectEl.options).forEach((opt) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'plan-picker-item'
                + (String(opt.value) === selectedValue ? ' is-selected' : '')
                + (opt.disabled ? ' is-disabled' : '');
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', String(opt.value) === selectedValue ? 'true' : 'false');
            btn.dataset.value = opt.value;
            btn.textContent = opt.textContent;
            if (opt.disabled) btn.disabled = true;
            li.appendChild(btn);
            listEl.appendChild(li);
        });

        if (cfg.key === 'payterm') {
            this.fitPaytermPickerWidth();
        }
    },

    syncAllHeaderSelectPickers() {
        this.HEADER_SELECT_PICKERS.forEach((cfg) => this.syncHeaderSelectPicker(cfg.key));
    },

    setHeaderSelectPickerOpen(selectIdOrKey, open) {
        const cfg = this.getHeaderSelectPickerConfig(selectIdOrKey);
        if (!cfg) return;

        const picker = document.getElementById(cfg.pickerId);
        const panel = document.getElementById(cfg.panelId);
        const trigger = document.getElementById(cfg.triggerId);
        const li = picker?.closest('.header-picker-li');
        if (!picker || !panel || !trigger) return;

        if (open) {
            const selectEl = document.getElementById(cfg.selectId);
            if (selectEl?.disabled || trigger.disabled) return;

            this.closeAllHeaderPickers(cfg.key);
            this.syncHeaderSelectPicker(cfg.key);
            panel.style.left = '50%';
            panel.style.transform = 'translateX(-50%)';
            panel.hidden = false;
            this.setHeaderMenuBackdrop(true, { interactive: true, owner: cfg.key });
            picker.classList.add('is-open');
            li?.classList.add('is-picker-open');
            trigger.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => {
                this.centerHeaderPickerPanel(panel);
                const selectedBtn = panel.querySelector('.plan-picker-item.is-selected');
                if (selectedBtn) selectedBtn.scrollIntoView({ block: 'nearest' });
            });
        } else {
            panel.hidden = true;
            panel.style.left = '';
            panel.style.transform = '';
            picker.classList.remove('is-open');
            li?.classList.remove('is-picker-open');
            trigger.setAttribute('aria-expanded', 'false');
            if (this._headerBackdropOwner === cfg.key) {
                this.setHeaderMenuBackdrop(false, { owner: cfg.key });
            }
        }
    },

    centerHeaderPickerPanel(panel) {
        if (!panel || panel.hidden) return;
        panel.style.left = '50%';
        panel.style.transform = 'translateX(-50%)';
        const rect = panel.getBoundingClientRect();
        let shift = 0;
        if (rect.left < 12) shift += 12 - rect.left;
        if (rect.right + shift > window.innerWidth - 12) {
            shift -= (rect.right + shift) - (window.innerWidth - 12);
        }
        panel.style.transform = shift
            ? `translateX(calc(-50% + ${shift}px))`
            : 'translateX(-50%)';
    },

    handleHeaderSelectPickerItem(selectIdOrKey, value) {
        const cfg = this.getHeaderSelectPickerConfig(selectIdOrKey);
        if (!cfg) return;
        const selectEl = document.getElementById(cfg.selectId);
        if (!selectEl) return;

        const opt = [...selectEl.options].find((o) => String(o.value) === String(value));
        if (!opt || opt.disabled) return;

        selectEl.value = value;
        this.syncHeaderSelectPicker(cfg.key);
        this.setHeaderSelectPickerOpen(cfg.key, false);

        const onChange = this._headerSelectPickerHandlers?.[cfg.key];
        if (typeof onChange === 'function') onChange(value, opt);
    },

    bindHeaderSelectPickers() {
        if (this._headerSelectPickersBound) return;
        this._headerSelectPickersBound = true;
        this._headerSelectPickerHandlers = this._headerSelectPickerHandlers || {};

        this.HEADER_SELECT_PICKERS.forEach((cfg) => {
            const trigger = document.getElementById(cfg.triggerId);
            const listEl = document.getElementById(cfg.listId);
            const picker = document.getElementById(cfg.pickerId);
            if (!trigger || !listEl || !picker) return;

            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const open = !picker.classList.contains('is-open');
                this.setHeaderSelectPickerOpen(cfg.key, open);
            });

            listEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.plan-picker-item');
                if (!btn || btn.disabled) return;
                e.preventDefault();
                e.stopPropagation();
                this.handleHeaderSelectPickerItem(cfg.key, btn.dataset.value);
            });
        });

        document.addEventListener('click', (e) => {
            const inPicker = e.target.closest('.header-picker, #planPicker');
            if (inPicker) return;
            this.closeAllHeaderPickers();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllHeaderPickers();
        });

        this.syncAllHeaderSelectPickers();
    },

    setPlanPickerOpen(open) {
        const picker = document.getElementById('planPicker');
        const panel = document.getElementById('planPickerPanel');
        const trigger = document.getElementById('planPickerTrigger');
        const li = picker?.closest('.plan-picker-li');
        if (!picker || !panel || !trigger) return;

        if (open) {
            this.HEADER_SELECT_PICKERS.forEach((cfg) => {
                this.setHeaderSelectPickerOpen(cfg.key, false);
            });
            this.renderPlanPickerList();
            panel.style.left = '50%';
            panel.style.transform = 'translateX(-50%)';
            panel.hidden = false;
            this.setHeaderMenuBackdrop(true, { interactive: true, owner: 'planPicker' });
            picker.classList.add('is-open');
            li?.classList.add('is-picker-open');
            trigger.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => {
                this.centerPlanPickerPanel();
                const selectedBtn = panel.querySelector('.plan-picker-item.is-selected');
                if (selectedBtn) {
                    selectedBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            });
        } else {
            panel.hidden = true;
            panel.style.left = '';
            panel.style.transform = '';
            picker.classList.remove('is-open');
            li?.classList.remove('is-picker-open');
            trigger.setAttribute('aria-expanded', 'false');
            if (this._headerBackdropOwner === 'planPicker') {
                this.setHeaderMenuBackdrop(false, { owner: 'planPicker' });
            }
        }
    },

    /** 패널을 상품유형 버튼 기준 가운데 정렬 (화면 밖으로 나가면 보정) */
    centerPlanPickerPanel() {
        const panel = document.getElementById('planPickerPanel');
        this.centerHeaderPickerPanel(panel);
    },

    /** 세부 상품 확정 시에만 조회 */
    handlePlanPickerItemSelect(planType, planName, categoryKey) {
        const selectEl = document.getElementById('selProductsGroupCD');
        if (!selectEl || planType == null || planType === '') return;

        if (categoryKey) {
            mmlfcp_state.set('plan_category', categoryKey);
        }
        selectEl.value = planType;
        if (selectEl.selectedOptions[0]) {
            selectEl.selectedOptions[0].dataset.planName = planName || selectEl.selectedOptions[0].dataset.planName;
        }

        const valueEl = document.getElementById('planPickerValue');
        const displayLabel = this.formatPlanTypeLabel(planName);
        const cat = categoryKey || this.getPlanCategoryKey(displayLabel);
        if (valueEl) {
            valueEl.textContent = this.formatPlanPickerTriggerText(cat, displayLabel);
        }

        this.setPlanPickerOpen(false);
        this.handlePlanTypeChange();
    },

    bindPlanPickerEvents() {
        if (this._planPickerEventsBound) return;
        this._planPickerEventsBound = true;

        const picker = document.getElementById('planPicker');
        const trigger = document.getElementById('planPickerTrigger');
        const listEl = document.getElementById('planPickerList');
        if (!picker || !trigger) return;

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open = !picker.classList.contains('is-open');
            this.setPlanPickerOpen(open);
        });

        listEl?.addEventListener('click', (e) => {
            const btn = e.target.closest('.plan-picker-item');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            this.handlePlanPickerItemSelect(
                btn.dataset.planType,
                btn.dataset.planName,
                btn.dataset.category
            );
        });
    },

    /** 상품유형 피커: 선택 텍스트에 맞춰 너비 설정 */
    fitProductTypeSelectWidth() {
        const trigger = document.getElementById('planPickerTrigger');
        const valueEl = document.getElementById('planPickerValue');
        const li = document.querySelector('.plan-picker-li') || trigger?.closest('li');
        if (!trigger || !valueEl) return;

        const style = window.getComputedStyle(trigger);
        const probe = document.createElement('span');
        probe.style.cssText = [
            'position:absolute',
            'visibility:hidden',
            'white-space:nowrap',
            `font:${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
            'letter-spacing:' + style.letterSpacing,
        ].join(';');
        probe.textContent = valueEl.textContent || '';
        document.body.appendChild(probe);
        const textWidth = probe.offsetWidth;
        probe.remove();

        const width = Math.min(Math.max(Math.ceil(textWidth) + 52, 180), 320);
        trigger.style.width = `${width}px`;
        if (li) {
            li.style.width = `${width}px`;
            li.style.flex = `0 0 ${width}px`;
        }
    },

    /** 만기 피커: 옵션 중 가장 긴 텍스트에 맞춰 선택창 폭 설정 */
    fitPaytermPickerWidth() {
        const trigger = document.getElementById('paytermPickerTrigger');
        const selectEl = document.getElementById('selPaymentExpirationCD');
        const valueEl = document.getElementById('paytermPickerValue');
        const li = document.getElementById('paytermPicker')?.closest('li');
        if (!trigger || !selectEl) return;

        const style = window.getComputedStyle(trigger);
        const probe = document.createElement('span');
        probe.style.cssText = [
            'position:absolute',
            'visibility:hidden',
            'white-space:nowrap',
            `font:${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
            'letter-spacing:' + style.letterSpacing,
        ].join(';');
        document.body.appendChild(probe);

        let maxText = 0;
        Array.from(selectEl.options).forEach((opt) => {
            probe.textContent = opt.textContent || '';
            maxText = Math.max(maxText, probe.offsetWidth);
        });
        if (valueEl?.textContent) {
            probe.textContent = valueEl.textContent;
            maxText = Math.max(maxText, probe.offsetWidth);
        }
        probe.remove();

        const width = Math.min(Math.max(Math.ceil(maxText) + 52, 148), 220);
        trigger.style.width = `${width}px`;
        trigger.style.minWidth = `${width}px`;
        if (li) {
            li.style.width = `${width}px`;
            li.style.flex = `0 0 ${width}px`;
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
            const fromInput = app.toYyyymmdd(birthEl?.value);
            mmlfcp_state.set('birth_date', app.toYyyymmdd(_state.birth_date) || fromInput || '19850101');
        } else {
            mmlfcp_state.set('birth_date', app.toYyyymmdd(mmlfcp_state.get('birth_date')) || '19850101');
        }
        this.syncBirthDateInput();

        // 2️⃣ 경로(path) 또는 나이에 따른 자동 상품 세팅
        const path = mmlfcp_state.get('url_path'); // main.js에서 저장한 path 값
        const currentBirthDate = app.toYyyymmdd(mmlfcp_state.get('birth_date'));
        const age = (currentBirthDate && currentBirthDate.length === 8) ? app.getAgefromString(currentBirthDate) : 0;
        mmlfcp_state.set('age', age);

        if (this.isFireOnlyGa() || path === 'fire') {
            // 🔥 path=fire 또는 GA A266 (손보 전용)
            mmlfcp_state.set('insurance_type', _state.insurance_type || 'F');
            mmlfcp_state.set('plan_type_id', _state.plan_type_id); // 손보 종합(무해지)
            mmlfcp_state.set('plan_payment_expiration_cd', _state.plan_payment_expiration_cd); // 20년/100세
        }
        else if (path === 'lifefire') {
            // 🌿 path=lifefire (생손보) 우선 세팅
            mmlfcp_state.set('insurance_type', _state.insurance_type);
            mmlfcp_state.set('plan_type_id', _state.plan_type_id); // 생손보 건강(무해지)
            mmlfcp_state.set('plan_payment_expiration_cd', _state.plan_payment_expiration_cd); // 20년/100세,종신
        }
        else if (age > 0) {
            // 경로 정보가 없을 때만 나이 기반 기본값 세팅
            this.setDefaultByAge(age);
        }

        // 3️⃣ 세팅된 State 값을 UI(DOM)에 반영
        if (insurSel) {
            insurSel.value = mmlfcp_state.get('insurance_type');
        }

        // 상품 유형 UI 반영 (선택된 옵션의 원본 상품명 저장)
        if (planSel) {
            const targetPlanType = mmlfcp_state.get('plan_type_id');
            if (targetPlanType) {
                planSel.value = targetPlanType;
                if (planSel.selectedOptions.length > 0) {
                    const opt = planSel.selectedOptions[0];
                    mmlfcp_state.set('plan_type_name', opt.dataset.planName || opt.textContent);
                    if (opt.dataset.category) {
                        mmlfcp_state.set('plan_category', opt.dataset.category);
                    }
                }
            }
            const valueEl = document.getElementById('planPickerValue');
            if (valueEl && planSel.selectedOptions.length > 0) {
                const opt = planSel.selectedOptions[0];
                const cat = opt.dataset.category || mmlfcp_state.get('plan_category');
                const label = this.formatPlanTypeLabel(opt.dataset.planName || opt.textContent);
                valueEl.textContent = this.formatPlanPickerTriggerText(cat, label);
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

        this.syncAllHeaderSelectPickers();

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

    /** date input ↔ YYYYMMDD 상태 동기화 */
    syncBirthDateInput() {
        const birthEl = document.getElementById('birth_date');
        if (!birthEl) return;
        const ymd = app.toYyyymmdd(mmlfcp_state.get('birth_date'));
        const iso = app.toDateInputValue(ymd);
        if (iso) birthEl.value = iso;

        // 캘린더 선택 가능 범위 (1920 ~ 오늘)
        birthEl.min = '1920-01-01';
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        birthEl.max = `${yyyy}-${mm}-${dd}`;
    },

    getBirthDateYmd() {
        const birthEl = document.getElementById('birth_date');
        return app.toYyyymmdd(birthEl?.value)
            || app.toYyyymmdd(mmlfcp_state.get('birth_date'))
            || '';
    },

    applyBirthDateChange(rawValue) {
        const birth_date = app.toYyyymmdd(rawValue);
        if (!birth_date || !app.isValidDate(birth_date)) {
            this.hide_content();
            _state.current_page = 1;
            return;
        }

        const age = app.getAgefromString(birth_date);
        mmlfcp_state.set('birth_date', birth_date);
        mmlfcp_state.set('age', age);
        this.syncBirthDateInput();

        this.setDefaultByAge(age);
        this.renderInsuAge();
        this.renderPlanOptions();
        this.renderPayTermBySelectedPlan();
        this.updatePlanIdByCurrentState();
        this.renderPayTermSelectedAge();
        this.scheduleAutoSearch();
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
        this.syncHeaderSelectPicker('payterm');
        this.fitPaytermPickerWidth();
    },

    handlePlanTypeChange() {
        const planSel = document.getElementById('selProductsGroupCD');

        // 1️. 안전 장치: 선택된 옵션이 없는 경우 방어
        if (!planSel || planSel.selectedIndex === -1) return;

        const selectedPlanType = planSel.value;
        const selectedOpt = planSel.selectedOptions[0];
        const selectedText = selectedOpt.dataset.planName || selectedOpt.textContent;

        // 2. State 반영
        mmlfcp_state.set('plan_type_id', selectedPlanType);
        mmlfcp_state.set('plan_type_name', selectedText);
        if (selectedOpt.dataset.category) {
            mmlfcp_state.set('plan_category', selectedOpt.dataset.category);
        }

        const valueEl = document.getElementById('planPickerValue');
        if (valueEl) {
            const cat = selectedOpt.dataset.category || mmlfcp_state.get('plan_category');
            const label = this.formatPlanTypeLabel(selectedText);
            valueEl.textContent = this.formatPlanPickerTriggerText(cat, label);
        }

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
        this.fitProductTypeSelectWidth();

        // 7️. 자동 조회
        this.scheduleAutoSearch();
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
        this.syncHeaderSelectPicker('gender');
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
        // console.log({ plans: plans });
        // console.log({ selectedPlan: selectedPlan });
        // console.log({ plan_id: plan_id, plan_type: plan_type, plan_payterm_type: plan_payterm_type, gender: gender });

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
            //"01", "02", "03", "04", // 생손보
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

    /**
     * 출력하기 모달 항목 표시 — 툴바(setDetailMenu/setSimplifiDetailMenu)와 동일 조건
     * 0 한장비교: 항상
     * 1 만기별: 상품유형·만기 조건
     * 2 연령별: 상품유형·만기 조건
     * 3 상품유형별: 대상 상품유형만
     */
    setPrintliMenu() {
        const plan_type = String(mmlfcp_state.get('plan_type_id') || '');
        const plan_payment_expiration_name = String(mmlfcp_state.get('plan_payment_expiration_name') || '');

        const menu = {
            one: true,       // 한장 비교 출력
            payment: false,  // 만기별 보험료 비교 출력
            aging: false,    // 연령별 비교 출력
            simplifi: false, // 상품유형별 비교 출력
        };

        // 만기별 비교 가능 상품유형 (툴바 openPaymentModalBtn 과 동일)
        const BASE_PAYMENT_PRODUCTS = [
            "05", "06", "07", // 종합
            "14", "15", "16", "17", // 간편 325/335/355/31010
            "18", "19", // 어린이
            "20", "21", "22", // 청소년
            "25", // 생보 치매(무해지)
        ];

        // 상품유형별 비교 (툴바 openCoverageDetailModalBtn 과 동일)
        const BASE_SIMPLIFI_PRODUCTS = [
            "06", "07", "14", "15", "16", "17", "21", "22", // 손보 종합·간편·청소년
            "09", "11", "12", "13", // 생보건강·생보간편
        ];

        const FEMALE_HEALTH = "08";

        // 종신/생손보 만기 → 만기별 비교 제외, 연령별은 표시 (툴바 setDetailMenu 와 동일)
        const isRenewalExpiration =
            plan_payment_expiration_name.includes("종신") ||
            plan_payment_expiration_name.includes("20년/100세,종신");

        if (plan_type === FEMALE_HEALTH) {
            menu.payment = true;
            menu.aging = true;
        } else if (isRenewalExpiration) {
            menu.payment = false;
            menu.aging = true;
        } else if (BASE_PAYMENT_PRODUCTS.includes(plan_type)) {
            menu.payment = true;
            menu.aging = true;
        } else {
            // 그 외(생손보 건강 등): 한장 + 연령별 (+ 대상이면 상품유형별)
            menu.payment = false;
            menu.aging = true;
        }

        if (BASE_SIMPLIFI_PRODUCTS.includes(plan_type)) {
            menu.simplifi = true;
        }

        this._toggleMenu('one-title', menu.one);
        this._toggleMenu('product-title', menu.payment);
        this._toggleMenu('age-title', menu.aging);
        this._toggleMenu('plan-type-title', menu.simplifi);

        // 숨겨진 항목이 선택돼 있으면 보이는 첫 항목으로 전환
        this._ensureVisiblePrintOptionSelected();
    },

    /** 출력 모달에서 현재 보이는 라디오 중 하나가 선택되도록 보정 */
    _ensureVisiblePrintOptionSelected() {
        const radios = Array.from(document.querySelectorAll("input[name='plan_title']"));
        if (!radios.length) return;

        const isVisible = (radio) => {
            const row = radio.closest('li');
            if (!row) return !radio.disabled;
            if (row.hidden || row.classList.contains('is-toolbar-hidden')) return false;
            const style = window.getComputedStyle(row);
            return style.display !== 'none' && style.visibility !== 'hidden';
        };

        const checked = radios.find((r) => r.checked);
        if (checked && isVisible(checked)) return;

        const firstVisible = radios.find(isVisible);
        if (firstVisible) firstVisible.checked = true;
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

        // body로 옮겨둔 상품정보 팝오버 정리 (재렌더 시 orphan 방지)
        this.cleanupOrphanProductInfo();

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
            // 생보사명 → 녹색 표시용 클래스
            const isLifeCompany = this.isLifeInsuranceCompany(item.company_code, item.company_name);
            const lifeClass = isLifeCompany ? ' company-life' : '';
            const companyName = item.company_name || item.company_code || '';
            return `
                    <li class="${isLifeCompany ? 'company-life' : ''}">
                    <div class="inner${lifeClass}">
                        <div class="checkbox-area">
                        <input type="checkbox" id="${chk_id}" company_code="${item.company_code}" company_name="${item.company_name}" ${item.DispValue == true ? "checked" : ""}>
                        <label for="${chk_id}"></label>
                        </div>

                        <div class="img-area${lifeClass}" title="${companyName}">
                        <span class="company-name">${companyName}</span>
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
        this.ensureCompanyTableScrollSync();
        requestAnimationFrame(() => this.syncCompanyTableScroll(true));
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
        this.ensureCompanyTableScrollSync();
        requestAnimationFrame(() => this.syncCompanyTableScroll());
    },


    /** company_code → 보험사명 맵 (coverage_premiums / required_premiums 기준) */
    _getCompanyNameMap() {
        const map = {};
        const sources = [
            ...(mmlfcp_state.get('coverage_premiums') || []),
            ...(mmlfcp_state.get('required_premiums') || []),
            ...(mmlfcp_state.get('required_premiums_grouped') || []),
        ];
        sources.forEach((item) => {
            if (item?.company_code && item?.company_name && !map[item.company_code]) {
                map[item.company_code] = item.company_name;
            }
        });
        return map;
    },

    /** 담보 상세 비교 — 해당 coverage_cd 데이터가 있는 보험사 목록 */
    _getCompaniesWithCoverageDetail(coverage_cd) {
        const products = mmlfcp_state.get('product_insur_premiums') || [];
        const nameMap = this._getCompanyNameMap();
        const map = new Map();
        products.forEach((p) => {
            const hasDetail = (p.detailList || []).some((d) => String(d.coverage_cd) === String(coverage_cd));
            if (hasDetail && !map.has(p.company_code)) {
                map.set(p.company_code, {
                    company_code: p.company_code,
                    company_name: nameMap[p.company_code] || p.company_name || p.company_code,
                    product_name: (p.product_name || '').trim(),
                });
            }
        });
        return Array.from(map.values());
    },

    _getCompanyMeta(company_code, companies) {
        const nameMap = this._getCompanyNameMap();
        return companies.find((c) => c.company_code === company_code) || {
            company_code,
            company_name: nameMap[company_code] || company_code,
            product_name: '',
        };
    },

    /** 메인 그리드와 동일한 방식으로 보험사·보별 보험료 합계 */
    _getCoveragePremiumByCompany(company_code, coverage_cd) {
        if (!company_code || !coverage_cd) return 0;
        const coverage_premiums = mmlfcp_state.get('coverage_premiums') || [];
        const product = coverage_premiums.find((p) => p.company_code == company_code);
        if (!product) return 0;

        const coverageKey = company_code + coverage_cd;
        const idxList = _state.guide_coverage_item?.[coverageKey] || [];
        if (idxList.length) {
            return idxList.reduce((sum, idx) => {
                const detail = product.detailList?.[idx];
                return sum + Math.floor(detail?.base_premium ?? detail?.premium ?? 0);
            }, 0);
        }

        return (product.detailList || [])
            .filter((d) => String(d.coverage_cd) === String(coverage_cd))
            .reduce((sum, d) => sum + Math.floor(d.base_premium ?? d.premium ?? 0), 0);
    },

    _formatPremiumLabel(premium) {
        return `${app.formatNumber(premium || 0)}원`;
    },

    _getDetailCompareSortedCompanies(companies, coverage_cd) {
        return [...companies]
            .map((c) => ({
                ...c,
                premium: this._getCoveragePremiumByCompany(c.company_code, coverage_cd),
            }))
            .sort((a, b) => {
                const aPremium = Number(a.premium) || 0;
                const bPremium = Number(b.premium) || 0;
                if (aPremium !== bPremium) return aPremium - bPremium;
                return String(a.company_name || '').localeCompare(String(b.company_name || ''), 'ko');
            });
    },

    _getDetailCompareOptionLabel(company, maxNameLen, withPremium) {
        const name = company.company_name || company.company_code || '';
        if (!withPremium) return name;

        const nameLen = Array.from(String(name)).length;
        const padCount = Math.max(0, maxNameLen - nameLen);
        const paddedName = `${name}${'　'.repeat(padCount)}`;
        const namePremiumGap = '　　　　';
        return `${paddedName}${namePremiumGap}${this._formatPremiumLabel(company.premium)}`;
    },

    _buildDetailCompareSelectOptions(companies, selectedCode, coverage_cd, withPremium = false, excludedCodes = []) {
        const options = ['<option value="">보험사를 선택하세요</option>'];
        const sorted = this._getDetailCompareSortedCompanies(companies, coverage_cd);
        const maxNameLen = sorted.reduce((max, c) => Math.max(max, Array.from(String(c.company_name || '')).length), 0);
        const excluded = new Set(
            (excludedCodes || []).filter((code) => code && String(code) !== String(selectedCode || ''))
        );

        sorted.forEach((c) => {
            const selected = c.company_code === selectedCode ? ' selected' : '';
            const disabled = excluded.has(c.company_code) ? ' disabled' : '';
            const label = this._getDetailCompareOptionLabel(c, maxNameLen, withPremium);
            options.push(`<option value="${c.company_code}"${selected}${disabled}>${label}</option>`);
        });
        return options.join('');
    },

    _setDetailCompareSelectLabels(select, withPremium) {
        if (!select) return;
        const coverage_cd = mmlfcp_state.get('detail_compare_coverage_cd');
        const companies = this._getCompaniesWithCoverageDetail(coverage_cd);
        const sorted = this._getDetailCompareSortedCompanies(companies, coverage_cd);
        const maxNameLen = sorted.reduce((max, c) => Math.max(max, Array.from(String(c.company_name || '')).length), 0);
        const byCode = new Map(sorted.map((c) => [c.company_code, c]));
        const currentValue = select.value;

        Array.from(select.options).forEach((opt) => {
            if (!opt.value) {
                opt.textContent = '보험사를 선택하세요';
                return;
            }
            const company = byCode.get(opt.value);
            if (!company) return;
            opt.textContent = this._getDetailCompareOptionLabel(company, maxNameLen, withPremium);
        });

        select.value = currentValue;
        this._refreshDetailCompareSelectAvailability();
    },

    /** 다른 카드에서 이미 선택된 보험사는 선택 불가 */
    _refreshDetailCompareSelectAvailability() {
        const slots = [1, 2, 3];
        const selectedBySlot = {};
        slots.forEach((slot) => {
            selectedBySlot[slot] = mmlfcp_state.get(`detail_compare_company_${slot}`) || '';
        });

        slots.forEach((slot) => {
            const select = document.querySelector(`.detail-compare-select[data-slot="${slot}"]`);
            if (!select) return;

            const ownCode = selectedBySlot[slot];
            const taken = new Set(
                slots
                    .filter((s) => s !== slot)
                    .map((s) => selectedBySlot[s])
                    .filter(Boolean)
            );

            Array.from(select.options).forEach((opt) => {
                if (!opt.value) {
                    opt.disabled = false;
                    return;
                }
                opt.disabled = taken.has(opt.value) && opt.value !== ownCode;
            });
        });
    },

    _getDetailComparePremiumText(company_code, coverage_cd) {
        if (!company_code) return '-';
        return this._formatPremiumLabel(this._getCoveragePremiumByCompany(company_code, coverage_cd));
    },

    _getDetailComparePremiumValue(company_code, coverage_cd) {
        if (!company_code) return null;
        return this._getCoveragePremiumByCompany(company_code, coverage_cd);
    },

    _refreshDetailCompareMinHighlight() {
        const coverage_cd = mmlfcp_state.get('detail_compare_coverage_cd');
        const slots = [1, 2, 3];
        const selectedCode = mmlfcp_state.get('detail_compare_company_1');
        const companies = this._getCompaniesWithCoverageDetail(coverage_cd);
        const expected = this._pickDetailCompareCompanies(selectedCode, companies, coverage_cd);
        const premiums = slots.map((slot) => {
            const code = mmlfcp_state.get(`detail_compare_company_${slot}`);
            const value = this._getDetailComparePremiumValue(code, coverage_cd);
            return { slot, code, value };
        });

        slots.forEach((slot) => {
            const col = document.getElementById(`detail_compare_col_${slot}`);
            if (!col) return;
            const item = premiums.find((p) => p.slot === slot);
            const hasSelection = !!(item?.code);
            const isMin = hasSelection && !!expected.compare2 && item.code === expected.compare2;
            const isMax = hasSelection && !!expected.compare3 && item.code === expected.compare3;
            const conditionType = isMin ? 'min' : (isMax ? 'max' : null);

            col.classList.toggle('is-empty', !hasSelection);
            col.classList.toggle('is-selected', hasSelection);
            col.classList.remove('is-lowest', 'is-condition-match');
            col.classList.toggle('is-condition-min', isMin);
            col.classList.toggle('is-condition-max', isMax);

            if (slot === 2 || slot === 3) {
                const columnTitle = this._getDetailCompareColumnTitle(slot, conditionType);
                const titleEl = document.getElementById(`detail_compare_col_${slot}_title`);
                const noteEl = document.getElementById(`detail_compare_col_${slot}_note`);
                if (titleEl) titleEl.textContent = columnTitle.title;
                if (noteEl) {
                    noteEl.textContent = columnTitle.note;
                    noteEl.hidden = !columnTitle.note;
                }
            }
        });

        this._refreshDetailCompareSelectAvailability();
    },

    _renderCoverageDetailColumnBody(company_code, coverage_cd) {
        if (!company_code) {
            return `
                <div class="detail-compare-empty">
                    <strong>보험사를 선택해 주세요</strong>
                    <span>상단 목록에서 비교할 보험사를 고르면<br>담보 상세 내용이 표시됩니다.</span>
                </div>
            `;
        }

        const products = (mmlfcp_state.get('product_insur_premiums') || []).filter((r) => r.company_code == company_code);
        const items = [];

        products.forEach((insu_product) => {
            (insu_product.detailList || [])
                .filter((detail) => String(detail.coverage_cd) === String(coverage_cd))
                .forEach((detail) => {
                    items.push(`
                        <article class="detail-compare-item">
                            <h3 class="detail-compare-item__title">${detail.insur_nm || '담보'}</h3>
                            <div class="detail-compare-item__meta">
                                <span class="detail-compare-chip">가입금액 <b>${app.formatNumber(detail.contract_amount)}만원</b></span>
                                <span class="detail-compare-chip detail-compare-chip--accent">보험료 <b>${app.formatNumber(detail.premium)}원</b></span>
                                <span class="detail-compare-chip">납기 <b>${detail.pay_term || '-'}</b></span>
                            </div>
                            <div class="detail-compare-item__body">${(detail.insur_bojang || '보장 내용이 없습니다.')
                                    .replace(/^[\s\u00a0\u3000]+/gm, '')
                                    .replace(/(?:\r\n|\r|\n)/g, '<br />')}</div>
                        </article>
                    `);
                });
        });

        if (!items.length) {
            return `
                <div class="detail-compare-empty">
                    <strong>해당 담보 정보가 없습니다</strong>
                    <span>선택한 보험사에 이 담보의 상세 내역이 없습니다.</span>
                </div>
            `;
        }
        return items.join('');
    },

    _getDetailCompareColumnTitle(slot, conditionType = null) {
        if (slot === 1) {
            return { title: '선택 특약 보험료', note: '' };
        }
        if (slot === 2 || slot === 3) {
            if (conditionType === 'min') {
                return { title: '최저 특약 보험료', note: '(선택한 특약 제외)' };
            }
            if (conditionType === 'max') {
                return { title: '최고 특약 보험료', note: '(선택한 특약 제외)' };
            }
            return {
                title: slot === 2 ? '비교 상품 1' : '비교 상품 2',
                note: ''
            };
        }
        return { title: '비교 상품', note: '' };
    },

    _renderDetailCompareColumnHeader(slot, companies, selectedCode, coverage_cd, selectedBySlot = {}) {
        const meta = selectedCode ? this._getCompanyMeta(selectedCode, companies) : null;
        const premiumText = this._getDetailComparePremiumText(selectedCode, coverage_cd);
        const initialCondition = slot === 2 ? 'min' : (slot === 3 ? 'max' : null);
        const columnTitle = this._getDetailCompareColumnTitle(slot, initialCondition);
        const excludedCodes = [1, 2, 3]
            .filter((s) => s !== slot)
            .map((s) => selectedBySlot[s])
            .filter(Boolean);
        // 3열 상단 높이 통일을 위해 note 슬롯은 항상 렌더 (빈 값이면 hidden으로 공간만 유지)
        const noteHtml = `<span class="detail-compare-col-note" id="detail_compare_col_${slot}_note"${columnTitle.note ? '' : ' hidden'}>${columnTitle.note || ''}</span>`;
        return `
            <div class="detail-compare-header">
                <div class="detail-compare-col-heading">
                    <h3 class="detail-compare-col-title" id="detail_compare_col_${slot}_title">${columnTitle.title}</h3>
                    ${noteHtml}
                </div>
                <div class="detail-compare-select-row">
                    <select class="detail-compare-select" data-slot="${slot}" aria-label="${columnTitle.title} 보험사 선택">
                        ${this._buildDetailCompareSelectOptions(companies, selectedCode, coverage_cd, false, excludedCodes)}
                    </select>
                    <strong class="detail-compare-premium" id="detail_compare_col_${slot}_premium">${premiumText}</strong>
                </div>
                <p class="detail-compare-product" id="detail_compare_col_${slot}_product">${selectedCode ? (meta?.product_name || '-') : '보험사를 선택해 주세요'}</p>
            </div>
        `;
    },

    _syncDetailCompareColumnTone(slot, company_code) {
        const col = document.getElementById(`detail_compare_col_${slot}`);
        if (!col) return;
        const hasSelection = !!company_code;
        col.classList.toggle('is-empty', !hasSelection);
        col.classList.toggle('is-selected', hasSelection);
    },

    _syncDetailCompareSelectValue(slot, company_code) {
        const select = document.querySelector(`.detail-compare-select[data-slot="${slot}"]`);
        if (!select) return;
        select.value = company_code || '';
        this._setDetailCompareSelectLabels(select, false);
    },

    _updateDetailCompareColumn(slot, company_code) {
        const body = document.getElementById(`detail_compare_col_${slot}_body`);
        if (!body) return;
        const coverage_cd = mmlfcp_state.get('detail_compare_coverage_cd');
        body.innerHTML = this._renderCoverageDetailColumnBody(company_code, coverage_cd);

        const meta = this._getCompanyMeta(company_code, this._getCompaniesWithCoverageDetail(coverage_cd));
        const productEl = document.getElementById(`detail_compare_col_${slot}_product`);
        if (productEl) {
            productEl.textContent = company_code ? (meta.product_name || '-') : '보험사를 선택해 주세요';
        }
        const premiumEl = document.getElementById(`detail_compare_col_${slot}_premium`);
        if (premiumEl) {
            premiumEl.textContent = this._getDetailComparePremiumText(company_code, coverage_cd);
        }
        this._syncDetailCompareColumnTone(slot, company_code);
        this._refreshDetailCompareMinHighlight();
    },

    _getDetailCompareColumnClass(company_code, slot) {
        const tone = company_code ? 'is-selected' : 'is-empty';
        return `detail-compare-col detail-compare-col--${slot} ${tone}`;
    },

    /**
     * 비교상품 자동 선정
     * - 비교상품1: 가장 저렴한 보험료 (선택 상품이 최저면 차순위)
     * - 비교상품2: 가장 비싼 보험료 (선택 상품이 최고면 차순위)
     */
    _pickDetailCompareCompanies(selectedCode, companies, coverage_cd) {
        const ranked = [...companies]
            .map((c) => ({
                company_code: c.company_code,
                premium: Number(this._getCoveragePremiumByCompany(c.company_code, coverage_cd)) || 0,
            }))
            .sort((a, b) => {
                if (a.premium !== b.premium) return a.premium - b.premium;
                return String(a.company_code).localeCompare(String(b.company_code));
            });

        const selected = ranked.find((c) => c.company_code === selectedCode)?.company_code
            || ranked[0]?.company_code
            || '';

        const cheapest = ranked.find((c) => c.company_code !== selected)?.company_code || '';
        const expensive = [...ranked]
            .reverse()
            .find((c) => c.company_code !== selected && c.company_code !== cheapest)
            ?.company_code || '';

        return {
            compare1: selected,
            compare2: cheapest,
            compare3: expensive,
        };
    },

    //플랜 상품보별보험료 상세보기 — 3개 보험사 담보 비교
    renderInsurPremiumsDetail(company_code, coverage_cd, page = 1) {
        const container = document.getElementById('priceList');
        if (!container) return;

        const companies = this._getCompaniesWithCoverageDetail(coverage_cd);
        const picked = this._pickDetailCompareCompanies(company_code, companies, coverage_cd);
        const compare1 = picked.compare1;
        const compare2 = picked.compare2;
        const compare3 = picked.compare3;

        mmlfcp_state.set('detail_compare_company_1', compare1);
        mmlfcp_state.set('detail_compare_coverage_cd', coverage_cd);
        mmlfcp_state.set('detail_compare_company_2', compare2);
        mmlfcp_state.set('detail_compare_company_3', compare3);

        const planCoverages = mmlfcp_state.get('plan_coverages') || [];
        const coverageName = planCoverages.find((c) => String(c.coverage_cd) === String(coverage_cd))?.coverage_name || '담보 상세';
        const selectedBySlot = { 1: compare1, 2: compare2, 3: compare3 };

        container.innerHTML = `
        <div class="detail-compare-modal">
            <div class="detail-compare-toolbar">
                <div class="detail-compare-heading">
                    <span class="detail-compare-kicker">보험사별 담보 비교</span>
                    <h2 class="detail-compare-title">${coverageName}</h2>
                    <p class="detail-compare-desc">보험사를 바꿔 가며 같은 담보의 보험료와 보장내용을 나란히 비교하세요.</p>
                </div>
                <button type="button" class="btn-priceList-cancel">닫기</button>
            </div>
            <div class="detail-compare-grid">
                <section class="${this._getDetailCompareColumnClass(compare1, 1)}" id="detail_compare_col_1">
                    ${this._renderDetailCompareColumnHeader(1, companies, compare1, coverage_cd, selectedBySlot)}
                    <div class="detail-compare-body" id="detail_compare_col_1_body">
                        ${this._renderCoverageDetailColumnBody(compare1, coverage_cd)}
                    </div>
                </section>
                <section class="${this._getDetailCompareColumnClass(compare2, 2)}" id="detail_compare_col_2">
                    ${this._renderDetailCompareColumnHeader(2, companies, compare2, coverage_cd, selectedBySlot)}
                    <div class="detail-compare-body" id="detail_compare_col_2_body">
                        ${this._renderCoverageDetailColumnBody(compare2, coverage_cd)}
                    </div>
                </section>
                <section class="${this._getDetailCompareColumnClass(compare3, 3)}" id="detail_compare_col_3">
                    ${this._renderDetailCompareColumnHeader(3, companies, compare3, coverage_cd, selectedBySlot)}
                    <div class="detail-compare-body" id="detail_compare_col_3_body">
                        ${this._renderCoverageDetailColumnBody(compare3, coverage_cd)}
                    </div>
                </section>
            </div>
        </div>
        `;

        this._refreshDetailCompareMinHighlight();
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
                // 선택 해제된 담보는 0을 희미하게 표시
                this.applyPremiumStyle(el, premiumValue, globalMax, globalMin, flags, { muted: !isSelected });
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


    /**
     * 입력폼 변경 시 자동 조회 (연쇄 변경·연타 대비 debounce)
     * softLoading: 전체 로더 대신 테이블만 살짝 흐리게 → 깜박임 감소
     */
    scheduleAutoSearch(delay = 350) {
        clearTimeout(this._autoSearchTimer);
        clearTimeout(this._searchStatusClearTimer);
        // debounce 대기 중에도 즉시 피드백 (전체 로더 없음)
        this.setSearchFeedback('pending', '조건 반영 중…');
        this._autoSearchTimer = setTimeout(() => {
            this.resetBeforeSearch();
            _state.current_page = 1;
            this.onClickSearch({ softLoading: true });
        }, delay);
    },

    /**
     * 자동 조회 상태 피드백 (헤더 만기 옆 칩 + 전체 로딩)
     * 조회 완료는 오른쪽 하단 토스트로 알림
     * @param {'idle'|'pending'|'loading'|'done'|'error'} state
     * @param {string} [message]
     */
    setSearchFeedback(state, message = '') {
        const statusEl = document.getElementById('searchStatus');
        const loaderText = document.getElementById('mainLoaderText');
        clearTimeout(this._searchStatusClearTimer);

        if (state === 'done') {
            if (statusEl) {
                statusEl.hidden = true;
                statusEl.textContent = '';
                statusEl.classList.remove('is-pending', 'is-loading', 'is-done', 'is-error');
            }
            this.showAppToast(message || '조회 완료', 'success');
            return;
        }

        if (statusEl) {
            statusEl.classList.remove('is-pending', 'is-loading', 'is-done', 'is-error');
            if (!state || state === 'idle') {
                statusEl.hidden = true;
                statusEl.textContent = '';
            } else {
                const labels = {
                    pending: message || '조건 반영 중…',
                    loading: message || '조회 중…',
                    error: message || '조회 실패',
                };
                statusEl.hidden = false;
                statusEl.textContent = labels[state] || message || '';
                statusEl.classList.add(`is-${state}`);
            }
        }

        if (loaderText && (state === 'loading' || state === 'pending')) {
            loaderText.textContent = message || (state === 'pending' ? '조건을 반영하는 중…' : '보험료를 조회하는 중…');
        }
    },

    /**
     * 오른쪽 하단 토스트 알림
     * @param {string} message
     * @param {'success'|'error'|'info'} [type]
     */
    showAppToast(message, type = 'info') {
        const text = String(message || '').trim();
        if (!text) return;

        let host = document.getElementById('appToastHost');
        if (!host) {
            host = document.createElement('div');
            host.id = 'appToastHost';
            host.className = 'app-toast-host';
            host.setAttribute('aria-live', 'polite');
            document.body.appendChild(host);
        }

        const toast = document.createElement('div');
        toast.className = `app-toast app-toast--${type}`;
        toast.setAttribute('role', 'status');
        toast.textContent = text;
        host.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('is-visible');
        });

        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 280);
        }, 2400);
    },

    /**
     * select: 값이 바뀌거나, 같은 옵션을 다시 골라도 콜백 실행
     * (네이티브 change는 동일 값 재선택 시 발생하지 않음 → blur로 보완)
     * 목록 열림 시 배경 블러(passive) 표시
     */
    bindSelectAutoSearch(sel, onSelect, options = {}) {
        if (!sel || typeof onSelect !== 'function') return;
        const backdropOwner = options.backdropOwner || sel.id || 'select';
        let pending = false;
        let changed = false;
        let running = false;

        const showBackdrop = () => {
            this.setHeaderMenuBackdrop(true, { interactive: false, owner: backdropOwner });
        };
        const hideBackdrop = () => {
            this.setHeaderMenuBackdrop(false, { owner: backdropOwner });
        };
        const runSelect = () => {
            if (running) return;
            running = true;
            try {
                onSelect();
            } finally {
                setTimeout(() => { running = false; }, 30);
            }
        };

        sel.addEventListener('mousedown', () => {
            pending = true;
            changed = false;
            showBackdrop();
        });
        sel.addEventListener('focus', showBackdrop);
        sel.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                pending = true;
                changed = false;
                showBackdrop();
            }
        });
        sel.addEventListener('change', () => {
            changed = true;
            pending = false;
            hideBackdrop();
            runSelect();
        });
        sel.addEventListener('blur', () => {
            hideBackdrop();
            if (!pending || changed) {
                pending = false;
                changed = false;
                return;
            }
            pending = false;
            setTimeout(() => {
                if (changed) return;
                runSelect();
            }, 0);
        });
    },

    //--------  초기 setting ---------- ///
    async onClickSearch(options = {}) {
        const softLoading = !!options.softLoading;

        // 1) 생년월일 및 나이 기초 데이터 확인
        const birthEl = document.getElementById('birth_date');
        const birth_date = birthEl ? this.getBirthDateYmd() : mmlfcp_state.get('birth_date');

        //2) 검증
        if (!app.isValidDate(birth_date)) {
            this.setSearchFeedback('error', '생년월일을 확인해 주세요');
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

        // 플랜 ID가 없으면 중단
        if (!plan_id) {
            const planName = mmlfcp_state.get('plan_type_name') || '선택한 상품유형';
            this.setSearchFeedback('error', '플랜을 찾을 수 없습니다');
            this.showEmptySearchResult(`「${planName}」에 맞는 플랜을 찾을 수 없습니다.`);
            return;
        }

        // 4) 호출 시작 (조건변경 자동조회는 soft — 전체 화면 로더로 깜박이지 않음)
        this.setLoading(true, { soft: softLoading });
        try {
            const res = await apiService.getProductPremiums({ plan_id, insurance_type, age, gender });
            if (res?.is_success == true && (res.coverage_premiums.length > 0 && res.product_insur_premiums.length > 0)) {

                mmlfcp_state.set('plan_coverages', res.plan_coverages || []);
                mmlfcp_state.set('required_premiums', res.required_premiums || []);
                mmlfcp_state.set('coverage_premiums', res.coverage_premiums || []);
                mmlfcp_state.set('product_insur_premiums', res.product_insur_premiums || []);

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

                // 저장된 '기본 플랜' 선호값 반영 후 옵션 구성
                userController.applyResolvedDefaultPlan();

                //버튼 활성화
                this.setDetailMenu();

                //상품유형 비교 버튼 활성화
                this.setSimplifiDetailMenu();

                this.render_coverage_bojang();


                //화면보이기
                this.hideEmptySearchResult();
                this.show_content();
                this.setSearchFeedback('done', '조회 완료');
            }
            else {
                const planName = mmlfcp_state.get('plan_type_name') || '선택한 상품유형';
                this.setSearchFeedback('error', '데이터 없음');
                this.showEmptySearchResult(`「${planName}」에 해당하는 보험료 데이터가 없습니다.`);
                return;
            }
        }
        catch (err) {
            console.error("[상품별 보험료 조회 중 오류 발생]", err);
            this.setSearchFeedback('error', '조회 실패');
            this.showEmptySearchResult(err?.message || '조회 중 오류가 발생했습니다.');
            return;
        }
        finally {
            this.setLoading(false, { soft: softLoading });
        }
    },

    /** 조회 결과 없음 안내 */
    showEmptySearchResult(message) {
        const empty = document.getElementById('searchEmptyState');
        const msgEl = document.getElementById('searchEmptyMessage');
        const table = document.querySelector('.product-table-wrap');

        if (msgEl) {
            msgEl.textContent = message || '선택한 상품유형에 해당하는 보험료 데이터가 없습니다.';
        }
        if (empty) empty.hidden = false;
        if (table) table.style.display = 'none';

        // 이전 조회 잔여 데이터 비우기
        const bojang = document.getElementById('bojang_lists');
        const company = document.getElementById('companyInfo');
        const premium = document.getElementById('premium_lists');
        const pager = document.getElementById('div-page-btn');
        if (bojang) bojang.innerHTML = '';
        if (company) company.innerHTML = '';
        if (premium) premium.innerHTML = '';
        if (pager) pager.innerHTML = '';

        mmlfcp_state.set('coverage_premiums', []);
        mmlfcp_state.set('product_insur_premiums', []);

        this.show_content();
    },

    hideEmptySearchResult() {
        const empty = document.getElementById('searchEmptyState');
        const table = document.querySelector('.product-table-wrap');
        if (empty) empty.hidden = true;
        if (table) table.style.display = '';
    },

    async onClickPrint() {
        this.setLoading(true);
        try {
            const printData = this.setCoveragesPrintData();
            const response = await apiService.PrintProducts(printData);

            if (response.is_success == true) {
                // pdf_uri는 /reportfiles/... 형태 — 이중 슬래시 방지 + JWT 헤더로 다운로드
                const pdfPath = String(response.pdf_uri || '').replace(/^\/+/, '');
                const printUrl = `${location.protocol}//${location.host}/${pdfPath}`;
                const blob = await apiService.fetchAuthorizedBlob(printUrl);
                const blobUrl = URL.createObjectURL(blob);

                if (appConstants.device == 'APP') {
                    const link = document.getElementById('pdfDownloadLink');
                    link.href = blobUrl;
                    link.click();
                } else {
                    window.open(blobUrl, '_blank');
                }
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
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
        // 상단 보험사 헤더 ↔ 하단 보험료 목록 가로 스크롤 동기화
        this.ensureCompanyTableScrollSync();

        const custEl = document.getElementById('cust_name');
        const birthEl = document.getElementById('birth_date');
        const genderSel = document.getElementById('gender');
        const insurSel = document.getElementById('selInsuranceType');
        const paySel = document.getElementById('selPaymentExpirationCD');

        const bojangList = document.getElementById('bojang_lists');
        const companyList = document.getElementById('companyInfo');
        const container = document.getElementById('priceList');
        const premiumListContainer = document.getElementById('premium_lists');
        const sortBtn = document.getElementById('sort_total_premium');

        const printBtn = document.getElementById('coverage_btn_print');

        //엑셀로 출력하기
        const printExcelBtn = document.getElementById('print-excel');

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
                this.scheduleAutoSearch(500);
            });
        }


        // 생년월일 — 캘린더 선택
        if (birthEl) {
            this.syncBirthDateInput();
            const onBirthChange = () => this.applyBirthDateChange(birthEl.value);
            birthEl.addEventListener('change', onBirthChange);
            birthEl.addEventListener('input', onBirthChange);
        }


        // 성별 / 생손보 / 만기 — 상품유형과 동일한 커스텀 피커
        this.bindHeaderSelectPickers();
        this._headerSelectPickerHandlers = {
            gender: () => {
                const genderSel = document.getElementById('gender');
                mmlfcp_state.set('gender', genderSel?.value || '');
                // 남성 ↔ 여성 전환 시 여성 전용 상품 노출/숨김 반영
                this.setPlanPickerOpen(false);
                this.renderPlanOptions();
                this.renderPayTermBySelectedPlan();
                this.updatePlanIdByCurrentState();
                this.handleGenderByPlan(mmlfcp_state.get('plan_type_id'));
                this.renderPayTermSelectedAge();
                this.scheduleAutoSearch();
            },
            insurance: () => {
                const insurSel = document.getElementById('selInsuranceType');
                const nextType = insurSel?.value || '';
                mmlfcp_state.set('insurance_type', nextType);
                this.setPlanPickerOpen(false);

                // 손보 선택 시 상품유형 기본값: 종합(무해지)
                if (nextType === 'F') {
                    this.applyFireDefaultPlanType();
                }

                this.renderPlanOptions();
                this.renderPayTermBySelectedPlan();
                this.updatePlanIdByCurrentState();
                this.renderPayTermSelectedAge();
                this.scheduleAutoSearch();
            },
            payterm: () => {
                const paySel = document.getElementById('selPaymentExpirationCD');
                if (!paySel || paySel.selectedIndex === -1) return;
                const selectedOption = paySel.selectedOptions[0];
                mmlfcp_state.set('plan_payment_expiration_cd', paySel.value);
                mmlfcp_state.set('plan_payment_expiration_name', selectedOption.textContent);
                this.updatePlanIdByCurrentState();
                this.renderPayTermSelectedAge();
                this.scheduleAutoSearch();
            },
        };

        // 상품 유형 단일 피커 (세부 선택 시에만 조회)
        this.bindPlanPickerEvents();


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


        //보험료 합계 정렬 (오름차순 ↔ 내림차순 토글)
        if (sortBtn) {
            sortBtn.addEventListener("click", () => {
                //1. 정렬 방향 토글
                this.setCoverageSortPremium({ toggle: true });

                //2. 보장정보
                this.renderPlanCoverages();

                //3. 회사정보
                this.renderRequiredPremiums(1);

                //4. 보장별 보험료 정보
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

                // 생손보·상품유형·만기 조건에 맞춰 출력 항목 표시/숨김
                this.setPrintliMenu();

                const title01 = document.getElementById("title01");
                if (title01 && !title01.closest('li')?.hidden) {
                    title01.checked = true;
                } else {
                    this._ensureVisiblePrintOptionSelected();
                }

                // modal01 표시 (fade 효과 제거 → 깔끔하게 block만)
                const modal = document.querySelector(".modal01");
                if (modal) {
                    modal.style.display = "block";
                }

                //모두보기로 강제 "설정"
                this.setDefaultAllFilter();

                //최초에 모두보기 상태로 setting
                this.setPlanCoverage_Display("all");

                // 보험료 최대, 최소값, 보험료 합계 정렬
                this.setCoverageSortPremium();

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

        //엑셀로 출력하기 클릭
        if (printExcelBtn) {
            printExcelBtn.addEventListener("click", async () => {

                //엑셀 출력
                excelController.exportToExcel();

                //엑셀 로그 남기기
                excelController.exportExcelLog();
            });
        }


        const isToolbarActionEnabled = (btn) =>
            !!btn && !btn.disabled && !btn.hidden && !btn.classList.contains('is-toolbar-hidden');

        //보험료 최저 vs 최대
        if (detailModalBtn) {
            detailModalBtn.addEventListener("click", () => {
                if (!isToolbarActionEnabled(detailModalBtn)) return;
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
                    this.openDetailModal('premium');

                }
            });
        }

        //만기별 보험료 비교
        if (detailPaymentModalBtn) {
            detailPaymentModalBtn.addEventListener("click", () => {
                if (!isToolbarActionEnabled(detailPaymentModalBtn)) return;
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
                    this.openDetailModal('payment');
                }
            });
        }

        //연령별 보험료 비교
        if (detailAgingModalBtn) {
            detailAgingModalBtn.addEventListener("click", () => {
                if (!isToolbarActionEnabled(detailAgingModalBtn)) return;
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
                    this.openDetailModal('aging');
                }
            });
        }

        //상품유형별 보험료
        if (detailCoveragcemodalBtn) {
            detailCoveragcemodalBtn.addEventListener("click", () => {
                if (!isToolbarActionEnabled(detailCoveragcemodalBtn)) return;
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

                this.renderInsurPremiumsDetail(company_code, coverage_cd, _state.current_page || 1);
                this.show_layer();
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


        // ✅ 담보 일괄선택 (전체선택 / 전체해제 / 초기값으로)
        const bulkSelect = document.getElementById('coverage_bulk_select');
        if (bulkSelect) {
            bulkSelect.addEventListener('change', (e) => {
                const action = e.target.value;
                if (!action) return;

                if (action === 'all') {
                    this.setPlanCoverage_Display_all('checked');
                } else if (action === 'none') {
                    this.setPlanCoverage_Display_all('');
                } else if (action === 'default') {
                    this.setPlanCoverage_Display_default();
                }

                // 가입/미가입 필터 중이면 표시 상태 재적용
                const activeFilter = document.querySelector('#coverageFilters input[type="checkbox"]:checked');
                if (activeFilter) {
                    this.setPlanCoverage_Display(activeFilter.id);
                }

                this.calculatePremiums();
                e.target.value = '';

                requestAnimationFrame(() => {
                    this.renderPlanCoverages();
                    this.renderRequiredPremiums(_state.current_page || 1);
                    this.renderCoveragePremiums(_state.current_page || 1);
                });
            });
        }



        // 담보 상세 비교 — 목록 열 때 보험료 표시 / 닫히면 보험사명만
        container.addEventListener("focusin", (e) => {
            const select = e.target.closest('.detail-compare-select');
            if (!select) return;
            this._setDetailCompareSelectLabels(select, true);
        });

        container.addEventListener("mousedown", (e) => {
            const select = e.target.closest('.detail-compare-select');
            if (!select) return;
            this._setDetailCompareSelectLabels(select, true);
        });

        container.addEventListener("focusout", (e) => {
            const select = e.target.closest('.detail-compare-select');
            if (!select) return;
            requestAnimationFrame(() => {
                if (document.activeElement === select) return;
                this._setDetailCompareSelectLabels(select, false);
            });
        });

        // 담보 상세 비교 — 보험사 선택
        container.addEventListener("change", (e) => {
            const select = e.target.closest('.detail-compare-select');
            if (!select) return;
            const slot = Number(select.dataset.slot);
            const company_code = select.value;

            // 다른 카드에서 이미 선택된 보험사는 선택 불가
            if (company_code) {
                const taken = [1, 2, 3]
                    .filter((s) => s !== slot)
                    .map((s) => mmlfcp_state.get(`detail_compare_company_${s}`) || '')
                    .filter(Boolean);
                if (taken.includes(company_code)) {
                    select.value = mmlfcp_state.get(`detail_compare_company_${slot}`) || '';
                    this._refreshDetailCompareSelectAvailability();
                    return;
                }
            }

            if (slot === 1) {
                const coverage_cd = mmlfcp_state.get('detail_compare_coverage_cd');
                const companies = this._getCompaniesWithCoverageDetail(coverage_cd);
                const picked = this._pickDetailCompareCompanies(company_code, companies, coverage_cd);
                mmlfcp_state.set('detail_compare_company_1', picked.compare1);
                mmlfcp_state.set('detail_compare_company_2', picked.compare2);
                mmlfcp_state.set('detail_compare_company_3', picked.compare3);
                this._updateDetailCompareColumn(1, picked.compare1);
                this._syncDetailCompareSelectValue(2, picked.compare2);
                this._syncDetailCompareSelectValue(3, picked.compare3);
                this._updateDetailCompareColumn(2, picked.compare2);
                this._updateDetailCompareColumn(3, picked.compare3);
                this._setDetailCompareSelectLabels(select, false);
                document.querySelectorAll('.detail-compare-select').forEach((el) => {
                    this._setDetailCompareSelectLabels(el, false);
                });
                return;
            }

            if (slot === 2) mmlfcp_state.set('detail_compare_company_2', company_code);
            if (slot === 3) mmlfcp_state.set('detail_compare_company_3', company_code);
            this._updateDetailCompareColumn(slot, company_code);
            this._setDetailCompareSelectLabels(select, false);
        });

        //닫기 버튼 클릭 이벤트
        container.addEventListener("click", (e) => {
            const closeBtn = e.target.closest('.btn-priceList-cancel');
            if (closeBtn) {
                const modal = document.querySelector('.modal02');
                if (!modal) {
                    console.warn("modal02 요소가 아직 없습니다.");
                    return;
                }
                this._closeModal02(modal);
            }
        });

        // --- modal02, modal03 배경 클릭 → 닫기 (이벤트 위임) ---
        document.addEventListener("click", (e) => {
            const bgEl = e.target.closest('.modal02 .bg, .modal03 .bg');
            if (!bgEl) return;

            // modal02는 전체화면 content가 area 안에 있으므로 bg 클릭만 닫기
            if (e.target !== bgEl && !e.target.classList.contains('bg')) return;

            const modal = bgEl.closest('.modal02, .modal03');
            if (!modal) return;

            if (modal.classList.contains('modal02')) {
                this._closeModal02(modal);
            } else {
                modal.style.display = 'none';
                const bottomContent = document.querySelector('.bottom-content .bottom');
                if (bottomContent) bottomContent.style.display = 'block';
                document.body.classList.remove('modal');
                document.body.style.overflow = '';
            }
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


    //로딩바 + 조회 중 피드백
    // soft=true: 전체 화면 로더 없이 테이블만 흐리게 (조건 변경 자동조회 깜박임 방지)
    setLoading(on, options = {}) {
        const soft = !!options.soft;

        if (soft) {
            document.body.classList.toggle('is-searching-soft', !!on);
            document.body.classList.remove('is-searching');
            const $loader = document.getElementById('mainLoader') || document.querySelector('.loader-container');
            if ($loader) {
                $loader.classList.remove('is-active');
                $loader.style.display = 'none';
                $loader.setAttribute('aria-hidden', 'true');
            }
            if (on) {
                this.setSearchFeedback('loading', '조회 중…');
            }
            return;
        }

        document.body.classList.remove('is-searching-soft');
        const $loader = document.getElementById('mainLoader') || document.querySelector('.loader-container');
        if ($loader) {
            $loader.classList.toggle('is-active', !!on);
            $loader.style.display = on ? 'flex' : 'none';
            $loader.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
        document.body.classList.toggle('is-searching', !!on);
        if (on) {
            this.setSearchFeedback('loading', '조회 중…');
        }
    },

    /**
    * 버튼 스타일 적용 (선택 여부에 따라)
    */
    setPageButtonStyle(btn, isActive) {
        btn.classList.toggle('is-active', !!isActive);
    },


    /** 생보사 여부 (보험사명 녹색 표시 대상) */
    isLifeInsuranceCompany(company_code, company_name) {
        const code = String(company_code || '').trim().toUpperCase();
        const name = String(company_name || '').trim();
        // 손보 명시(롯데손해 LO 등) — L로 시작하는 손보 코드 오분류 방지
        if (/손해|화재|해상/.test(name)) return false;
        if (/생명|라이프/.test(name)) return true;
        // 생보 코드는 L + 2글자 이상(LHE, LSA…). LO(롯데손보) 등 2글자는 제외
        if (/^L[A-Z0-9]{2,}$/i.test(code)) return true;
        return false;
    },

    /**
      * 특정 셀에 보험료 숫자 + 색상 적용 (공용)
      * @param {{ muted?: boolean }} [options] muted=true → 선택 해제 담보 0 희미 표시
      */
    applyPremiumStyle(el, premium, maxVal, minVal, flags, options = {}) {

        // 클래스 초기화
        el.classList.remove('company__red', 'company__blue', 'company__black', 'company__muted');

        // 보험료 포맷팅
        const formattedPremium = app.formatNumber(premium);
        el.textContent = formattedPremium;

        // 선택 해제된 담보: 0을 희미하게
        if (options.muted) {
            el.classList.add('company__muted');
            return;
        }

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
        if (!modal) return;

        const bg = modal.querySelector('.bg');
        const area = modal.querySelector('.area');
        const contentList = modal.querySelector('.content_list');

        modal.style.display = 'block';
        modal.style.opacity = '1';
        modal.style.zIndex = '1000000';

        if (bg) {
            bg.style.zIndex = '1';
        }
        if (area) {
            area.style.zIndex = '2';
            area.style.pointerEvents = 'none';
        }
        if (contentList) {
            contentList.style.zIndex = '3';
            contentList.style.pointerEvents = 'auto';
            contentList.style.position = 'relative';
            contentList.style.width = '100%';
            contentList.style.height = '100%';
            contentList.style.display = 'flex';
            contentList.style.flexDirection = 'column';
        }

        const sb = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty(
            '--scrollbar-compensation',
            `${sb > 0 ? sb : 0}px`
        );
        document.body.classList.add('modal');
        document.body.style.overflow = 'hidden';
    },

    _closeModal02(modal) {
        if (!modal) return;

        modal.style.display = 'none';

        const bottomContent = document.querySelector('.bottom-content .bottom');
        if (bottomContent) bottomContent.style.display = 'block';

        document.body.classList.remove('modal');
        document.body.style.overflow = '';
        if (!document.body.classList.contains('notice-popup-open')) {
            document.documentElement.style.removeProperty('--scrollbar-compensation');
        }
    },

    wrapWindowByMask() {
        const mask = document.querySelector('.modal02');
        if (!mask) return;

        mask.style.width = '100vw';
        mask.style.height = '100vh';
        mask.style.position = 'fixed';
        mask.style.top = '0';
        mask.style.left = '0';
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




    // 공용 오픈 함수 (index 통합 세부 비교 뷰)
    openDetailModal(tabName = 'premium') {
        if (appConstants.jwt) {
            try { sessionStorage.setItem('mmlfcp_auth_token', appConstants.jwt); } catch (_) { /* ignore */ }
        }
        compareView.invalidate();
        compareView.open(tabName || 'premium');
        try {
            history.pushState({ detailCompare: true }, '', '');
        } catch (_) { /* ignore */ }
    },

    //상품유형별 보험료 비교 열기
    openPlanDetailModalBtn() {
        if (appConstants.jwt) {
            try { sessionStorage.setItem('mmlfcp_auth_token', appConstants.jwt); } catch (_) { /* ignore */ }
        }
        compareView.invalidate();
        compareView.open('simplifi');
        try {
            history.pushState({ detailCompare: true }, '', '');
        } catch (_) { /* ignore */ }
    },


    _setlocalItem() {
        // UI 테마 키는 유지 (clear 시 테마 초기화 방지)
        const preserveKeys = [
            'mmlfcp_ui_theme',
            'mmlfcp_ui_mode',
            'mmlfcp_ui_font',
            'mmlfcp_ui_custom_color',
            'mmlfcp_ui_ga_brand',
            'mmlfcp_default_user_plans',
        ];
        const preserved = {};
        preserveKeys.forEach((k) => {
            const v = localStorage.getItem(k);
            if (v != null) preserved[k] = v;
        });

        localStorage.clear();
        Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));

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

        //체크한 coverage_cd, company_code (CSV 문자열로 저장 — 객체 {} 저장 시 detail_c 에서 .split 오류)
        const covChecked = mmlfcp_state.get('coverage_cd_checked');
        const coChecked = mmlfcp_state.get('company_code_checked');
        const covCsv = (typeof covChecked === 'string' && covChecked)
            ? covChecked
            : (this.checked_coverage_cd() || '');
        const coCsv = (typeof coChecked === 'string' && coChecked)
            ? coChecked
            : (this.checked_company_code() || '');
        localStorage.setItem("coverage_cd_checked", JSON.stringify(covCsv));
        localStorage.setItem("company_code_checked", JSON.stringify(coCsv));
    },


    //내부에서만 쓰는 실제 실행 함수 (레거시 iframe 호환 — 미사용 시 no-op)
    _showModal(modal, iframe, url) {
        if (iframe) {
            iframe.removeAttribute("src");
            iframe.setAttribute("src", url);
        }
        if (modal) {
            modal.style.display = "block";
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

        const show = !!isShow;
        el.classList.toggle('is-toolbar-hidden', !show);
        el.hidden = !show;
        el.setAttribute('aria-hidden', show ? 'false' : 'true');
        if ('disabled' in el) el.disabled = !show;
        // 인라인 스타일 잔여값 제거 (과거 opacity/display 충돌 방지)
        el.style.removeProperty('opacity');
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('pointer-events');
    }

}
