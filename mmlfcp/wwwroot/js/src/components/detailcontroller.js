import { app } from '../utils/app.js';


/*
    
        // ✅ 필요한 key만 갱신
        localStorage.setItem('cust_name', mmlfcp_state.get('cust_name'));
        localStorage.setItem('birth_date', mmlfcp_state.get('birth_date'));
        localStorage.setItem('age', mmlfcp_state.get('age'));
        localStorage.setItem('gender', mmlfcp_state.get('gender'));

        //상품유형
        localStorage.setItem('plan_id', mmlfcp_state.get('plan_id'));
        localStorage.setItem('plan_type_id', mmlfcp_state.get('plan_type_id'));
        localStorage.setItem('plan_type_name', mmlfcp_state.get('plan_type_name'));

        //만기
        localStorage.setItem('plan_payment_expiration_cd', mmlfcp_state.get('plan_payment_expiration_cd'));
        localStorage.setItem('plan_payment_expiration_name', mmlfcp_state.get('plan_payment_expiration_name'));
*/


const detail_coverage = {

    cust_name: '',
    birth_date: '',
    age: 0,
    gender: '',

    plan_id: '',
    plan_type_id: '',
    plan_type_name: '',


    plan_payment_expiration_cd: '',
    plan_payment_expiration_name: '',

    plan_coverages: [],
    coverage_products: [],
    coverage_insur_premiums_lists: [],

    guide_coverage_detail_item: new Map(),
};

export const detailController = {
    init() {
        // console.log("[Detail Controller] 초기화 시작");

        const cust_name = localStorage.getItem("cust_name");
        const birth_date = localStorage.getItem('birth_date');
        const age = localStorage.getItem("age");
        const gender = localStorage.getItem('gender');

        //상품유형
        const plan_id = localStorage.getItem("plan_id");
        const plan_type_id = localStorage.getItem('plan_type_id');
        const plan_type_name = localStorage.getItem("plan_type_name");

        //만기
        const plan_payment_expiration_cd = localStorage.getItem('plan_payment_expiration_cd');
        const plan_payment_expiration_name = localStorage.getItem("plan_payment_expiration_name");



        const plan_coverages = JSON.parse(localStorage.getItem("plan_coverages") || "[]");
        const coverage_products = JSON.parse(localStorage.getItem("coverage_products") || "[]");
        const coverage_insur_premiums_lists = JSON.parse(localStorage.getItem("coverage_insur_premiums_lists") || "[]");

        detail_coverage.cust_name = cust_name;
        detail_coverage.birth_date = birth_date;
        detail_coverage.age = age;
        detail_coverage.gender = gender;

        detail_coverage.plan_id = plan_id;
        detail_coverage.plan_type_id = plan_type_id;
        detail_coverage.plan_type_name = plan_type_name;

        detail_coverage.plan_payment_expiration_cd = plan_payment_expiration_cd;
        detail_coverage.plan_payment_expiration_name = plan_payment_expiration_name;


        // detail_coverage 내부 보관
        detail_coverage.plan_coverages = plan_coverages;
        detail_coverage.coverage_products = coverage_products;
        detail_coverage.coverage_insur_premiums_lists = coverage_insur_premiums_lists;

        // console.log(cust_name + "," + birth_date + "," + age + "," + gender);

        // console.log(plan_id + "," + plan_type_id + "," + plan_type_name + "," + plan_payment_expiration_cd + "," + plan_payment_expiration_name);

        // console.log('init() plan_coverages', detail_coverage.plan_coverages);
        // console.log('init() coverage_products', detail_coverage.coverage_products);
        // console.log('init() coverage_insur_premiums_lists', detail_coverage.coverage_insur_premiums_lists);
        // console.log("[Detail Controller] 초기화 완료");


        //guide_coverage_detail_item  생선
        this.setcoverageDetailMap();

        //최대,최소 보험료 정보
        this.render_coverage_min_max_detail();

    },


    setcoverageDetailMap() {
        // 변수 선언
        const coverage_products = detail_coverage.coverage_products;

        //초기화
        detail_coverage.guide_coverage_detail_item = new Map();

        coverage_products.forEach(company => {
            company.DetailList.forEach((detail, j) => {
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

    render_coverage_min_max_detail() {
        this.rendercoverageProductInfo();
        this.renderMinMaxPremium();
    },

    //상품조건 정보
    rendercoverageProductInfo() {
        const table = document.getElementById("min_max_product_info");
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

    },

    //최대,최소 보험료 정보
    renderMinMaxPremium() {
        const coverage_products = detail_coverage.coverage_products;
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name;

        const stats = this.calculatePremiumStats(coverage_products, plan_payment_expiration_name);
        if (!stats) return; // 데이터 없으면 종료
        // 예시 사용
        // console.log("최저 보험료:", stats.minPremium);
        // console.log("최대 보험료:", stats.maxPremium);
        // console.log("월 보험료 차액:", stats.monthlyDiff);
        // console.log("총 납입보험료 차액:", stats.totalDiff);


        // ============================================================
        // ✅ [1] 최저/최대 보험료 상품 테이블 (min_max_premium_info)
        // ============================================================
        const premiumTable = document.getElementById("min_max_premium_info");
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
            <td>${coverage_products[stats.minPos].company_name}</td>
            <td>${coverage_products[stats.maxPos].company_name}</td>`;
            tbody.appendChild(tr1);

            // 상품명
            let tr2 = document.createElement("tr");
            tr2.innerHTML = `
            <td>상품명</td>
            <td>${coverage_products[stats.minPos].product_name}</td>
            <td>${coverage_products[stats.maxPos].product_name}</td>`;
            tbody.appendChild(tr2);

            // 월 보험료
            let tr3 = document.createElement("tr");
            tr3.innerHTML = `
            <td>월 보험료 ( 차액 : <strong class="plus">+${app.formatNumber(stats.monthlyDiff)}</strong>)</td>
            <td><strong class="minus">${app.formatNumber(coverage_products[stats.minPos].total_premium)}</strong></td>
            <td><strong class="plus">${app.formatNumber(coverage_products[stats.maxPos].total_premium)}</strong></td>`;
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
        // ✅ [2] 보장정보 테이블 (min_max_bojang_info)
        // ============================================================
        const bojangTable = document.getElementById("min_max_bojang_info");
        const plan_coverages = detail_coverage.plan_coverages;
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

            const thead2 = document.createElement("thead");
            thead2.innerHTML = `
                <tr>
                    <th>보장</th>
                    <th>가입금액</th>
                    <th>월 보험료</th>
                    <th>월 보험료</th>
                </tr>`;
            bojangTable.appendChild(thead2);

            const tbody2 = document.createElement("tbody");
            const min_product = coverage_products[stats.minPos];
            const max_product = coverage_products[stats.maxPos];

            plan_coverages.forEach(bj => {
                if (bj.plan_coverage_selected == "checked") {
                    const min_detailIdx = detail_coverage.guide_coverage_detail_item.get(min_product.company_code + bj.coverage_cd);
                    const max_detailIdx = detail_coverage.guide_coverage_detail_item.get(max_product.company_code + bj.coverage_cd);

                    const min_detail = min_detailIdx != null ? min_product.DetailList[min_detailIdx] : null;
                    const max_detail = max_detailIdx != null ? max_product.DetailList[max_detailIdx] : null;

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${bj.coverage_name}</td>
                        <td>${bj.coverage_cd == 'aa00' ? '-' : app.formatNumber(bj.guide_coverage_amount)}</td>
                        <td>${min_detail != null ? app.formatNumber(min_detail.premium) : 0}</td>
                        <td>${max_detail != null ? app.formatNumber(max_detail.premium) : 0}</td>`;
                    tbody2.appendChild(tr);
                }
            });
            bojangTable.appendChild(tbody2);
        }
    },

    /**
     * 최저/최대 보험료 및 차액 계산
     * @param {Array} coverage_products - 보험 상품 리스트
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
    calculatePremiumStats(coverage_products, plan_payment_expiration_name) {
        const arr = [];

        // 납입기간 추출
        const payment_period = plan_payment_expiration_name.indexOf("1년") >= 0 ? 1 : plan_payment_expiration_name.indexOf("10년") >= 0 ? 10 : plan_payment_expiration_name.indexOf("20년") >= 0 ? 20 : plan_payment_expiration_name.indexOf("30년") >= 0 ? 30 : 1;

        //coverage_products 중 DispValue 가 true 만 배열에 추가해준다.
        coverage_products.forEach((p, i) => {
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

        const minPremium = coverage_products[minPos].total_premium;
        const maxPremium = coverage_products[maxPos].total_premium;
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

};