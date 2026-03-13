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
    async init() {

        //2.  로컬스토리지에서 기본 정보 로드
        this.loadBasicInfo();

        //3. 이벤트 실행
        this.setcoverageDisplayonMenu();

        //4. coverage_premiums setting
        this.setcoverageDetailMap();

        try {
            await Promise.all([this.getProductPremiumsByAges(), this.getPaytermCoveragePremiums()]);
            //5. rendering
            this.setActiveTabUI();

        }
        catch (err) {
            console.error("[연령별/ 만기별 보험료 조회 시 오류 발생]", err.code);
            alert(err.message);
            return;
        }

        //6. events
        this.detail_bindEvents();

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


        detail_coverage.plan_coverages = JSON.parse(localStorage.getItem("plan_coverages") || []);
        detail_coverage.coverage_premiums = JSON.parse(localStorage.getItem("coverage_premiums") || []);
        detail_coverage.product_insur_premiums = JSON.parse(localStorage.getItem("product_insur_premiums") || []);
        detail_coverage.coverage_ratio_map = JSON.parse(localStorage.getItem("coverage_ratio_map") || {});

        //console.log(detail_coverage);
    },

    // detailcontroller.js 수정

    setActiveTabUI() {
        // 1. URL 파라미터에서 tab 가져오기 (없으면 기본값 premium)
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = urlParams.get('tab') || 'premium';
        console.log(`[setActiveTabUI] ${tabId} 보여짐`);

        // 2. [UI 제어] 모든 탭(li)과 컨텐츠(section) 초기화 후 선택된 것만 활성화
        const tabs = document.querySelectorAll('.tab-list li');
        const contents = document.querySelectorAll('.tab-content');

        // 3. 탭 li 태그들 처리
        tabs.forEach(li => {
            li.classList.remove('active');
            if (li.id === tabId) li.classList.add('active');
        });

        // 컨텐츠 section 태그들 처리 (HTML 순서가 premium-0, payment-1, aging-2 인 점 활용)
        const tabMap = { 'premium': 0, 'payment': 1, 'aging': 2 };
        const targetIdx = tabMap[tabId] ?? 0;

        contents.forEach((section, index) => {
            section.classList.remove('show');
            if (index === targetIdx) section.classList.add('show');
        });

        // 2️⃣ [데이터 호출] 탭 ID에 맞는 렌더링 함수를 실행
        // 💡 여기서 'this'는 detailController를 가리킵니다.
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
                this.setcoverageByAgeProducts();
            }
        }
        catch (err) {
            console.error("[연령별 보험료 비교 조회 중 오류 발생]", err.code);
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
            console.error("[만기별 보험료 조회 중 오류 발생]", err.code);
            alert(err.message);
            return;
        }
    },

    //1. 연령별 보험료 데이터 정제
    setAgeCoveragePremiums() {
        // 1️⃣ 데이터 가져오기 (detail_coverage 객체 내 데이터 사용)
        const products = detail_coverage.coverage_premiums_by_ages || [];
        //const requiredList = detail_coverage.coverage_required_premiums_by_ages || []; // 상품별 필수보장 리스트
        const main_coverage_premiums = detail_coverage.coverage_premiums || []; // 상품별 보장 리스트
        const plan_coverages = detail_coverage.plan_coverages || []; // 담보 리스트

        if (!products.length) return;

        // 2️⃣ 동기화를 위한 Map 생성
        const companyDispMap = new Map(main_coverage_premiums.map(c => [c.company_code, c.DispValue]));
        const coverageSelectedMap = new Map(plan_coverages.map(p => [p.coverage_cd, p.plan_coverage_selected]));

        // 3️⃣ 회사 + 나이 기준으로 필수보험료(required) 집계 Map 생성
        // const requiredMap = new Map();
        // if (requiredList.length) {
        //     for (const company of requiredList) {
        //         const company_code = company.company_code;
        //         const details = company.detailList || [];
        //         for (const d of details) {
        //             const key = `${company_code}|${d.age}`;
        //             if (!requiredMap.has(key)) {
        //                 requiredMap.set(key, {
        //                     min_amount: Math.round(d.min_insur_amount || 0),
        //                     total_min_premium: 0
        //                 });
        //             }
        //             requiredMap.get(key).total_min_premium += Math.round(d.min_premium || 0);
        //         }
        //     }
        // }

        // 4️⃣ 제품(product) 순회하며 데이터 가공 및 상태 동기화
        for (const product of products) {
            // ✅ [동기화] 회사 노출 여부 (메인에 없으면 false)
            product.DispValue = companyDispMap.has(product.company_code) ? companyDispMap.get(product.company_code) : false;

            //const key = `${product.company_code}|${product.age}`;
            const details = product.detailList || [];

            // ✅ [구조 생성] aa00(최저기본계약) 추가 (중복 방지 체크)
            // const requiredData = requiredMap.get(key);
            // if (requiredData && !details.some(d => d.coverage_cd === 'aa00')) {
            //     details.unshift({
            //         coverage_cd: 'aa00',
            //         coverage_name: '최저기본계약조건',
            //         coverage_seq: -1,
            //         guide_coverage_amount: requiredData.min_amount,
            //         guide_coverage_premium: requiredData.total_min_premium,
            //         coverage_amount: requiredData.min_amount,
            //         premium: requiredData.total_min_premium,
            //         is_selected_coverage: 'Y',
            //         cover_selected: 'checked'
            //     });
            // }

            // ✅ [동기화] 각 담보별 선택 상태 반영
            for (const d of details) {
                // 메인에서 선택된 상태('checked')면 'checked', 아니면 ''
                d.cover_selected = coverageSelectedMap.get(d.coverage_cd) === 'checked' ? 'checked' : '';
            }
        }

        // 5️⃣ 최종 상태 반영
        detail_coverage.coverage_premiums_by_ages = products;
        //console.log("연령별 데이터 세팅 및 동기화 완료", products);
    },

    //2. 만기별 보험료 데이터 정제
    setPaytermCoveragePremiums() {
        const coverage_premiums = detail_coverage.payterm_coverage_premiums || [];
        //const required_premiums = detail_coverage.payterm_required_coverage_premiums || [];
        const main_coverage_premiums = detail_coverage.coverage_premiums || [];
        const plan_coverages = detail_coverage.plan_coverages || [];

        // ✅ 메인에서 넘어온 가입금액 비율 맵 (중요!)
        const ratioMap = detail_coverage.coverage_ratio_map || {};

        if (!coverage_premiums.length) return;

        const companyDispMap = new Map(main_coverage_premiums.map(c => [c.company_code, c.DispValue]));
        const coverageSelectedMap = new Map(plan_coverages.map(p => [p.coverage_cd, p.plan_coverage_selected]));

        // const reqMap = required_premiums.reduce((map, r) => {
        //     const key = `${r.company_code}|${r.product_code}`;
        //     (map[key] ||= []).push(r);
        //     return map;
        // }, Object.create(null));


        for (const product of coverage_premiums) {
            product.DispValue = companyDispMap.has(product.company_code) ? companyDispMap.get(product.company_code) : false;

            const key = product.company_code + '|' + product.product_code;
            //const reqList = reqMap[key];

            // if (reqList?.length) {
            //     let sum_min_premium = 0;
            //     for (const r of reqList) {
            //         sum_min_premium += Math.round(r.min_premium || 0);
            //     }

            //     const aa00 = {
            //         coverage_cd: 'aa00',
            //         coverage_name: '최저기본계약조건',
            //         coverage_seq: -1,
            //         guide_coverage_amount: reqList[0].min_insur_amount || 0,
            //         coverage_amount: reqList[0].min_insur_amount || 0,
            //         guide_coverage_premium: sum_min_premium,
            //         premium: sum_min_premium,
            //         is_selected_coverage: 'Y',
            //         cover_selected: 'checked'
            //     };

            //     if (!product.detailList.some(d => d.coverage_cd === 'aa00')) {
            //         product.detailList = [aa00, ...(product.detailList || [])];
            //     }
            // }

            let total_premium = 0;
            if (Array.isArray(product.detailList)) {
                for (const detail of product.detailList) {
                    // base_premium 최초 1회 세팅
                    detail.base_premium ??= detail.premium;

                    // 메인에서 변경된 비율(ratio) 가져오기 (없으면 1)
                    const ratio = ratioMap[detail.coverage_cd] ?? 1;
                    // 기준 금액 * 비율 = 변경된 가입금액
                    detail.coverage_amount = Math.round(ratio * (detail.guide_coverage_amount || 0));
                    // 기준 보험료 * 비율 = 변경된 보험료
                    detail.premium = Math.round(ratio * detail.base_premium || 0);

                    detail.cover_selected = coverageSelectedMap.get(detail.coverage_cd) === 'checked' ? 'checked' : '';

                    if (detail.cover_selected === 'checked') {
                        total_premium += detail.premium || 0;
                    }
                }
            }
            product.total_premium = total_premium;
        }

        const sortedPremiums = coverage_premiums.sort((a, b) => a.total_premium - b.total_premium);
        detail_coverage.payterm_coverage_premiums = sortedPremiums;
        //console.log("만기별 데이터 세팅(가입금액 비율 반영) 및 동기화 완료", sortedPremiums);
    },


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

        // 한꺼번에 변경 사항을 모아서 브라우저에 전달합니다.
        window.requestAnimationFrame(() => {
            this.toggleMenu("premium", menu.premium);
            this.toggleMenu("payment", menu.payment);
            this.toggleMenu("aging", menu.aging);
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

    //연령별 보험료 비교 값 setting
    setcoverageByAgeProducts() {
        const products = detail_coverage.coverage_premiums_by_ages || [];
        const ratioMap = detail_coverage.coverage_ratio_map || {};
        const totalsMap = new Map();

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            if (!product.DispValue || !Array.isArray(product.detailList)) continue;

            const { company_code, age, detailList } = product;
            let total_premium = 0;

            for (let j = 0; j < detailList.length; j++) {
                const detail = detailList[j];

                // base_premium 최초 1회 세팅
                detail.base_premium ??= detail.premium;

                const ratio = ratioMap[detail.coverage_cd] ?? detail.coverage_amount_ratio ?? 1;
                detail.coverage_amount = Math.round(ratio * detail.guide_coverage_amount);
                detail.premium = Math.round(ratio * detail.base_premium);

                if (detail.cover_selected === 'checked') {
                    total_premium += detail.premium || 0;
                }
            }
            // 회사별 totalsMap 누적
            const companyData = totalsMap.get(company_code) ?? { company_code, totals: {} };
            companyData.totals[age] = total_premium;
            totalsMap.set(company_code, companyData);
        }
        detail_coverage.coverage_premiums_by_ages_totals = Array.from(totalsMap.values());
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


    //상품조건 정보
    rendercoverageProductInfo(target_id) {
        const table = document.getElementById(target_id);
        if (!table) return;

        // 기존 내용 초기화
        table.innerHTML = '';

        // ul 생성
        const ul = document.createElement("ul");

        // li 1: 고객정보
        const li1 = document.createElement("li");
        const strong1 = document.createElement("strong");
        strong1.textContent = detail_coverage.cust_name;
        const span1 = document.createElement("span");
        span1.textContent = `(${detail_coverage.age}세 ,${detail_coverage.gender == 'M' ? '남성' : '여성'} ,생년월일 :${detail_coverage.birth_date}),`;
        li1.appendChild(strong1);
        li1.appendChild(span1);

        // li 2: 상품유형
        const li2 = document.createElement("li");
        const strong2 = document.createElement("strong");
        strong2.textContent = `${detail_coverage.plan_type_name},`;
        li2.appendChild(strong2);

        // li 3: 납기/만기
        const li3 = document.createElement("li");
        const strong3 = document.createElement("strong");
        strong3.textContent = detail_coverage.plan_payment_expiration_name;
        li3.appendChild(strong3);

        // ul에 li들 추가
        ul.appendChild(li1);
        ul.appendChild(li2);
        ul.appendChild(li3);

        // 최종 삽입
        table.appendChild(ul);

        // ✅ target_id가 'payment_period_info'일 경우 추가 폼 생성
        if (target_id == "payment_period_info") {
            const form = document.createElement("form");
            const select = document.createElement("select");
            select.id = "payment_coverage_list";

            detail_coverage.coverage_premiums.forEach(item => {
                if (!item.DispValue) return;
                const option = document.createElement("option");
                option.value = item.company_code;
                option.textContent = `${item.company_name}  ${item.product_name}`;
                select.appendChild(option);
            });

            // 🔥 여기서 이벤트 바로 연결
            select.onchange = (e) => {
                this.handlePaymentPremiumChange();
            };

            form.appendChild(select);
            table.appendChild(form);
        }
        // ✅ target_id가 'aging_info'일 경우 추가 폼 생성
        else if (target_id == 'aging_info') {

            const form = document.createElement("form");
            const select = document.createElement("select");
            select.id = "aging_coverage_list";

            detail_coverage.coverage_premiums.forEach(item => {
                if (!item.DispValue) return;
                const option = document.createElement("option");
                option.value = item.company_code;
                option.textContent = `${item.company_name}  ${item.product_name}`;
                select.appendChild(option);

            });

            // 🔥 여기서 이벤트 바로 연결
            select.onchange = (e) => {
                this.renderCoveragePremiumByAging();
                this.renderCoverageBojangByAging();
            };

            form.appendChild(select);
            table.appendChild(form);
        }
    },


    //최대,최소 보험료 정보
    renderMinMaxPremium() {
        const plan_coverages = detail_coverage.plan_coverages;
        const coverage_premiums = detail_coverage.coverage_premiums || [];
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name;

        const stats = this.calculatePremiumStats(coverage_premiums, plan_payment_expiration_name);
        if (!stats) return; // 데이터 없으면 종료

        // ============================================================
        // ✅ [1] 최저/최대 보험료 상품 테이블 (min_max_coverage_premium)
        // ============================================================
        const premiumTable = document.getElementById("min_max_coverage_premium");
        if (premiumTable) {
            premiumTable.innerHTML = ''; //초기화

            // colgroup 추가
            const colgroup = document.createElement("colgroup");
            ["549px", "426px", "427px"].forEach(width => {
                const col = document.createElement("col");
                col.style.width = width;
                colgroup.appendChild(col);
            });
            premiumTable.appendChild(colgroup);


            //thead 타이틀
            const thead = document.createElement('thead');
            thead.innerHTML = `
            <tr>
                <th>구분</th>
                <th>최저 보험료 상품</th>
                <th>최대 보험료 상품</th>
            </tr>`;
            premiumTable.appendChild(thead);

            const tbody = document.createElement('tbody');

            // 회사명
            let tr1 = document.createElement("tr");
            tr1.innerHTML = `
            <td>회사명</td>
            <td>${coverage_premiums[stats.minPos].company_name}</td>
            <td>${coverage_premiums[stats.maxPos].company_name}</td>`;
            tbody.appendChild(tr1);

            // 상품명
            let tr2 = document.createElement("tr");
            tr2.innerHTML = `
            <td>상품명</td>
            <td>${coverage_premiums[stats.minPos].product_name}</td>
            <td>${coverage_premiums[stats.maxPos].product_name}</td>`;
            tbody.appendChild(tr2);

            // 월 보험료
            let tr3 = document.createElement("tr");
            tr3.innerHTML = `
            <td>월 보험료 ( 차액 : <strong class="plus">+${app.formatNumber(stats.monthlyDiff)}</strong>)</td>
            <td><strong class="minus">${app.formatNumber(coverage_premiums[stats.minPos].total_premium)}</strong></td>
            <td><strong class="plus">${app.formatNumber(coverage_premiums[stats.maxPos].total_premium)}</strong></td>`;
            tbody.appendChild(tr3);

            // 총 납입 보험료
            let tr4 = document.createElement("tr");
            tr4.innerHTML = `
            <td>총 납입 보험료 ( 차액 : <strong class="plus">+${app.formatNumber(stats.totalDiff)}</strong>)</td>
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
            bojangTable.innerHTML = '';
            // colgroup 추가
            const colgroup2 = document.createElement("colgroup");
            ["376px", "173px", "426px", "427px"].forEach(width => {
                const col = document.createElement("col");
                col.style.width = width;
                colgroup2.appendChild(col);
            });
            bojangTable.appendChild(colgroup2);

            // thead
            const thead2 = document.createElement("thead");
            thead2.innerHTML = `
                            <tr>
                                <th>보장</th>
                                <th>가입금액</th>
                                <th>월 보험료</th>
                                <th>월 보험료</th>
                            </tr>`;
            bojangTable.appendChild(thead2);

            // tbody
            const tbody2 = document.createElement("tbody");
            const min_product = coverage_premiums[stats.minPos];
            const max_product = coverage_premiums[stats.maxPos];

            plan_coverages.forEach(bj => {
                if (bj.plan_coverage_selected == "checked") {
                    let min_premium = 0;
                    let max_premium = 0;

                    if (bj.coverage_cd == "aa00") {
                        // coverage_cd = "aa00" 인 모든 항목 합산
                        min_premium = min_product.detailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.premium || 0), 0);
                        max_premium = max_product.detailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.premium || 0), 0);
                    }
                    else {
                        // 기존 로직
                        const min_detailIdx = detail_coverage.guide_coverage_detail_item.get(min_product.company_code + bj.coverage_cd);
                        const max_detailIdx = detail_coverage.guide_coverage_detail_item.get(max_product.company_code + bj.coverage_cd);

                        const min_detail = min_detailIdx ? min_product.detailList[min_detailIdx] : null;
                        const max_detail = max_detailIdx ? max_product.detailList[max_detailIdx] : null;
                        min_premium = min_detail ? min_detail.premium : 0;
                        max_premium = max_detail ? max_detail.premium : 0;
                    }
                    // tr 추가
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${bj.coverage_name}</td>
                        <td>${bj.coverage_cd == 'aa00' ? '-' : app.formatNumber(bj.guide_coverage_amount)}</td>
                        <td>${app.formatNumber(min_premium)}</td>
                        <td>${app.formatNumber(max_premium)}</td>`;
                    tbody2.appendChild(tr);
                }
            });

            // ✅ tbody를 table에 붙여야 렌더링됨
            bojangTable.appendChild(tbody2);
        }
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


        // ✅ colgroup 생성
        const colgroup = document.createElement("colgroup");

        ["189px", ...ages.map(() => "243px")].forEach(width => {
            const col = document.createElement("col");
            col.style.width = width;
            colgroup.appendChild(col);
        });
        agingPremiumTable.appendChild(colgroup);



        // ✅ thead 생성
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        const thFirst = document.createElement("th");

        thFirst.textContent = "구분";
        headerRow.appendChild(thFirst);



        ages.forEach(age => {
            const th = document.createElement("th");
            th.textContent = `${age}세 가입하면`;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        agingPremiumTable.appendChild(thead);



        // ✅ tbody 생성
        const tbody = document.createElement("tbody");

        // [1] 월 보험료 행
        const tr1 = document.createElement("tr");
        tr1.appendChild(Object.assign(document.createElement("td"), { rowSpan: '2', className: 'row', textContent: "월 보험료" }));

        ages.forEach(age => {
            const td = document.createElement("td");
            td.textContent = app.formatNumber(selectedCompany.totals[age]);
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
        tr3.appendChild(Object.assign(document.createElement("td"), { rowSpan: '2', className: 'row', textContent: "총 납입 보험료" }));

        ages.forEach(age => {
            const td = document.createElement("td");
            td.textContent = app.formatNumber(((selectedCompany.totals[age] * payment_period) * 12));
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
                        coverage_amount: d.coverage_amount
                    });
                }
                // premium map
                if (!premiumByCoverage.has(d.coverage_cd)) premiumByCoverage.set(d.coverage_cd, {});
                premiumByCoverage.get(d.coverage_cd)[Number(p.age)] = d.premium ?? 0;
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

            const nameTd = Object.assign(document.createElement("td"), { className: "title-text", textContent: name });
            const amountTd = Object.assign(document.createElement("td"), { textContent: amountText });
            tr.append(nameTd, amountTd);

            agesKeys.forEach((age, i) => {
                const td = document.createElement("td");
                const premium = agePremiums?.[age];
                td.textContent = premium != null ? app.formatNumber(premium) : "0";
                tr.appendChild(td);
            });

            return tr;
        };

        // colgroup
        const colgroup = document.createElement("colgroup");
        [377, 173, ...agesKeys.map(() => 170)].forEach(width => {
            const col = document.createElement("col");
            col.style.width = `${width}px`;
            colgroup.appendChild(col);
        });
        table.appendChild(colgroup);

        // thead
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["보장", "가입금액", ...agesKeys.map((age, i) => i === 0 ? "현재" : `${age}세`)]
            .forEach(text => {
                const th = document.createElement("th");
                th.textContent = text;
                headRow.appendChild(th);
            });
        thead.appendChild(headRow);
        table.appendChild(thead);

        // tbody
        const tbody = document.createElement("tbody");

        coverages.forEach(cov => {
            const agePremiums = premiumByCoverage.get(cov.coverage_cd) || {};
            // (cov.coverage_cd === 'aa00') ? "-" :
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


        // ** colgroup 생성
        const colgroup = document.createElement("colgroup");
        ["550px", "284px", "284px", "284px"].forEach(w => {
            const col = document.createElement("col");
            col.style.width = w;
            colgroup.appendChild(col);
        });
        paymentPremiumTable.appendChild(colgroup);


        // ** thead 생성
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        headRow.appendChild(document.createElement("th"));

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


        companyRows.forEach(item => {
            const th = document.createElement("th");
            const plan_payterm_type_name = item.plan_payterm_type_name;
            th.textContent = plan_payterm_type_name;
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        paymentPremiumTable.appendChild(thead);

        // ** tbody 생성
        const tbody = document.createElement("tbody");

        /* 🔹 [1] 월 보험료 */
        const trMonthly = document.createElement("tr");
        trMonthly.appendChild(this._makeTd("월 보험료"));

        companyRows.forEach(item => {
            trMonthly.appendChild(this._makeTd(app.formatNumber(item.total_premium), true));
        });
        tbody.appendChild(trMonthly);

        /* 🔹 [2] 월 보험료 차액 */
        const trDiff = document.createElement("tr");
        trDiff.className = "gray-bg";
        trDiff.appendChild(this._makeTd("차액", false, "( 선택 상품 - 비교 상품 = 보험료 )"));
        trDiff.appendChild(this._makeTd("-", false, null, "none"));

        for (let i = 1; i < companyRows.length; i++) {
            const diff = companyRows[i].total_premium - companyRows[0].total_premium;
            trDiff.appendChild(this._makeDiffTd(diff));
        }
        tbody.appendChild(trDiff);


        /* 🔹 [3] 총 납입 보험료 */
        const baseTotal = (companyRows[0].total_premium * payment_period) * 12;



        const trTotal = document.createElement("tr");
        trTotal.appendChild(this._makeTd("총 납입 보험료"));
        trTotal.appendChild(this._makeTd(app.formatNumber(baseTotal), true));

        for (let i = 1; i < companyRows.length; i++) {
            const total = (companyRows[i].total_premium * payment_period) * 12;
            trTotal.appendChild(this._makeTd(app.formatNumber(total), true));
        }
        tbody.appendChild(trTotal);


        /* 🔹 [4] 총 납입 보험료 차액 */
        const trTotalDiff = document.createElement("tr");
        trTotalDiff.className = "gray-bg";
        trTotalDiff.appendChild(this._makeTd("차액", false, "( 선택 상품 - 비교 상품 = 보험료 )"));
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

        // 3. 데이터가 있을 때만 아래 로직(테이블 그리기 등) 실행
        //console.log("데이터 있음 - 그리기 시작");

        /* =========================
           colgroup
        ========================= */
        const colgroup = document.createElement("colgroup");
        ["377px", "173px", "284px", "284px", "284px"].forEach(w => {
            const col = document.createElement("col");
            col.style.width = w;
            colgroup.appendChild(col);
        });

        table.appendChild(colgroup);
        /* =========================
           thead
        ========================= */
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");

        ["보장", "가입금액"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headRow.appendChild(th);
        });

        companyRows.forEach(item => {
            const th = document.createElement("th");
            const plan_payterm_type_name = item.plan_payterm_type_name;
            th.textContent = plan_payterm_type_name;
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

        // aa00이 있으면 추가
        // if (coverageMap.has("aa00")) {
        //     coverageMap.set("aa00", {
        //         coverage_cd: "aa00",
        //         coverage_name: "최저기본계약조건",
        //         coverage_seq: -1,
        //         coverage_amount: 0
        //     });
        // }

        //정렬
        const coverageList = Array.from(coverageMap.values()).sort((a, b) => {
            //if (a.coverage_cd === "aa00") return -1;
            //if (b.coverage_cd === "aa00") return 1;
            return (a.coverage_seq ?? 9999) - (b.coverage_seq ?? 9999);
        });

        // 🔥 4️⃣ 행 생성
        coverageList.forEach(baseDetail => {

            const tr = document.createElement("tr");

            // 보장명
            const tdName = document.createElement("td");
            tdName.className = "title-text";
            tdName.textContent = baseDetail.coverage_name;
            tr.appendChild(tdName);

            // 가입금액
            //baseDetail.coverage_cd === "aa00" ? "-" : 
            const coverageAmountText = app.formatNumber(baseDetail.coverage_amount || 0);
            tr.appendChild(this._makeTd(coverageAmountText));

            // 🔥 만기별 보험료
            companyRows.forEach(prod => {
                const matched = (prod.detailList || []).find(d => d.coverage_cd === baseDetail.coverage_cd);
                const premiumText = matched ? app.formatNumber(Math.round(Number(matched.premium || 0))) : "-";
                tr.appendChild(this._makeTd(premiumText));
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
                arr.push({ premium: parseInt(p.total_premium), product_pos: i });
            }
        });

        // 보험료 오름차순 정렬
        arr.sort((a, b) => a.premium - b.premium);

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
        const tabs = document.querySelectorAll('.tab-list > li');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                // 모든 탭/콘텐츠 초기화
                tabs.forEach(li => li.classList.remove('active'));
                contents.forEach(content => content.classList.remove('show'));

                // 클릭된 탭과 콘텐츠 활성화
                tab.classList.add('active');
                contents[index].classList.add('show');

                // ✅ 탭별 기능 실행
                switch (tab.id) {
                    case "premium":
                        this.coverage_min_max_detail();
                        break;
                    case "payment":
                        this.coverage_payment_detail();
                        break;
                    case "aging":
                        this.coverage_aging_detail();
                        break;
                }
            });
        });
    },


    _makeTd(text, strong = false, subText = null, className = "") {
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

};