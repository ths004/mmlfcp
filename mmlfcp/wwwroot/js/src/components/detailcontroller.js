import { app } from '../utils/app.js';
import { apiService } from '../services/apiService.js';

const detail_coverage = {

    cust_name: '',
    birth_date: '',
    age: 0,
    gender: '',

    insurance_type: '',

    plan_id: '',
    plan_type_id: '',
    plan_type_name: '',


    plan_payment_expiration_cd: '',
    plan_payment_expiration_name: '',

    plan_coverages: [],
    coverage_premiums: [],
    product_insur_premiums: [],

    //연령별
    coverage_premiums_by_ages: [],
    coverage_required_premiums_by_ages: [],
    coverage_premiums_by_ages_totals: [],

    //만기별
    payterm_coverage_premiums: [],
    payterm_required_coverage_premiums: [],

    guide_coverage_detail_item: new Map(),
    coverage_ratio_map: {},
    companyRows: [],
};

export const detailController = {
    _eventsBound: false,
    /** 최저/최대 보장 상세 정렬: key=seq|name|min|max, dir=asc|desc */
    _minmaxDetailSort: { key: 'seq', dir: 'asc' },

    setLoading(on) {
        const loader = document.getElementById('detailLoader');
        if (!loader) return;
        loader.classList.toggle('is-active', !!on);
        loader.style.display = on ? 'flex' : 'none';
        loader.setAttribute('aria-busy', on ? 'true' : 'false');
    },

    _detailRoot() {
        return document.getElementById('detailCompareView') || document;
    },

    async init() {
        this.setLoading(true);
        try {
            //2.  로컬스토리지에서 기본 정보 로드
            this.loadBasicInfo();

            //3. 이벤트 실행
            this.setcoverageDisplayonMenu();

            //4. coverage_premiums setting
            this.setcoverageDetailMap();

            await Promise.all([this.getProductPremiumsByAges(), this.getPaytermCoveragePremiums()]);
            //5. rendering
            this.setActiveTabUI();

            //6. events (index 통합 뷰에서는 compareView/detailTabs가 탭 전환)
            this.detail_bindEvents();
        } catch (err) {
            console.error("[연령별/ 만기별 보험료 조회 시 오류 발생]", err);
            alert(err.message);
        } finally {
            this.setLoading(false);
        }
    },

    loadBasicInfo() {
        detail_coverage.cust_name = localStorage.getItem('cust_name') || '';
        detail_coverage.birth_date = localStorage.getItem('birth_date') || '';
        detail_coverage.age = localStorage.getItem('age') || 0;
        detail_coverage.gender = localStorage.getItem('gender') || '';

        detail_coverage.insurance_type = localStorage.getItem('insurance_type') || 'F';


        detail_coverage.plan_id = localStorage.getItem('plan_id') || '';
        detail_coverage.plan_type_id = localStorage.getItem('plan_type_id') || '';
        detail_coverage.plan_type_name = localStorage.getItem('plan_type_name') || '';

        detail_coverage.plan_payment_expiration_cd = localStorage.getItem('plan_payment_expiration_cd') || '';
        detail_coverage.plan_payment_expiration_name = localStorage.getItem('plan_payment_expiration_name') || '';


        detail_coverage.plan_coverages = this._parseLocalJson("plan_coverages", []);
        detail_coverage.coverage_premiums = this._parseLocalJson("coverage_premiums", []);
        detail_coverage.product_insur_premiums = this._parseLocalJson("product_insur_premiums", []);
        detail_coverage.coverage_ratio_map = this._parseLocalJson("coverage_ratio_map", {});

        //console.log(detail_coverage);
    },

    /** localStorage JSON 안전 파싱 (|| [] / || {} 를 JSON.parse에 넘기면 예외) */
    _parseLocalJson(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },

    // detailcontroller.js 수정

    setActiveTabUI() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = window.__detailCompareTab || urlParams.get('tab') || 'premium';
        if (tabId === 'simplifi') return;

        console.log(`[setActiveTabUI] ${tabId} 보여짐`);

        const root = this._detailRoot();
        const tabs = root.querySelectorAll('.tab-list li[data-detail-tab]');
        const contents = root.querySelectorAll('.tab-content');
        const classMap = {
            premium: 'content01',
            payment: 'content03',
            aging: 'content04',
            simplifi: 'content02',
        };

        tabs.forEach((li) => {
            const id = li.getAttribute('data-detail-tab') || li.id;
            li.classList.toggle('active', id === tabId);
        });

        const targetClass = classMap[tabId] || 'content01';
        contents.forEach((section) => {
            section.classList.toggle('show', section.classList.contains(targetClass));
        });

        this.renderTabContent(tabId);
    },

    // 탭별 렌더링 함수를 분기 처리하는 헬퍼 함수
    renderTabContent(tabId) {
        console.log(`[Tab Change] ${tabId} 렌더링 실행`);
        switch (tabId) {
            case "premium":
                this.coverage_min_max_detail(); // 보험료 최저vs최대 렌더링
                break;
            case "payment":
                this.coverage_payment_detail(); // 만기 보험료 비교 렌더링
                break;
            case "aging":
                this.coverage_aging_detail();   // 연령별 보험료 비교 렌더링
                break;
        }
    },

    /** 탭 전환 — 화면 전환 시 짧은 로딩 표시 */
    async switchTabContent(tabId) {
        this.setLoading(true);
        try {
            await new Promise((r) => setTimeout(r, 80));
            this.renderTabContent(tabId);
        } finally {
            this.setLoading(false);
        }
    },


    //연령별 보험료 조회 API
    async getProductPremiumsByAges() {
        try {
            const { plan_id, insurance_type, age, gender } = detail_coverage;
            const res = await apiService.getProductPremiumsByAges({ plan_id, insurance_type, age, gender });
            if (res?.is_success) {
                // detail_coverage 에 저장
                detail_coverage.coverage_premiums_by_ages = res.coverage_premiums_by_ages || [];
                detail_coverage.coverage_required_premiums_by_ages = res.coverage_required_premiums_by_ages || [];

                //setting
                this.setAgeCoveragePremiums();
            }
        }
        catch (err) {
            console.error("[연령별 보험료 비교 조회 중 오류 발생]", err);
            alert(err.message);
            return;
        }
    },

    //만기별 보험료 조회 API
    async getPaytermCoveragePremiums() {
        try {
            const { plan_id, plan_type_id, insurance_type, plan_payment_expiration_cd, age, gender } = detail_coverage;
            const res = await apiService.getPaytermCoveragePremiums({ plan_id, plan_type: plan_type_id, insurance_type, plan_payterm_type: plan_payment_expiration_cd, age, gender });
            if (res?.is_success) {

                detail_coverage.payterm_coverage_premiums = res.payterm_coverage_premiums || [];
                detail_coverage.payterm_required_coverage_premiums = res.payterm_required_coverage_premiums || [];

                //setting
                this.setPaytermCoveragePremiums();
            }
        }
        catch (err) {
            console.error("[만기별 보험료 조회 중 오류 발생]", err);
            alert(err.message);
            return;
        }
    },

    //화면 display setting
    setcoverageDisplayonMenu() {
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

        const plan_type_id = detail_coverage.plan_type_id; //01 - 상품유형 코드 
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name; //20년/100세 -> 만기명


        //1️⃣ 기본 탭 상태(전부 숨김)
        const menu = {
            premium: false, // 보험료 최저vs최대
            payment: false, // 만기 보험료 비교
            aging: false,   // 연령대별 보험료 비교
            simplifi: false // 상품유형별 보험료 비교
        };


        // 2️⃣ 상품유형 분류
        const BASE_TARGET_PRODUCTS = [
            "05", "06", "07", // 종합
            "14", "15", "16", "17",// 간편 325/335/355/31010
            "18", "19",// 어린이
            "20", "21", "22",// 청소년
            "25", //생보 치매(무해지)
        ];

        const BASE_SIMPLIFI = ["06", "07", "14", "15", "16", "17", "21", "22", "09", "11", "12", "13"];

        // 여성건강무해지
        const FEMALE_HEALTH = "08";

        // plan_payment_expiration_name.includes("갱신") ||

        // 3️⃣ 만기 조건 판별
        const isRenewalExpiration =
            plan_payment_expiration_name.includes("종신") ||
            plan_payment_expiration_name.includes("20년/100세,종신");

        // 4️⃣ 예외 조건 먼저 처리 (중요!)
        // 🔹 예외 1: 여성건강무해지
        if (plan_type_id === FEMALE_HEALTH) {
            menu.payment = true;
            menu.aging = true;
        }
        // 🔹 예외 3: 특정 만기 조건
        else if (isRenewalExpiration) {
            menu.premium = true;
            menu.aging = true;
        }

        // 5️⃣ 기본 대상 상품
        else if (BASE_TARGET_PRODUCTS.includes(plan_type_id)) {
            menu.premium = true;
            menu.payment = true;
            menu.aging = true;
        }
        //나머지 상품
        else {
            menu.premium = true;
            menu.aging = true;
        }

        if (BASE_SIMPLIFI.includes(String(plan_type_id))) {
            menu.simplifi = true;
        }

        // 한꺼번에 변경 사항을 모아서 브라우저에 전달합니다.
        window.requestAnimationFrame(() => {
            this.toggleMenu("premium", menu.premium);
            this.toggleMenu("payment", menu.payment);
            this.toggleMenu("aging", menu.aging);
            this.toggleMenu("simplifi", menu.simplifi);
        });
    },


    //보험료 최저 vs 최대 값 setting
    setcoverageDetailMap() {
        // 변수 선언
        const coverage_premiums = detail_coverage.coverage_premiums || [];
        //초기화
        detail_coverage.guide_coverage_detail_item = new Map();

        coverage_premiums.forEach(company => {
            company.detailList.forEach((detail, j) => {
                const key = company.company_code + detail.coverage_cd;

                // 항상 배열 보장
                if (!detail_coverage.guide_coverage_detail_item.has(key)) {
                    detail_coverage.guide_coverage_detail_item.set(key, []);
                }

                const arr = detail_coverage.guide_coverage_detail_item.get(key);

                // 혹시라도 기존 값이 숫자로 남아있을 경우 대비 → 배열로 변환
                if (!Array.isArray(arr)) {
                    detail_coverage.guide_coverage_detail_item.set(key, [arr]);
                }

                detail_coverage.guide_coverage_detail_item.get(key).push(j);
            });
        });
    },

    //연령별 보험료 비교 setting
    setAgeCoveragePremiums() {
        // 1. 데이터 가져오기 및 초기화
        const products = detail_coverage.coverage_premiums_by_ages || [];
        const main_coverage_premiums = detail_coverage.coverage_premiums || []; // 상품별 보장 리스트
        const plan_coverages = detail_coverage.plan_coverages || []; // 담보 리스트
        const ratioMap = detail_coverage.coverage_ratio_map || {}; // 비율 맵
        const totalsMap = new Map();

        if (!products.length) return;

        // 2. 효율적인 조회를 위한 Map 생성 (동기화 용)
        const companyDispMap = new Map(main_coverage_premiums.map(c => [c.company_code, c.DispValue]));
        const coverageSelectedMap = new Map(plan_coverages.map(p => [p.coverage_cd, p.plan_coverage_selected]));

        // 3. 제품(product) 순회하며 데이터 가공 및 합산 처리
        for (const product of products) {
            // ✅ [동기화] 회사 노출 여부 (메인에 없으면 false)
            product.DispValue = companyDispMap.has(product.company_code) ? companyDispMap.get(product.company_code) : false;

            const { company_code, age, detailList } = product;
            if (!Array.isArray(detailList)) continue;

            let total_premium = 0;

            for (const detail of detailList) {
                // ✅ [동기화] 각 담보별 선택 상태 반영
                detail.cover_selected = coverageSelectedMap.get(detail.coverage_cd) === 'checked' ? 'checked' : '';

                // ✅ 금액 및 보험료 계산 (비율 반영)
                detail.base_premium ??= (detail.guide_coverage_premium || 0);

                const ratio = ratioMap[detail.coverage_cd] ?? 1;

                detail.base_coverage_amount = Math.floor(ratio * (detail.guide_coverage_amount || 0));
                detail.base_premium = Math.floor(ratio * (detail.base_premium || 0));

                // ✅ 선택된 담보만 합계 보험료에 누적 (회사가 노출될 때만 계산)
                if (product.DispValue && detail.cover_selected === 'checked') {
                    total_premium += detail.base_premium || 0;
                }
            }


            // 4. 회사별/연령별 totalsMap 데이터 누적
            if (product.DispValue) {
                const companyData = totalsMap.get(company_code) ?? { company_code, totals: {} };
                companyData.totals[age] = total_premium;
                totalsMap.set(company_code, companyData);
            }
        }
        // 5. 최종 상태 반영
        detail_coverage.coverage_premiums_by_ages = products;
        detail_coverage.coverage_premiums_by_ages_totals = Array.from(totalsMap.values());
    },


    //만기별 보험료 비교 setting
    setPaytermCoveragePremiums() {
        const coverage_premiums = detail_coverage.payterm_coverage_premiums || [];
        const main_coverage_premiums = detail_coverage.coverage_premiums || [];
        const plan_coverages = detail_coverage.plan_coverages || [];

        // ✅ 메인에서 넘어온 가입금액 비율 맵 (중요!)
        const ratioMap = detail_coverage.coverage_ratio_map || {};

        if (!coverage_premiums.length) return;

        const companyDispMap = new Map(main_coverage_premiums.map(c => [c.company_code, c.DispValue]));
        const coverageSelectedMap = new Map(plan_coverages.map(p => [p.coverage_cd, p.plan_coverage_selected]));

        for (const coverage of coverage_premiums) {
            // ✅ [동기화] 회사 노출 여부 (메인에 없으면 false)
            coverage.DispValue = companyDispMap.has(coverage.company_code) ? companyDispMap.get(coverage.company_code) : false;

            const { detailList } = coverage;
            if (!Array.isArray(detailList)) continue;

            let total_premium = 0;

            for (const detail of detailList) {
                // ✅ [동기화] 각 담보별 선택 상태 반영
                detail.cover_selected = coverageSelectedMap.get(detail.coverage_cd) === 'checked' ? 'checked' : '';

                // ✅ 금액 및 보험료 계산 (비율 반영)
                detail.base_premium ??= (detail.guide_coverage_premium || 0);

                const ratio = ratioMap[detail.coverage_cd] ?? 1;

                detail.base_coverage_amount = Math.floor(ratio * (detail.guide_coverage_amount || 0));
                detail.base_premium = Math.floor(ratio * (detail.base_premium || 0));

                // ✅ 선택된 담보만 합계 보험료에 누적 (회사가 노출될 때만 계산)
                if (coverage.DispValue && detail.cover_selected === 'checked') {
                    total_premium += detail.base_premium || 0;
                }
            }
            // 🔥 [중요] 계산된 합계를 객체에 반드시 할당해줘야 함!
            coverage.total_premium = total_premium;
        }
        // 정렬 (total_premium이 할당된 후 정렬해야 정상 작동함)
        const sortedPremiums = [...coverage_premiums].sort((a, b) => (a.total_premium || 0) - (b.total_premium || 0));
        detail_coverage.payterm_coverage_premiums = sortedPremiums;
    },


    //보험료 최저vs 최대 랜더링
    coverage_min_max_detail() {
        this.rendercoverageProductInfo("min_max_coverage");
        this.renderMinMaxPremium();
    },

    //연령별 보험료 비교 랜더링
    coverage_aging_detail() {
        //1. 사용자 정보, 상품정보 랜더링
        this.rendercoverageProductInfo("aging_info");

        //2. 월 보험료, 총 납입 보험료
        this.renderCoveragePremiumByAging();

        //3. 연령별 보장 상세
        this.renderCoverageBojangByAging();
    },

    //만기 보험료 비교 랜더링
    coverage_payment_detail() {
        this.rendercoverageProductInfo("payment_period_info");
        this.handlePaymentPremiumChange();
    },


    //상품조건 정보 (상단 메타 카드)
    rendercoverageProductInfo(target_id) {
        const root = document.getElementById(target_id);
        if (!root) return;

        const genderLabel = detail_coverage.gender == 'M' ? '남성' : '여성';
        const custName = detail_coverage.cust_name || '-';
        const planType = detail_coverage.plan_type_name || '-';
        const payterm = detail_coverage.plan_payment_expiration_name || '-';

        const needsSelect = target_id === 'payment_period_info' || target_id === 'aging_info';
        const selectId = target_id === 'payment_period_info'
            ? 'payment_coverage_list'
            : (target_id === 'aging_info' ? 'aging_coverage_list' : '');

        root.innerHTML = `
            <div class="dc-meta-card">
                <div class="dc-meta-chips">
                    <div class="dc-meta-item">
                        <span class="dc-meta-label">고객</span>
                        <strong class="dc-meta-value">${custName} · ${detail_coverage.age || '-'}세 · ${genderLabel}</strong>
                    </div>
                    <div class="dc-meta-divider" aria-hidden="true"></div>
                    <div class="dc-meta-item">
                        <span class="dc-meta-label">상품유형</span>
                        <strong class="dc-meta-value">${planType}</strong>
                    </div>
                    <div class="dc-meta-divider" aria-hidden="true"></div>
                    <div class="dc-meta-item">
                        <span class="dc-meta-label">납기/만기</span>
                        <strong class="dc-meta-value">${payterm}</strong>
                    </div>
                    ${needsSelect ? `
                    <div class="dc-meta-divider" aria-hidden="true"></div>
                    <label class="dc-meta-item dc-meta-select-inline">
                        <select id="${selectId}" aria-label="비교 상품 선택"></select>
                    </label>` : ''}
                </div>
            </div>
        `;

        if (!needsSelect || !selectId) return;

        const select = document.getElementById(selectId);
        if (!select) return;

        (detail_coverage.coverage_premiums || []).forEach((item) => {
            if (!item.DispValue) return;
            const option = document.createElement('option');
            option.value = item.company_code;
            option.textContent = `${item.company_name}  ${item.product_name}`;
            select.appendChild(option);
        });

        if (target_id === 'payment_period_info') {
            select.onchange = () => this.handlePaymentPremiumChange();
        } else if (target_id === 'aging_info') {
            select.onchange = () => {
                this.renderCoveragePremiumByAging();
                this.renderCoverageBojangByAging();
            };
        }
    },


    //최대,최소 보험료 정보
    renderMinMaxPremium() {
        const plan_coverages = detail_coverage.plan_coverages;
        const coverage_premiums = detail_coverage.coverage_premiums || [];
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name;

        const stats = this.calculatePremiumStats(coverage_premiums, plan_payment_expiration_name);
        if (!stats) return; // 데이터 없으면 종료

        // 상·하단 열 맞춤: 좌측(구분/보장+가입금액) 40% · 최저 30% · 최대 30%
        const MM_COL = {
            label: '40%',
            cov: '28%',
            amt: '12%',
            min: '30%',
            max: '30%',
        };

        // ============================================================
        // ✅ [1] 최저/최대 보험료 상품 테이블 (min_max_coverage_premium)
        // ============================================================
        const premiumTable = document.getElementById("min_max_coverage_premium");
        if (premiumTable) {
            premiumTable.innerHTML = ''; //초기화
            premiumTable.classList.add('dc-compare-table', 'dc-minmax-table', 'dc-minmax-summary');

            // colgroup 추가
            const colgroup = document.createElement("colgroup");
            [MM_COL.label, MM_COL.min, MM_COL.max].forEach(width => {
                const col = document.createElement("col");
                col.style.width = width;
                colgroup.appendChild(col);
            });
            premiumTable.appendChild(colgroup);


            //thead 타이틀
            const thead = document.createElement('thead');
            thead.innerHTML = `
            <tr>
                <th class="dc-minmax-h-label">구분</th>
                <th class="dc-minmax-h-min">최저 보험료 상품</th>
                <th class="dc-minmax-h-max">최대 보험료 상품</th>
            </tr>`;
            premiumTable.appendChild(thead);

            const tbody = document.createElement('tbody');

            // 회사명
            let tr1 = document.createElement("tr");
            tr1.innerHTML = `
            <td class="dc-minmax-label">회사명</td>
            <td>${coverage_premiums[stats.minPos].company_name}</td>
            <td>${coverage_premiums[stats.maxPos].company_name}</td>`;
            tbody.appendChild(tr1);

            // 상품명
            let tr2 = document.createElement("tr");
            tr2.innerHTML = `
            <td class="dc-minmax-label">상품명</td>
            <td>${coverage_premiums[stats.minPos].product_name}</td>
            <td>${coverage_premiums[stats.maxPos].product_name}</td>`;
            tbody.appendChild(tr2);

            // 월 보험료
            let tr3 = document.createElement("tr");
            tr3.className = 'dc-minmax-premium-row';
            tr3.innerHTML = `
            <td class="dc-minmax-label">
                <span class="dc-minmax-label-text">월 보험료</span>
                <span class="dc-minmax-diff">( 차액 : <strong class="plus">+${app.formatNumber(stats.monthlyDiff)}</strong> )</span>
            </td>
            <td><strong class="minus">${app.formatNumber(coverage_premiums[stats.minPos].total_premium)}</strong></td>
            <td><strong class="plus">${app.formatNumber(coverage_premiums[stats.maxPos].total_premium)}</strong></td>`;
            tbody.appendChild(tr3);

            // 총 납입 보험료
            let tr4 = document.createElement("tr");
            tr4.className = 'dc-minmax-premium-row';
            tr4.innerHTML = `
            <td class="dc-minmax-label">
                <span class="dc-minmax-label-text">총 납입 보험료</span>
                <span class="dc-minmax-diff">( 차액 : <strong class="plus">+${app.formatNumber(stats.totalDiff)}</strong> )</span>
            </td>
            <td><strong class="minus">${app.formatNumber(stats.totalMin)}</strong></td>
            <td><strong class="plus">${app.formatNumber(stats.totalMax)}</strong></td>`;
            tbody.appendChild(tr4);

            premiumTable.appendChild(tbody);
        }

        // ============================================================
        // ✅ [2] 보장정보 테이블 (min_max_coverage_detail)
        // ============================================================
        const bojangTable = document.getElementById("min_max_coverage_detail");
        if (bojangTable) {
            const min_product = coverage_premiums[stats.minPos];
            const max_product = coverage_premiums[stats.maxPos];
            const rows = [];

            plan_coverages.forEach((bj, idx) => {
                if (bj.plan_coverage_selected != "checked") return;

                let min_premium = 0;
                let max_premium = 0;

                if (bj.coverage_cd == "aa00") {
                    min_premium = min_product.detailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.base_premium || 0), 0);
                    max_premium = max_product.detailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.base_premium || 0), 0);
                } else {
                    const min_detailIdx = detail_coverage.guide_coverage_detail_item.get(min_product.company_code + bj.coverage_cd);
                    const max_detailIdx = detail_coverage.guide_coverage_detail_item.get(max_product.company_code + bj.coverage_cd);
                    const min_detail = min_detailIdx ? min_product.detailList[min_detailIdx] : null;
                    const max_detail = max_detailIdx ? max_product.detailList[max_detailIdx] : null;
                    min_premium = min_detail ? min_detail.base_premium : 0;
                    max_premium = max_detail ? max_detail.base_premium : 0;
                }

                rows.push({
                    coverage_cd: bj.coverage_cd,
                    name: bj.coverage_name || '',
                    amountNum: bj.coverage_cd == 'aa00' ? null : Number(bj.guide_coverage_amount) || 0,
                    amountText: bj.coverage_cd == 'aa00' ? '-' : app.formatNumber(bj.guide_coverage_amount),
                    minPremium: Number(min_premium) || 0,
                    maxPremium: Number(max_premium) || 0,
                    seq: bj.coverage_seq ?? idx,
                });
            });

            this._minmaxDetailRows = rows;
            this._renderMinMaxDetailTable(bojangTable, MM_COL);
        }
    },

    _sortMinMaxDetailRows(rows) {
        const { key, dir } = this._minmaxDetailSort || { key: 'seq', dir: 'asc' };
        const mult = dir === 'desc' ? -1 : 1;
        const list = [...rows];

        list.sort((a, b) => {
            let cmp = 0;
            if (key === 'name') {
                cmp = String(a.name).localeCompare(String(b.name), 'ko');
            } else if (key === 'min') {
                cmp = a.minPremium - b.minPremium;
            } else if (key === 'max') {
                cmp = a.maxPremium - b.maxPremium;
            } else {
                cmp = (a.seq ?? 0) - (b.seq ?? 0);
            }
            if (cmp === 0) cmp = (a.seq ?? 0) - (b.seq ?? 0);
            return cmp * mult;
        });
        return list;
    },

    _minmaxSortIndicator(colKey) {
        const { key, dir } = this._minmaxDetailSort || {};
        if (key !== colKey || key === 'seq') return '';
        return dir === 'desc' ? '↓' : '↑';
    },

    _renderMinMaxDetailTable(bojangTable, MM_COL) {
        if (!bojangTable) return;
        const rows = this._sortMinMaxDetailRows(this._minmaxDetailRows || []);
        const sort = this._minmaxDetailSort || { key: 'seq', dir: 'asc' };

        bojangTable.innerHTML = '';
        bojangTable.classList.add('dc-compare-table', 'dc-minmax-table', 'dc-minmax-detail');

        const colgroup2 = document.createElement("colgroup");
        [MM_COL.cov, MM_COL.amt, MM_COL.min, MM_COL.max].forEach(width => {
            const col = document.createElement("col");
            col.style.width = width;
            colgroup2.appendChild(col);
        });
        bojangTable.appendChild(colgroup2);

        const mark = (colKey) => {
            const active = sort.key === colKey && colKey !== 'seq';
            const aria = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
            const ind = this._minmaxSortIndicator(colKey);
            return { active, aria, ind };
        };
        const nameM = mark('name');
        const minM = mark('min');
        const maxM = mark('max');

        const thead2 = document.createElement("thead");
        thead2.innerHTML = `
            <tr>
                <th class="dc-minmax-h-label dc-sortable${nameM.active ? ' is-sorted' : ''}" data-sort-key="name" role="button" tabindex="0" aria-sort="${nameM.aria}">
                    최저/최대 보장 상세${nameM.ind ? ` <span class="dc-sort-ind" aria-hidden="true">${nameM.ind}</span>` : ''}
                </th>
                <th class="dc-minmax-h-amt">가입금액 <span class="dc-col-unit">(만원)</span></th>
                <th class="dc-minmax-h-min dc-sortable${minM.active ? ' is-sorted' : ''}" data-sort-key="min" role="button" tabindex="0" aria-sort="${minM.aria}">
                    월 보험료 <span class="dc-col-unit">(원)</span>${minM.ind ? ` <span class="dc-sort-ind" aria-hidden="true">${minM.ind}</span>` : ''}
                </th>
                <th class="dc-minmax-h-max dc-sortable${maxM.active ? ' is-sorted' : ''}" data-sort-key="max" role="button" tabindex="0" aria-sort="${maxM.aria}">
                    월 보험료 <span class="dc-col-unit">(원)</span>${maxM.ind ? ` <span class="dc-sort-ind" aria-hidden="true">${maxM.ind}</span>` : ''}
                </th>
            </tr>`;
        bojangTable.appendChild(thead2);

        const tbody2 = document.createElement("tbody");
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="dc-minmax-cov">${row.name}</td>
                <td class="dc-minmax-amt">${row.amountText}</td>
                <td class="dc-minmax-min">${app.formatNumber(row.minPremium)}</td>
                <td class="dc-minmax-max">${app.formatNumber(row.maxPremium)}</td>`;
            tbody2.appendChild(tr);
        });
        bojangTable.appendChild(tbody2);

        this._bindMinMaxDetailSort(bojangTable, MM_COL);
    },

    _bindMinMaxDetailSort(bojangTable, MM_COL) {
        if (!bojangTable) return;
        bojangTable.querySelectorAll('th.dc-sortable').forEach((th) => {
            const activate = () => {
                const nextKey = th.getAttribute('data-sort-key');
                if (!nextKey) return;
                const cur = this._minmaxDetailSort || { key: 'seq', dir: 'asc' };
                if (cur.key === nextKey) {
                    if (cur.dir === 'asc') this._minmaxDetailSort = { key: nextKey, dir: 'desc' };
                    else this._minmaxDetailSort = { key: 'seq', dir: 'asc' }; // 기본 순서로 복귀
                } else {
                    this._minmaxDetailSort = { key: nextKey, dir: 'asc' };
                }
                this._renderMinMaxDetailTable(bojangTable, MM_COL);
            };
            th.addEventListener('click', activate);
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate();
                }
            });
        });
    },

    //연령별 보험료 비교 랜더링
    renderCoveragePremiumByAging() {
        const coverage_premiums_by_ages_totals = detail_coverage.coverage_premiums_by_ages_totals || [];
        const selectedValue = document.getElementById("aging_coverage_list")?.value;
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name || "";

        // 납입기간 계산
        const payment_period =
            plan_payment_expiration_name.includes("1년") ? 1 :
                plan_payment_expiration_name.includes("10년") ? 10 :
                    plan_payment_expiration_name.includes("20년") ? 20 :
                        plan_payment_expiration_name.includes("30년") ? 30 : 1;



        // ✅ company_code와 선택된 값이 일치하는 객체 찾기
        const selectedCompany = coverage_premiums_by_ages_totals.find(item => item.company_code == selectedValue);
        if (!selectedCompany) return;


        const agingPremiumTable = document.getElementById("aging_coverage_premium");
        if (!agingPremiumTable) return;
        agingPremiumTable.innerHTML = ''; // 초기화


        // ✅ 연령 키 정렬
        const ages = this.getSortedAges(selectedCompany.totals);


        // ✅ colgroup — 하단 상세표(보장+가입금액)와 좌측 폭 일치, 나이 열 균등
        const colgroup = document.createElement("colgroup");
        const leftCol = document.createElement("col");
        leftCol.className = "dc-aging-col-left";
        colgroup.appendChild(leftCol);
        ages.forEach(() => {
            const col = document.createElement("col");
            col.className = "dc-aging-col-age";
            colgroup.appendChild(col);
        });
        agingPremiumTable.appendChild(colgroup);
        agingPremiumTable.classList.add("dc-compare-table", "dc-aging-table", "dc-aging-summary");
        agingPremiumTable.style.tableLayout = "fixed";
        agingPremiumTable.style.width = "100%";



        // ✅ thead 생성
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        const thFirst = document.createElement("th");
        thFirst.className = "dc-minmax-h-label";
        thFirst.textContent = "구분";
        headerRow.appendChild(thFirst);



        ages.forEach((age, i) => {
            const th = document.createElement("th");
            th.className = `dc-aging-age-head ${i === 0 || parseInt(age, 10) === parseInt(detail_coverage.age, 10) ? "dc-minmax-h-min" : "dc-minmax-h-col"}`;
            if (i === 0 || parseInt(age, 10) === parseInt(detail_coverage.age, 10)) {
                th.innerHTML = `<span class="dc-aging-age-main">${age}세</span><span class="dc-aging-age-sub">현재</span>`;
            } else {
                th.innerHTML = `<span class="dc-aging-age-main">${age}세</span><span class="dc-aging-age-sub">가입 시</span>`;
            }
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        agingPremiumTable.appendChild(thead);



        // ✅ tbody 생성
        const tbody = document.createElement("tbody");

        // [1] 월 보험료 행
        const tr1 = document.createElement("tr");
        const tdMonthlyLabel = Object.assign(document.createElement("td"), { rowSpan: '2', className: 'row dc-minmax-label' });
        tdMonthlyLabel.textContent = "월 보험료";
        tr1.appendChild(tdMonthlyLabel);

        ages.forEach(age => {
            const td = document.createElement("td");
            td.innerHTML = `<strong>${app.formatNumber(selectedCompany.totals[age])}</strong>`;
            tr1.appendChild(td);
        });
        tbody.appendChild(tr1);



        // [2] 월 보험료 차액 행
        const tr2 = document.createElement("tr");
        tr2.className = 'gray-bg';

        const basePremium = selectedCompany.totals[detail_coverage.age];
        const total_basePremium = (basePremium * payment_period) * 12;

        ages.forEach(age => {
            const td = document.createElement("td");
            if (parseInt(age) === parseInt(detail_coverage.age)) {
                td.className = 'none02';
                td.textContent = "-";

            } else {
                const diff = selectedCompany.totals[age] - basePremium;
                td.innerHTML = `<strong class="${diff > 0 ? 'plus' : 'minus'}">${diff > 0 ? '+' : ''}${app.formatNumber(diff)}</strong>`;
            }
            tr2.appendChild(td);
        });

        tbody.appendChild(tr2);


        // [3] 총 납입 보험료 행
        const tr3 = document.createElement("tr");
        tr3.appendChild(Object.assign(document.createElement("td"), { rowSpan: '2', className: 'row dc-minmax-label', textContent: "총 납입 보험료" }));

        ages.forEach(age => {
            const td = document.createElement("td");
            td.innerHTML = `<strong>${app.formatNumber(((selectedCompany.totals[age] * payment_period) * 12))}</strong>`;
            tr3.appendChild(td);
        });

        tbody.appendChild(tr3);


        // [4] 총 납입 보험료 차액 행
        const tr4 = document.createElement("tr");
        tr4.className = 'gray-bg';
        ages.forEach(age => {
            const td = document.createElement("td");

            if (parseInt(age) == parseInt(detail_coverage.age)) {
                td.className = 'none02';
                td.textContent = "-";

            } else {
                const diff = ((selectedCompany.totals[age] * payment_period) * 12) - total_basePremium;
                td.innerHTML = `<strong class="${diff > 0 ? 'plus' : 'minus'}">${diff > 0 ? '+' : ''}${app.formatNumber(diff)}</strong>`;
            }
            tr4.appendChild(td);
        });

        tbody.appendChild(tr4);
        agingPremiumTable.appendChild(tbody);

    },

    //연령별 보험료 비교 상세 랜더링
    renderCoverageBojangByAging() {
        const table = document.getElementById("aging_coverage_detail");
        if (!table) return;
        table.innerHTML = '';

        const { coverage_premiums_by_ages } = detail_coverage;
        const selectedValue = document.getElementById("aging_coverage_list")?.value;

        // 1) 선택 회사의 모든 연령 row 확보
        const companyRows = (coverage_premiums_by_ages || []).filter(p => p.company_code == selectedValue && p.DispValue);

        // 🚨 [수정 포인트] 데이터가 아예 없는 경우 바로 리턴해서 에러 방지
        if (!companyRows || companyRows.length === 0) {
            console.warn("표시할 연령별 상세 데이터가 없습니다.");
            return;
        }

        // 2) 나이 목록
        const agesKeys = [...new Set(companyRows.map(p => Number(p.age)))].sort((a, b) => a - b);

        // 3) 담보 메타(이름/seq/amount) + 4) 담보별 age premium 매핑
        const coverageMeta = new Map();          // cd -> meta
        const premiumByCoverage = new Map();     // cd -> {age: premium}

        companyRows.forEach(p => {
            (p.detailList || []).forEach(d => {
                // meta
                if (!coverageMeta.has(d.coverage_cd)) {
                    coverageMeta.set(d.coverage_cd, {
                        coverage_cd: d.coverage_cd,
                        coverage_name: d.coverage_name,
                        coverage_seq: d.coverage_seq ?? 9999,
                        // 가입금액은 age별로 달라질 수도 있으니 "현재(첫 age)" 기준으로만 표시하려면 아래처럼
                        coverage_amount: d.base_coverage_amount
                    });
                }
                // premium map
                if (!premiumByCoverage.has(d.coverage_cd)) premiumByCoverage.set(d.coverage_cd, {});
                premiumByCoverage.get(d.coverage_cd)[Number(p.age)] = d.base_premium ?? 0;
            });
        });


        // 5) 출력할 담보 목록 (체크된 것만 보여주려면)
        // 기준: "현재 age(가장 작은 age 또는 46세 row)"에서 cover_selected가 checked인 것만
        const currentAge = agesKeys[0];
        const currentRow = companyRows.find(p => Number(p.age) === currentAge) || companyRows[0];
        const visibleCoverageCds = (currentRow.detailList || []).filter(d => d.cover_selected === 'checked').map(d => d.coverage_cd);

        // 담보 객체 배열로 변환 + 정렬(aa00 맨 위, 그 다음 seq)
        const coverages = visibleCoverageCds
            .map(cd => coverageMeta.get(cd))
            .filter(Boolean)
            .sort((a, b) => {
                //if (a.coverage_cd === 'aa00') return -1;
                //if (b.coverage_cd === 'aa00') return 1;
                return (a.coverage_seq ?? 9999) - (b.coverage_seq ?? 9999);
            });

        if (!coverages.length) return;
        // ---------- 테이블 구성 ----------
        const createRow = (name, amountText, agePremiums) => {
            const tr = document.createElement("tr");

            const nameTd = Object.assign(document.createElement("td"), { className: "dc-minmax-cov", textContent: name });
            const amountTd = Object.assign(document.createElement("td"), { className: "dc-minmax-amt", textContent: amountText });
            tr.append(nameTd, amountTd);

            agesKeys.forEach((age) => {
                const td = document.createElement("td");
                const premium = agePremiums?.[age];
                td.textContent = premium != null ? app.formatNumber(premium) : "0";
                tr.appendChild(td);
            });

            return tr;
        };

        // colgroup — 상단 요약표와 동일 비율 (보장 | 가입금액 = 좌측 합, 나이 열 균등)
        const colgroup = document.createElement("colgroup");
        const covCol = document.createElement("col");
        covCol.className = "dc-aging-col-cov";
        const amtCol = document.createElement("col");
        amtCol.className = "dc-aging-col-amt";
        colgroup.append(covCol, amtCol);
        agesKeys.forEach(() => {
            const col = document.createElement("col");
            col.className = "dc-aging-col-age";
            colgroup.appendChild(col);
        });
        table.appendChild(colgroup);
        table.classList.add("dc-compare-table", "dc-aging-table", "dc-aging-detail");
        table.style.tableLayout = "fixed";
        table.style.width = "100%";

        // thead
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const thCov = document.createElement("th");
        thCov.className = "dc-minmax-h-label";
        thCov.textContent = "연령별 보장 상세";
        const thAmt = document.createElement("th");
        thAmt.className = "dc-minmax-h-amt";
        thAmt.innerHTML = `가입금액 <span class="dc-col-unit">(만원)</span>`;
        headRow.append(thCov, thAmt);
        agesKeys.forEach((age, i) => {
            const th = document.createElement("th");
            th.className = `dc-aging-age-head ${i === 0 ? "dc-minmax-h-min" : "dc-minmax-h-col"}`;
            if (i === 0) {
                th.innerHTML = `<span class="dc-aging-age-main">${age}세</span><span class="dc-aging-age-sub">현재</span>`;
            } else {
                th.innerHTML = `<span class="dc-aging-age-main">${age}세</span>`;
            }
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        // tbody
        const tbody = document.createElement("tbody");

        coverages.forEach(cov => {
            const agePremiums = premiumByCoverage.get(cov.coverage_cd) || {};
            const amountText = app.formatNumber(cov.coverage_amount || 0);
            tbody.appendChild(createRow(cov.coverage_name, amountText, agePremiums));
        });

        table.appendChild(tbody);
    },


    //만기별 보험료 비교 랜더링
    handlePaymentPremiumChange() {

        //만기 보험료 비교 - 월 보험료, 차액, 총 납입 보험료 랜더링
        this.renderPaymentPremiumTable();

        //만기 보험료 비교 - 만기별 보장 상세
        this.renderPaymentCoverageTable();
    },

    renderPaymentPremiumTable() {
        const { payterm_coverage_premiums } = detail_coverage;
        const selectedValue = document.getElementById("payment_coverage_list")?.value;
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name || ""; //20년/100세
        // 납입기간 계산
        const payment_period =
            plan_payment_expiration_name.includes("1년") ? 1 :
                plan_payment_expiration_name.includes("10년") ? 10 :
                    plan_payment_expiration_name.includes("20년") ? 20 :
                        plan_payment_expiration_name.includes("30년") ? 30 : 1;

        const paymentPremiumTable = document.getElementById('payment_period_coverage_premium');
        if (!paymentPremiumTable) return;
        paymentPremiumTable.innerHTML = ''; //  초기화
        paymentPremiumTable.classList.add('dc-compare-table', 'dc-payment-summary');

        const companyRows = (payterm_coverage_premiums || []).filter(p => p.company_code == selectedValue && p.DispValue);
        if (!companyRows || companyRows.length === 0) {
            detail_coverage.companyRows = []; //빈 값으로 초기화
            return;
        }

        // 🔥 현재 조회한 만기 맨 위로 정렬
        companyRows.sort((a, b) => {
            if (a.plan_payterm_type_name === plan_payment_expiration_name) return -1;
            if (b.plan_payterm_type_name === plan_payment_expiration_name) return 1;
            return 0;
        });

        //companyRows 객체 생성
        detail_coverage.companyRows = companyRows;

        const leftPct = 40;
        const colPct = ((100 - leftPct) / companyRows.length).toFixed(4) + '%';

        // ** colgroup 생성 — 하단 상세표와 열 맞춤
        const colgroup = document.createElement("colgroup");
        [leftPct + '%', ...companyRows.map(() => colPct)].forEach(w => {
            const col = document.createElement("col");
            col.style.width = w;
            colgroup.appendChild(col);
        });
        paymentPremiumTable.appendChild(colgroup);


        // ** thead 생성
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const thLabel = document.createElement("th");
        thLabel.className = 'dc-minmax-h-label';
        thLabel.textContent = '구분';
        headRow.appendChild(thLabel);

        companyRows.forEach((item, i) => {
            const th = document.createElement("th");
            th.className = i === 0 ? 'dc-minmax-h-min' : 'dc-minmax-h-col';
            th.textContent = item.plan_payterm_type_name;
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        paymentPremiumTable.appendChild(thead);

        // ** tbody 생성 — 연령대별과 동일: 월/총 납입 라벨에 차액 행 통합
        const tbody = document.createElement("tbody");

        /* 🔹 [1] 월 보험료 */
        const trMonthly = document.createElement("tr");
        const tdMonthlyLabel = Object.assign(document.createElement("td"), {
            rowSpan: '2',
            className: 'row dc-minmax-label',
            textContent: '월 보험료',
        });
        trMonthly.appendChild(tdMonthlyLabel);

        companyRows.forEach(item => {
            trMonthly.appendChild(this._makeTd(app.formatNumber(item.total_premium), true));
        });
        tbody.appendChild(trMonthly);

        /* 🔹 [2] 월 보험료 차액 (라벨 없음 — 월 보험료에 통합) */
        const trDiff = document.createElement("tr");
        trDiff.className = "gray-bg";
        trDiff.appendChild(this._makeTd("-", false, null, "none"));

        for (let i = 1; i < companyRows.length; i++) {
            const diff = companyRows[i].total_premium - companyRows[0].total_premium;
            trDiff.appendChild(this._makeDiffTd(diff));
        }
        tbody.appendChild(trDiff);


        /* 🔹 [3] 총 납입 보험료 */
        const baseTotal = (companyRows[0].total_premium * payment_period) * 12;

        const trTotal = document.createElement("tr");
        const tdTotalLabel = Object.assign(document.createElement("td"), {
            rowSpan: '2',
            className: 'row dc-minmax-label',
            textContent: '총 납입 보험료',
        });
        trTotal.appendChild(tdTotalLabel);
        trTotal.appendChild(this._makeTd(app.formatNumber(baseTotal), true));

        for (let i = 1; i < companyRows.length; i++) {
            const total = (companyRows[i].total_premium * payment_period) * 12;
            trTotal.appendChild(this._makeTd(app.formatNumber(total), true));
        }
        tbody.appendChild(trTotal);


        /* 🔹 [4] 총 납입 보험료 차액 (라벨 없음 — 총 납입 보험료에 통합) */
        const trTotalDiff = document.createElement("tr");
        trTotalDiff.className = "gray-bg";
        trTotalDiff.appendChild(this._makeTd("-", false, null, "none"));

        for (let i = 1; i < companyRows.length; i++) {
            const diff = ((companyRows[i].total_premium * payment_period) * 12) - baseTotal;
            trTotalDiff.appendChild(this._makeDiffTd(diff));
        }

        tbody.appendChild(trTotalDiff);
        paymentPremiumTable.appendChild(tbody);
    },

    renderPaymentCoverageTable() {

        const { companyRows } = detail_coverage;
        const table = document.getElementById('payment_period_coverage_detail');
        if (!table) return;

        // 1. 일단 테이블을 비운다 (데이터가 있든 없든)
        table.innerHTML = '';

        // 2. 데이터가 없으면 여기서 끝낸다
        if (!companyRows || companyRows.length === 0) {
            console.log("데이터 없음 - 종료");
            return;
        }
        //console.log({ companyRows: companyRows });


        // 3. 데이터가 있을 때만 아래 로직(테이블 그리기 등) 실행
        //console.log("데이터 있음 - 그리기 시작");

        /* =========================
           colgroup — 상단 요약과 열 맞춤 (좌측 40% = 보장+가입금액)
        ========================= */
        const nCols = companyRows.length;
        const leftPct = 40;
        const covPct = 28;
        const amtPct = 12;
        const colPct = ((100 - leftPct) / nCols).toFixed(4) + '%';

        const colgroup = document.createElement("colgroup");
        [covPct + '%', amtPct + '%', ...companyRows.map(() => colPct)].forEach(w => {
            const col = document.createElement("col");
            col.style.width = w;
            colgroup.appendChild(col);
        });

        table.appendChild(colgroup);
        table.classList.add('dc-compare-table', 'dc-payment-detail');
        /* =========================
           thead
        ========================= */
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");

        const thCov = document.createElement("th");
        thCov.className = 'dc-minmax-h-label';
        thCov.textContent = '만기별 보장 상세';
        const thAmt = document.createElement("th");
        thAmt.className = 'dc-minmax-h-amt';
        thAmt.innerHTML = `가입금액 <span class="dc-col-unit">(만원)</span>`;
        headRow.append(thCov, thAmt);

        companyRows.forEach((item, i) => {
            const th = document.createElement("th");
            th.className = i === 0 ? 'dc-minmax-h-min' : 'dc-minmax-h-col';
            th.textContent = item.plan_payterm_type_name;
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        table.appendChild(thead);

        /* =========================
           tbody
        ========================= */

        const tbody = document.createElement("tbody");

        //전체 만기에서 coverage 수집
        const coverageMap = new Map();

        companyRows.forEach(company => {
            (company.detailList || []).forEach(detail => {
                if (detail.cover_selected !== "checked") return;
                if (!coverageMap.has(detail.coverage_cd)) {
                    coverageMap.set(detail.coverage_cd, detail);
                }
            });
        });

        //정렬
        const coverageList = Array.from(coverageMap.values()).sort((a, b) => {
            return (a.coverage_seq ?? 9999) - (b.coverage_seq ?? 9999);
        });

        // 🔥 4️⃣ 행 생성
        coverageList.forEach(baseDetail => {
            const tr = document.createElement("tr");

            // 보장명
            const tdName = document.createElement("td");
            tdName.className = "dc-minmax-cov";
            tdName.textContent = baseDetail.coverage_name;
            tr.appendChild(tdName);

            // 가입금액
            const coverageAmountText = app.formatNumber(baseDetail.base_coverage_amount || 0);
            tr.appendChild(this._makeTd(coverageAmountText, false, null, "dc-minmax-amt"));

            // 🔥 만기별 보험료
            companyRows.forEach((prod, i) => {
                const matched = (prod.detailList || []).find(d => d.coverage_cd === baseDetail.coverage_cd);
                const premiumText = matched ? app.formatNumber(matched.base_premium || 0) : "-";
                tr.appendChild(this._makeTd(premiumText, false, null, i === 0 ? "dc-minmax-min" : ""));
            });
            tbody.appendChild(tr);
        })
        table.appendChild(tbody);
    },


    /**
     * 최저/최대 보험료 및 차액 계산
     * @param {Array} coverage_premiums - 보험 상품 리스트
     * @param {String} plan_payment_expiration_name - 납입기간 텍스트 (ex: "20년/100세")
     * @returns {{
     *   minPos: number,
     *   maxPos: number,
     *   minPremium: number,
     *   maxPremium: number,
     *   monthlyDiff: number,
     *   totalMin: number,
     *   totalMax: number,
     *   totalDiff: number
     * }}
     */
    calculatePremiumStats(coverage_premiums, plan_payment_expiration_name) {
        const arr = [];

        // 납입기간 추출
        const payment_period = plan_payment_expiration_name.indexOf("1년") >= 0 ? 1 : plan_payment_expiration_name.indexOf("10년") >= 0 ? 10 : plan_payment_expiration_name.indexOf("20년") >= 0 ? 20 : plan_payment_expiration_name.indexOf("30년") >= 0 ? 30 : 1;

        //coverage_premiums 중 DispValue 가 true 만 배열에 추가해준다.
        coverage_premiums.forEach((p, i) => {
            if (p.DispValue) {
                arr.push({ total_premium: parseInt(p.total_premium), product_pos: i });
            }
        });

        // 보험료 오름차순 정렬
        arr.sort((a, b) => a.total_premium - b.total_premium);

        if (arr.length == 0) {
            return; // 데이터가 없을 경우 null 반환
        }

        const minPos = arr[0].product_pos;
        const maxPos = arr[arr.length - 1].product_pos;

        const minPremium = coverage_premiums[minPos].total_premium;
        const maxPremium = coverage_premiums[maxPos].total_premium;
        const monthlyDiff = maxPremium - minPremium;

        const totalMin = minPremium * payment_period * 12;
        const totalMax = maxPremium * payment_period * 12;
        const totalDiff = totalMax - totalMin;


        return {
            minPos,
            maxPos,
            minPremium,
            maxPremium,
            monthlyDiff,
            totalMin,
            totalMax,
            totalDiff
        };
    },


    //연령 정렬
    getSortedAges(totalsObj) {
        return Object.keys(totalsObj || {}).map(Number).sort((a, b) => a - b);
    },

    detail_bindEvents() {
        // index 통합 뷰: compareView / detailTabs가 탭 전환 담당
        if (document.getElementById('detailCompareView') && window.compareView) return;
        if (this._eventsBound) return;
        this._eventsBound = true;

        const root = this._detailRoot();
        const tabs = root.querySelectorAll('.tab-list > li[data-detail-tab]');
        const contents = root.querySelectorAll('.tab-content');
        const classMap = {
            premium: 'content01',
            payment: 'content03',
            aging: 'content04',
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', async (e) => {
                const tabId = tab.getAttribute('data-detail-tab') || tab.id;
                // 상품유형별은 detailTabs가 페이지 이동
                if (tabId === 'simplifi') return;
                if (!classMap[tabId]) return;

                e.preventDefault();
                e.stopImmediatePropagation();

                tabs.forEach((li) => li.classList.remove('active'));
                contents.forEach((content) => content.classList.remove('show'));

                tab.classList.add('active');
                const target = root.querySelector(`.tab-content.${classMap[tabId]}`);
                if (target) target.classList.add('show');

                await this.switchTabContent(tabId);
            });
        });
    },


    _makeTd(text, strong = false, subText = null, className = "", allowHtml = false) {
        const td = document.createElement("td");
        if (className) td.className = className;

        if (subText) {
            td.innerHTML = `${text}<span>(${subText})</span>`;
            return td;
        }

        if (strong) {
            const s = document.createElement("strong");
            s.textContent = text;
            td.appendChild(s);
        }
        else if (allowHtml) {
            td.innerHTML = text;
        }
        else {
            td.textContent = text;
        }
        return td;
    },

    _makeDiffTd(diff) {
        const td = document.createElement("td");
        const strong = document.createElement("strong");
        const cls = diff > 0 ? "plus" : "minus";

        strong.className = cls;
        strong.textContent = `${diff > 0 ? "+" : ""}${app.formatNumber(diff)}`;
        td.appendChild(strong);
        return td;
    },


    toggleMenu(id, isShow) {
        const el = document.getElementById(id);
        if (!el) return;

        const show = !!isShow;
        el.classList.toggle('is-tab-hidden', !show);
        el.hidden = !show;
        el.setAttribute('aria-hidden', show ? 'false' : 'true');
        el.style.removeProperty('opacity');
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('pointer-events');
    }

};