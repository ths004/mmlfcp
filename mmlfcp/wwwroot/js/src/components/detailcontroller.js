import { app } from '../utils/app.js';
import { apiService } from '../services/apiService.js';


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

    original_coverage_premiums_by_ages: [],
    original_coverage_required_premiums_by_ages: [],

    coverage_premiums_by_ages: [],
    coverage_required_premiums_by_ages: [],
    coverage_premiums_by_ages_totals: [],

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



        const plan_coverages = JSON.parse(localStorage.getItem("plan_coverages") || []);
        const coverage_products = JSON.parse(localStorage.getItem("coverage_products") || []);
        const coverage_insur_premiums_lists = JSON.parse(localStorage.getItem("coverage_insur_premiums_lists") || []);

        const coverage_premiums_by_ages = JSON.parse(localStorage.getItem('coverage_premiums_by_ages') || []);
        const coverage_required_premiums_by_ages = JSON.parse(localStorage.getItem('coverage_required_premiums_by_ages') || []);

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

        detail_coverage.original_coverage_premiums_by_ages = coverage_premiums_by_ages;
        detail_coverage.original_coverage_required_premiums_by_ages = coverage_required_premiums_by_ages;

        //guide_coverage_detail_item  생성
        this.setcoverageDetailMap();

        //이벤트
        this.detail_bindEvents();

        //최대,최소 보험료 정보
        this.render_coverage_min_max_detail();

        //연령별 data setting
        this.render_coverage_ages_detail();

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

    setcoverageByAgeDetail() {
        const coverage_products = detail_coverage.coverage_products || [];
        const source = detail_coverage.original_coverage_premiums_by_ages || [];

        // coverage_products 기반으로 source 갱신
        coverage_products.forEach(prod => {
            prod.DetailList.forEach(detail => {
                if (detail.coverage_amount_ratio) {
                    // 회사 찾기
                    const company = source.find(c => c.company_code == prod.company_code);
                    if (!company) return;

                    // DispValue 복사
                    company.DispValue = prod.DispValue == true;

                    // coverage_cd 매칭
                    const coverage = company.Coverages.find(cov => cov.coverage_cd == detail.coverage_cd);
                    if (!coverage) return;

                    // age별로 배수 적용
                    Object.keys(coverage.DetailByAge).forEach(age => {
                        coverage.DetailByAge[age] = Math.round(
                            coverage.DetailByAge[age] * detail.coverage_amount_ratio
                        );
                    });

                    // coverage_amount 갱신
                    coverage.coverage_amount = detail.coverage_amount;

                    // cover_selected 값 반영
                    coverage.cover_selected = detail.cover_selected || "";
                }
            });
        });

        // 최종 결과를 detail_coverage에 저장
        detail_coverage.coverage_premiums_by_ages = source;
    },

    setCoverageRequiredByAgeDetail() {
        const coverage_products = detail_coverage.coverage_products || [];
        const source = detail_coverage.original_coverage_required_premiums_by_ages || [];

        // ✅ coverage_products의 cover_selected 반영
        coverage_products.forEach(prod => {
            const company = source.find(c => c.company_code == prod.company_code);
            if (!company) return;

            // DispValue 복사
            company.DispValue = prod.DispValue == true;

            // DetailList 중 coverage_cd == "aa00" 항목이 있다면 그걸 기준으로
            const aa00Detail = prod.DetailList.find(d => d.coverage_cd == "aa00");
            if (aa00Detail) {
                company.cover_selected = aa00Detail.cover_selected || "";
            }
        });

        // 최종 결과를 detail_coverage에 저장
        detail_coverage.coverage_required_premiums_by_ages = source;
        // console.log('✅ 최종 coverage_required_premiums_by_ages', detail_coverage.coverage_required_premiums_by_ages);
    },


    setcalculateTotalPremiumsByAgeDetail() {
        const premiums = detail_coverage.coverage_premiums_by_ages || [];
        const required = detail_coverage.coverage_required_premiums_by_ages || [];

        // 결과 Map (company_code → { company_name, product_name, totals })
        const result = new Map();

        // [1] coverage_premiums_by_ages 합산
        premiums.forEach(company => {
            // ✅ 회사 단위로 DispValue 체크
            if (!company.DispValue) return;

            const compKey = company.company_code;
            if (!result.has(compKey)) {
                result.set(compKey, {
                    company_name: company.company_name,
                    product_name: company.product_name,
                    totals: {}
                });
            }

            const compResult = result.get(compKey).totals;

            company.Coverages.forEach(cov => {
                // ✅ cover_selected == "checked" 인 것만 합산
                if (cov.cover_selected == "checked") {
                    Object.entries(cov.DetailByAge).forEach(([age, value]) => {
                        if (!compResult[age]) compResult[age] = 0;
                        compResult[age] += parseInt(value);
                    });
                }
            });
        });

        // [2] coverage_required_premiums_by_ages 합산
        required.forEach(company => {
            // ✅ DispValue 체크 (company 단위)
            if (!company.DispValue) return;

            const compKey = company.company_code;
            if (!result.has(compKey)) {
                result.set(compKey, {
                    company_name: company.company_name,
                    product_name: company.product_name,
                    totals: {}
                });
            }

            const compResult = result.get(compKey).totals;

            // ✅ 최저기본계약조건도 cover_selected == "checked" 조건 적용
            if (company.cover_selected == "checked") {
                Object.entries(company.DetailByAge).forEach(([age, value]) => {
                    if (!compResult[age]) compResult[age] = 0;
                    compResult[age] += parseInt(value);
                });
            }
        });

        // Map → 배열 변환
        const arrayResult = Array.from(result.entries()).map(([company_code, data]) => ({
            company_code,
            company_name: data.company_name,
            product_name: data.product_name,
            totals: data.totals
        }));

        // ✅ detail_coverage.age 값 기준 오름차순 정렬
        arrayResult.sort((a, b) => (a.totals[detail_coverage.age] || 0) - (b.totals[detail_coverage.age] || 0));
        detail_coverage.coverage_premiums_by_ages_totals = arrayResult;
    },

    render_coverage_min_max_detail() {
        this.rendercoverageProductInfo("min_max_product_info");
        this.renderMinMaxPremium();
    },

    render_coverage_ages_detail() {
        this.setcoverageByAgeDetail();
        this.setCoverageRequiredByAgeDetail();
        this.setcalculateTotalPremiumsByAgeDetail();
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


        // ✅ target_id가 'aging_info'일 경우 추가 폼 생성
        if (target_id == 'aging_info') {

            const form = document.createElement("form");
            const select = document.createElement("select");
            select.id = "aging_product_list";

            detail_coverage.coverage_premiums_by_ages_totals.forEach(item => {
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
            const min_product = coverage_products[stats.minPos];
            const max_product = coverage_products[stats.maxPos];

            plan_coverages.forEach(bj => {
                if (bj.plan_coverage_selected == "checked") {
                    let min_premium = 0;
                    let max_premium = 0;

                    if (bj.coverage_cd == "aa00") {
                        // coverage_cd = "aa00" 인 모든 항목 합산
                        min_premium = min_product.DetailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.premium || 0), 0);
                        max_premium = max_product.DetailList.filter(d => d.coverage_cd == "aa00").reduce((sum, d) => sum + (d.premium || 0), 0);
                    }
                    else {
                        // 기존 로직
                        const min_detailIdx = detail_coverage.guide_coverage_detail_item.get(min_product.company_code + bj.coverage_cd);
                        const max_detailIdx = detail_coverage.guide_coverage_detail_item.get(max_product.company_code + bj.coverage_cd);

                        const min_detail = min_detailIdx != null ? min_product.DetailList[min_detailIdx] : null;
                        const max_detail = max_detailIdx != null ? max_product.DetailList[max_detailIdx] : null;
                        min_premium = min_detail != null ? min_detail.premium : 0;
                        max_premium = max_detail != null ? max_detail.premium : 0;
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

    //연령대별 보험료 비교 랜더링
    renderAgingByPremium() {

        //1. 사용자 정보, 상품정보 랜더링
        this.rendercoverageProductInfo("aging_info");

        //2. 월 보험료, 총 납입 보험료
        this.renderCoveragePremiumByAging();

        //3. 연령별 보장 상세
        this.renderCoverageBojangByAging();

    },

    renderCoveragePremiumByAging() {
        const coverage_premiums_by_ages_totals = detail_coverage.coverage_premiums_by_ages_totals || [];
        const selectedValue = document.getElementById("aging_product_list")?.value;
        const plan_payment_expiration_name = detail_coverage.plan_payment_expiration_name || "";

        // 납입기간 계산
        const payment_period =
            plan_payment_expiration_name.includes("1년") ? 1 :
                plan_payment_expiration_name.includes("10년") ? 10 :
                    plan_payment_expiration_name.includes("20년") ? 20 :
                        plan_payment_expiration_name.includes("30년") ? 30 : 1;

        // ✅ company_code와 선택된 값이 일치하는 객체 찾기
        const selectedCompany = coverage_premiums_by_ages_totals.find(item => item.company_code == selectedValue);


        const agingPremiumTable = document.getElementById("aging_premium_info");
        if (!agingPremiumTable) return;
        agingPremiumTable.innerHTML = ''; // 초기화

        // ✅ 연령 키 정렬
        const ages = Object.keys(selectedCompany.totals || {}).sort((a, b) => a - b);

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

    renderCoverageBojangByAging() {

        const coverage_premiums_by_ages = detail_coverage.coverage_premiums_by_ages;
        const coverage_required_premiums_by_ages = detail_coverage.coverage_required_premiums_by_ages;
        const selectedValue = document.getElementById("aging_product_list")?.value; //LHA

        // ✅ 회사 선택
        const selectedCompany = coverage_premiums_by_ages.find(item => item.company_code == selectedValue && item.DispValue);


        const agingBojangTable = document.getElementById("aging_bojang_info");
        if (!agingBojangTable) return;
        agingBojangTable.innerHTML = ''; // 초기화

        // ✅ DetailByAge 키 동적으로 추출 & 정렬
        const sampleCoverage = selectedCompany.Coverages.find(c => c.cover_selected == "checked");
        if (!sampleCoverage) return;

        let agesKeys = Object.keys(sampleCoverage.DetailByAge || {}).map(Number).sort((a, b) => a - b);
        agesKeys = agesKeys.map(String); // 숫자 → 문자열 변환


        // ✅ colgroup 생성
        const colgroup = document.createElement("colgroup");
        [377, 173].forEach(w => {
            const col = document.createElement("col");
            col.width = `${w}px`;
            colgroup.appendChild(col);
        });
        agesKeys.forEach(() => {
            const col = document.createElement("col");
            col.width = "170px";
            colgroup.appendChild(col);
        });
        agingBojangTable.appendChild(colgroup);


        // ✅ thead 생성
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");

        // 기본 컬럼
        ["보장", "가입금액"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headRow.appendChild(th);
        });

        // 나이 컬럼
        agesKeys.forEach((age, idx) => {
            const th = document.createElement("th");
            th.textContent = idx == 0 ? "현재" : `${age}세`;
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        agingBojangTable.appendChild(thead);


        // ✅ tbody 생성
        const tbody = document.createElement("tbody");


        // [1] coverage_required_premiums_by_ages 먼저 렌더링
        const requiredRow = coverage_required_premiums_by_ages.find(req => req.company_code == selectedValue && req.cover_selected == "checked" && req.DispValue);
        if (requiredRow) {
            const tr = document.createElement("tr");

            const tdName = document.createElement("td");
            tdName.className = "title-text";
            tdName.textContent = requiredRow.coverage_name;

            const tdAmount = document.createElement("td");
            tdAmount.textContent = '-'; // 가입금액은 무조건 '-'

            tr.appendChild(tdName);
            tr.appendChild(tdAmount);

            agesKeys.forEach(age => {
                const td = document.createElement("td");
                const required_premium = requiredRow.DetailByAge[age];
                td.textContent = required_premium != undefined ? app.formatNumber(required_premium) : 0; //최저기본계약조건 보험료
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }


        // [2] coverage_premiums_by_ages 이어서 렌더링
        selectedCompany.Coverages.forEach(cov => {
            if (cov.cover_selected == "checked") {
                const tr = document.createElement("tr");

                const tdName = document.createElement("td");
                tdName.className = "title-text";
                tdName.textContent = cov.coverage_name;

                const tdAmount = document.createElement("td");
                tdAmount.textContent = app.formatNumber(cov.coverage_amount); //가입금액

                tr.appendChild(tdName);
                tr.appendChild(tdAmount);

                // 나이별 값
                agesKeys.forEach(age => {
                    const td = document.createElement("td");
                    const coverage_premium = cov.DetailByAge[age];
                    td.textContent = coverage_premium != undefined ? app.formatNumber(coverage_premium) : 0;  //보험료
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            }
        });
        agingBojangTable.appendChild(tbody);
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
                        this.render_coverage_min_max_detail();
                        break;
                    case "aging":
                        this.renderAgingByPremium();
                        break;
                }
            });
        });
    },




};