const BASE_URL = "/";
const API_LOADING = "api/Mobile-Auth";
const API_PRODUCT_PREMIUMS = "api/ProductPremiums";


var state =
{

    plans: [],
    upload_date: {},

    productsGroupList: [],
    paymentExpirationList: [],
    mmcpPlanList: [],
    mmcpUploadDate: [],
    guide_bojang_item: new Map(),

    //초기 데이터
    jwt: "",
    cust_name: "홍길동",
    insur_age: 0,
    gender: "M",
    birth_date: "19850101",
    PlanID: "",


    prdt_cd: "11",
    expiration_cd: "4",
    use_display_yn: "N", //기본값  N으로 고정

    bojangGuideList: [],
    ProductList: [],
    insurProductList: [],


    plan_coverages: [],
    coverage_premiums: [],
    product_insur_premiums: [],


    plan_id: '000000111041', //
    plan_type: '06', //상품유형코드
    plan_name: "손보 종합(무해지)", //상품유형명
    insurance_type: 'F', //생손보유형

    plan_payterm_type: '01', //만기유형코드
    plan_payterm_type_name: "20년/100세", //만기유형명
    checked_val: "전체",


    init: async function () {
        const token = app._getUrlParameter("token");
        this.jwt = token;

        const url = new URL(BASE_URL + API_LOADING, window.location.origin);
        if (token) url.searchParams.append("token", token);
        this.show_spinner();

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.is_success === true) {
                this.setPlanList(data.plans, data.upload_date);
                this.onClickSearch();

            } else {
                // 서버에서 정의한 비즈니스 에러 메시지 처리
                alert(data.message || "데이터 로드에 실패했습니다.");
            }

        } catch (error) {
            // 네트워크 연결 끊김, JSON 파싱 에러 등 처리
            console.error("Fetch Error:", error);
            alert("서버 연결에 실패했거나 응답을 처리할 수 없습니다.");
        } finally {
            this.hide_spinner();
        }
    },

    onClickSearch: async function () {
        // 1. 토큰 존재 확인 (디버깅용 로그 포함)
        const token = state.jwt; // this.jwt 대신 명확하게 state.jwt 사용
        if (!token) {
            alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
            return;
        }


        // 1. URL 및 쿼리 파라미터 구성
        const url = new URL(BASE_URL + API_PRODUCT_PREMIUMS, window.location.origin);

        //url.searchParams.append("token", this.jwt);
        url.searchParams.append("plan_id", this.plan_id);
        url.searchParams.append("insurance_type", this.insurance_type);
        url.searchParams.append("age", this.insur_age);
        url.searchParams.append("gender", this.gender);
        this.show_spinner();


        try {
            // 2. GET 요청 실행
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.jwt}`,
                    "Accept": "application/json"
                }
            });

            const data = await response.json();
            //console.log({ data: data });

            // 3. 비즈니스 로직 성공 여부 확인
            if (data.is_success === true && (data.plan_coverages.length > 0 && data.coverage_premiums.length > 0 && data.product_insur_premiums.length > 0)) {
                this.setCoverageProductList(data);
                this.sync_menu_display();
                this.renderPremiumAsc();
            } else {
                alert(data.error_message || "조회된 상품이 없습니다.");
                this.reset_menu();
            }

        } catch (error) {
            // 네트워크 연결 오류 등 처리
            console.error("Fetch Error:", error.message);
            alert(error.message);
        }
        finally {
            // 성공/실패 여부 상관없이 스피너 제거
            this.hide_spinner();
        }
    },


    set_calculate_age: function () {
        this.insur_age = app._insu_age(this.birth_date);
        $(".old-view-box").text("보험나이 : " + this.insur_age + "세");
    },


    setPlanList: function (plans, upload_date) {
        this.plans = plans;
        this.upload_date = upload_date;
        this.setProductsGroupCD(); //최초 상품유형,만기 불러오기
    },

    setProductsGroupCD: function () {
        const listContainer = document.getElementById("productsgroupList");
        const selectedProductEl = document.getElementById("selected_product");
        const age = this.insur_age;

        // 중복 제거
        const uniquePlanTypes = [...new Map(this.plans.map(p => [p.plan_type, p])).values()];

        // 1. 리스트 생성 (plan_type 속성 사용)
        const listHTML = `<ul>${uniquePlanTypes.map(plan => `
            <li>
                <a href="#none" class="select-btn" plan_type="${plan.plan_type}" onclick="selectProduct(this)"> ${plan.plan_name}</a>
            </li>
        `).join('')}</ul>`;

        listContainer.innerHTML = listHTML;

        // 2. 조건 체크 및 업데이트
        uniquePlanTypes.forEach(plan => {
            const { plan_type, plan_name, plan_id } = plan;
            let isMatch = false;

            if (age <= 15 && plan_type === "19") isMatch = true;
            else if (age >= 15 && age <= 40 && plan_type === "20") isMatch = true;
            else if (age >= 41 && plan_type === "06") isMatch = true;

            if (isMatch) {

                this.plan_id = plan_id; // 플랜아이디
                this.plan_type = plan_type; //상품유형코드
                this.plan_name = plan_name; //상품유형명

                // [핵심] dataset 대신 setAttribute 사용!
                selectedProductEl.setAttribute("plan_type", plan_type);
                selectedProductEl.textContent = plan_name;

                this.setPaymentExpirationCD(plan_type);
                this.setPlanIdByCurrentState();
            }
        });
    },

    setPaymentExpirationCD: function (plan_type) {
        const selectedProductEl = document.getElementById("selected_product");
        const paymentContainer = document.getElementById("paymentgroupList");
        const selectedExpirationEl = document.getElementById("selected_expiration");
        const age = this.insur_age;

        // 1. UI 속성 동기화 (setAttribute 사용)
        selectedProductEl.setAttribute("plan_type", plan_type);

        // 2. 리스트 필터링 및 중복 제거
        const filtered = this.plans.filter(p => p.plan_type == plan_type);
        const uniquePayTerms = [...new Map(filtered.map(p => [p.plan_payterm_type, p])).values()];

        paymentContainer.innerHTML = '';
        // 3. 리스트 렌더링 (plan_payterm_type 속성 사용)
        paymentContainer.innerHTML = `<ul>${uniquePayTerms.map(item => `
            <li>
            <a href="#none" class="select-btn" plan_payterm_type="${item.plan_payterm_type}" onclick="selectExpiration(this)">${item.plan_payterm_type_name}</a>
            </li>
        `).join('')}</ul>`;


        // 4. 자동 선택 대상 결정 로직
        const isAutoSelectMatch = (age <= 15 && plan_type === "19") || (age >= 16 && age <= 40 && plan_type === "20") || (age >= 41 && plan_type === "06");

        let targetItem = null;

        /// [로직] 1순위: "20년/100세"가 포함된 항목 찾기
        targetItem = uniquePayTerms.find(item => item.plan_payterm_type_name.includes("20년/100세"));

        // [로직] 2순위: "20년/100세"가 없을경우, 첫번째 만기 선택
        if (!targetItem && uniquePayTerms.length > 0) {
            targetItem = uniquePayTerms[0];
        }
        // 5. 최종 선택 상품 UI 업데이트
        if (targetItem) {
            const { plan_payterm_type, plan_payterm_type_name } = targetItem;

            this.plan_payterm_type = plan_payterm_type; //만기유형코드
            this.plan_payterm_type_name = plan_payterm_type_name; //만기유형명

            // plan_payterm_type setAttribute
            selectedExpirationEl.setAttribute("plan_payterm_type", plan_payterm_type);
            selectedExpirationEl.textContent = plan_payterm_type_name;

            // if (isAutoSelectMatch) {
            //     console.log("추천 플랜 조건에 의해 자동 선택되었습니다.", { plan_payterm_type, plan_payterm_type_name });
            // }
        }
    },

    setPlanIdByCurrentState: function () {
        //플랜아이디 매칭
        const matched = this.plans.find(p => p.plan_type === this.plan_type && p.plan_payterm_type === this.plan_payterm_type);
        if (matched) {
            //console.log("✅ [매칭 성공] 찾은 plan_id:", matched.plan_id);
            this.plan_id = matched.plan_id;
            this.plan_type = matched.plan_type;
            this.plan_name = matched.plan_name;

            this.plan_payterm_type = matched.plan_payterm_type;
            this.plan_payterm_type_name = matched.plan_payterm_type_name;
        }
        //console.log({ plan_id: this.plan_id, plan_type: this.plan_type, plan_name: this.plan_name, plan_payterm_type: this.plan_payterm_type, plan_payterm_type_name: this.plan_payterm_type_name });
    },



    setCoverageProductList: function (data) {
        //생성
        this.plan_coverages = data.plan_coverages;
        this.coverage_premiums = data.coverage_premiums;
        this.product_insur_premiums = data.product_insur_premiums;

        //console.log({ plan_coverages: this.plan_coverages, coverage_premiums: this.coverage_premiums, product_insur_premiums: this.product_insur_premiums });

        //보장
        for (var i = 0; i < this.plan_coverages.length; i++) {
            //보장 종류 선택 전체-암-뇌-심-진단..
            this.plan_coverages[i].coverages_checked = "all-checked";
        }


        //회사별 대표담보위치
        this.guide_bojang_item = new Map();

        for (var i = 0; i < this.coverage_premiums.length; i++) {
            this.coverage_premiums[i].total_premium = 0;
            for (var j = 0; j < this.coverage_premiums[i].detailList.length; j++) {

                //각 보험료
                this.coverage_premiums[i].detailList[j].color = "price-black"; //black color

                //보장 종류 선택 전체-암-뇌-심-진단..
                this.coverage_premiums[i].detailList[j].coverages_checked = "all-checked";

                //보장 항목 체크,비체크
                this.coverage_premiums[i].detailList[j].cover_selected = "checked";

                //가이드 대표담보 와 상품별 대표담보 위치를 매핑한다.
                this.guide_bojang_item.set(this.coverage_premiums[i].company_code + this.coverage_premiums[i].detailList[j].coverage_cd, j);


                //base_coverage_amount,base_premium 
                this.coverage_premiums[i].detailList[j].base_coverage_amount = this.coverage_premiums[i].detailList[j].guide_coverage_amount;
                this.coverage_premiums[i].detailList[j].base_premium = this.coverage_premiums[i].detailList[j].guide_coverage_premium;

                //합계보험료
                this.coverage_premiums[i].total_premium += Math.floor(this.coverage_premiums[i].detailList[j].guide_coverage_premium);
            }
        }

        //console.log({ plan_coverages: this.plan_coverages, coverage_premiums: this.coverage_premiums });

    },


    //모든 보장을 리셋
    resetAllCoverages: function (checked) {
        // 체크 상태에 따른 값 미리 정의
        const checkedValue = checked ? "all-checked" : "";
        const selectedValue = checked ? "checked" : "";

        // 1. 플랜 보장 리스트 일괄 처리
        this.plan_coverages.forEach(item => {
            item.coverages_checked = checkedValue;
        });

        // 2. 상품별 상세 보장 리스트 일괄 처리 (이중 루프)
        this.coverage_premiums.forEach(product => {
            product.detailList.forEach(detail => {
                detail.coverages_checked = checkedValue;
                detail.cover_selected = selectedValue;
            });
        });
    },

    //보장 종류 선택 시(전체-암-뇌-심-진단-수술-입원) coverages_checked 상태 변경
    syncCoverageSelection: function (checked) {

        // 1. 현재 활성화된 메뉴들의 value 값을 미리 배열로 추출 (매번 DOM 접근 방지)
        const activeValues = Array.from(document.querySelectorAll(".setting-category-list .item-menu-box.active")).map(el => el.getAttribute("value"));
        //console.log({ activeValues: activeValues });

        // [Helper] 보장명 매칭 로직 (수술/입원 특수 케이스 처리)
        const isMatched = (coverageName, targetVal) => {
            if (!targetVal) return false;
            if (targetVal === "수술/입원" || targetVal === "수술입원") {
                return coverageName.includes("수술") || coverageName.includes("입원");
            }
            return coverageName.includes(targetVal);
        };

        // 2. 플랜 보장 리스트 업데이트
        this.plan_coverages.forEach(item => {
            if (checked) {
                // 체크 시: 현재 선택한 값과 매칭되면 체크, 아니면 기존 'all-checked' 해제
                if (isMatched(item.coverage_name, this.checked_val)) {
                    item.coverages_checked = "checked";
                }
                else if (item.coverages_checked === "all-checked") {
                    item.coverages_checked = "";
                }
            }
            else {
                // 체크 해제 시: 남은 활성 메뉴 중 하나라도 매칭되는 게 있는지 확인
                const stillMatches = activeValues.some(val => isMatched(item.coverage_name, val));
                item.coverages_checked = stillMatches ? "checked" : "";
            }
        });

        // 3. 상품별 상세 보장 리스트 업데이트
        this.coverage_premiums.forEach(premium => {
            premium.detailList.forEach(detail => {
                if (checked) {
                    if (isMatched(detail.coverage_name, this.checked_val)) {
                        detail.coverages_checked = "checked";
                        detail.cover_selected = "checked";
                    } else if (detail.coverages_checked === "all-checked") {
                        detail.coverages_checked = "";
                        detail.cover_selected = "";
                    }
                } else {
                    const stillMatches = activeValues.some(val => isMatched(detail.coverage_name, val));
                    const state = stillMatches ? "checked" : "";
                    detail.coverages_checked = state;
                    detail.cover_selected = state;
                }
            });
        });
    },


    // 오름차순 정렬 및 랜더링
    renderPremiumAsc: function () {
        const exception_prdt = ["23", "24", "25", "26", "27", "30", "31"];
        const menuIds = ["all", "cancer", "brain", "heart", "diagnosis", "surgery"];
        const productListContainer = document.getElementById("productList");
        const lowPremiumRadio = document.getElementById("low_premium");

        // 1. 예외 상품유형 코드에 따른 메뉴 비활성화 제어
        const isException = exception_prdt.includes(this.plan_type);

        menuIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.pointerEvents = isException ? "none" : "";
        });

        if (isException) {
            this.sync_opacity();
        }
        else {
            this.reset_opacity();
        }

        // 2. 보험료 오름차순 정렬 (기존 코드보다 간결하게)
        this.coverage_premiums.sort((a, b) => a.total_premium - b.total_premium);

        // 3. 최소/최대 보험료를 가진 회사 코드 추출 (색상 표시용)
        let min_pos = 0;
        let max_pos = 0;
        if (this.coverage_premiums.length > 0) {
            min_pos = this.coverage_premiums[0].company_code;
            max_pos = this.coverage_premiums[this.coverage_premiums.length - 1].company_code;
        }

        // 4. 라디오 버튼 체크 상태 변경
        if (lowPremiumRadio) lowPremiumRadio.checked = true;

        // 5. 리스트 HTML 생성 및 렌더링
        const listHTML = `<ul>${this.coverage_premiums.map(item => {
            // 클래스명 결정
            const class_attr = item.company_code === min_pos ? "price-blue" : item.company_code === max_pos ? "price-red" : "price-black";

            // 숫자 포맷팅 (기존 .format() 대신 표준 toLocaleString() 사용 권장)
            const formattedPremium = item.total_premium.toLocaleString() + "원";

            return `
            <li>
                <a href="javascript:popupOpen('detail','${item.company_code}')" class="item-wrap">
                    <div class="img-box">
                        <img src="./img/${item.company_code}.png" alt="이미지">
                    </div>
                    <div class="info-box">
                        <div class="${class_attr}" company_code="${item.company_code}">
                            ${formattedPremium}
                        </div>
                    </div>
                </a>
            </li>
        `;
        }).join('')}</ul>`;

        productListContainer.innerHTML = listHTML;
    },

    //내림차순 정렬 및 랜더링
    renderPremiumDesc: function () {
        const productListContainer = document.getElementById("productList");
        if (!productListContainer) return;

        const a_href_name = "detail";

        // 1. 보험료 내림차순 정렬 (높은 금액이 위로)
        this.coverage_premiums.sort((a, b) => b.total_premium - a.total_premium);

        //console.log({ coverage_premiums: this.coverage_premiums });


        // 2. 색상 처리를 위한 최저/최고가 위치 파악
        let min_pos = 0;
        let max_pos = 0;

        if (this.coverage_premiums.length > 0) {
            // 내림차순이므로 0번째가 최고가(max), 마지막이 최저가(min)
            max_pos = this.coverage_premiums[0].company_code;
            min_pos = this.coverage_premiums[this.coverage_premiums.length - 1].company_code;
        }

        // 3. 리스트 HTML 생성 (Template Literal 활용)
        const listHTML = `<ul>${this.coverage_premiums.map(item => {
            // 클래스명 결정 로직
            const class_attr = item.company_code === min_pos ? "price-blue" : item.company_code === max_pos ? "price-red" : "price-black";

            // 숫자 콤마 포맷팅 (표준 메서드 사용)
            const formattedPremium = item.total_premium.toLocaleString() + "원";

            return `
            <li>
                <a href="javascript:popupOpen('${a_href_name}','${item.company_code}')" class="item-wrap">
                    <div class="img-box">
                        <img src="./img/${item.company_code}.png" alt="이미지">
                    </div>
                    <div class="info-box">
                        <div class="${class_attr}" company_code="${item.company_code}">
                            ${formattedPremium}
                        </div>
                    </div>
                </a>
            </li>
        `;
        }).join('')}</ul>`;

        // 4. 화면 렌더링 (jQuery의 empty() + html()을 innerHTML로 한 번에 처리)
        productListContainer.innerHTML = listHTML;
    },



    reset_menu: function () {
        // 1. 메뉴 활성화 상태 초기화
        document.querySelectorAll(".item-menu-box").forEach(el => el.classList.remove("active"));
        document.getElementById("all")?.classList.add("active");

        // 2. 화면에서 숨길 요소들 일괄 처리 (display: none)
        const hideSelectors = ["article.popup3", ".mt40", ".list-filter-layout1", ".result-list-layout1"];
        hideSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.style.display = "none");
        });

        // 3. 클릭 방지(pointer-events) 적용할 ID들
        const disablePointerIds = ["all", "cancer", "brain", "heart", "diagnosis", "surgery", "change-bojang"];
        disablePointerIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.pointerEvents = "none";
        });

        // 4. '보장 변경' 버튼 비활성화
        const changeBojangBtn = document.getElementById("change-bojang");
        if (changeBojangBtn) {
            changeBojangBtn.disabled = true;
        }
    },

    sync_menu_display: function () {
        // 1. 개별 요소 및 클래스 요소 노출 (display: block)
        const selectorsToBlock = ['article.popup3', '.mt40', '.list-filter-layout1', '.result-list-layout1'];
        selectorsToBlock.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.style.display = "block");
        });

        // 2. 보장 항목(암, 뇌, 심 등)의 style 속성 일괄 제거
        const menuIds = ["all", "cancer", "brain", "heart", "diagnosis", "surgery"];
        menuIds.forEach(id => {
            document.getElementById(id)?.removeAttribute("style");
        });

        // 3. '보장 변경' 버튼 활성화 및 스타일 조정
        const changeBojangBtn = document.getElementById("change-bojang");
        if (changeBojangBtn) {
            changeBojangBtn.style.pointerEvents = "";
            changeBojangBtn.disabled = false;
        }
    },

    reset_opacity: function () {
        // 1. 초기화할 대상 ID들을 배열로 정의합니다.
        const menuIds = ["all", "cancer", "brain", "heart", "diagnosis", "surgery"];

        // 2. 루프를 돌며 스타일(opacity)을 제거합니다.
        menuIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // 빈 문자열("")을 할당하면 인라인 스타일이 제거되어 CSS 기본값으로 돌아갑니다.
                el.style.opacity = "";
            }
        });
    },


    sync_opacity: function () {
        // 1. 대상 ID들을 배열로 관리합니다.
        const menuIds = ["all", "cancer", "brain", "heart", "diagnosis", "surgery"];

        // 2. 루프를 돌며 스타일을 한꺼번에 적용합니다.
        menuIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = "0.2";
            }
        });
    },


    show_spinner: function () {
        // Show loader when the content is loading
        document.querySelector('.loader-container').style.display = 'flex';
        // Simulate some asynchronous operation (e.g., API request)
    },

    hide_spinner: function () {
        setTimeout(function () {
            // Hide loader when the content has loaded
            document.querySelector('.loader-container').style.display = 'none';
        }, 300); // Replace 500 with the time it takes to load your content
    },

};




$(document).ready(function () {

    state.set_calculate_age();
    state.init();

    // 생년월일 입력 이벤트
    document.getElementById('birth_date').addEventListener("input", function (e) {
        const birth_date = e.target.value;

        // 1. 상태(state) 업데이트
        state.birth_date = birth_date;

        // 2. DOM 속성 동기화 (jQuery의 .attr 및 .val 대체)
        // input 요소의 value 프로퍼티는 이미 업데이트되어 있으나, 
        // HTML 태그 상에 value="..." 속성을 남기기 위해 setAttribute를 사용합니다.
        e.target.setAttribute("value", birth_date);

        // 3. 연쇄 로직 실행 (설정 초기화 -> 보험 나이 계산 -> 상품 그룹 렌더링)
        state.reset_menu();
        state.set_calculate_age();
        state.setProductsGroupCD();
    });

    // 성별 라디오 버튼 이벤트 연결
    document.querySelectorAll('input[type="radio"][name="gender"]').forEach(radio => {
        radio.addEventListener('change', function () {

            // 1. 설정 초기화
            state.reset_menu();

            // 2. 값 업데이트 
            state.gender = this.value;
        });
    });

    // 조회하기 클릭
    document.getElementById("product-retrieve").addEventListener("click", function () {
        const changeBojangBtn = document.getElementById("change-bojang");
        const allProductEl = document.getElementById("all-product");
        const allEl = document.getElementById("all");

        // 1. 생년월일 유효성 체크 (Early Return 패턴 사용)
        if (!app._isValidDate(state.birth_date)) {
            alert("생년월일을 확인해주세요.");
            if (changeBojangBtn) changeBojangBtn.disabled = true;
            state.sync_opacity();
            return;
        }

        // 2. 유효할 경우 처리 (else 제거로 코드 깊이 축소)
        if (changeBojangBtn) changeBojangBtn.disabled = false;

        // 3. active 클래스 일괄 제거 (querySelectorAll 사용)
        const menuBoxes = document.querySelectorAll(".setting-category-list .item-menu-box");
        menuBoxes.forEach(item => item.classList.remove("active"));

        // 4. 특정 요소 active 클래스 추가
        allProductEl?.classList.add("active");
        allEl?.classList.add("active");

        // 5. 상태 업데이트 및 목록 조회
        state.reset_opacity();
        state.onClickSearch();
    });

    // 보험료 정렬 라디오 버튼 이벤트 연결
    document.querySelectorAll('input[type="radio"][name="filter"]').forEach(radio => {
        radio.addEventListener('change', function (e) {
            const change_premium = e.target.value;

            // 1. 값에 따른 정렬 메서드 호출
            if (change_premium === "low_premium") {
                state.renderPremiumAsc();
            }
            else if (change_premium === "high_premium") {
                state.renderPremiumDesc();
            }
            //console.log(`정렬 기준 변경: ${change_premium}`);
        });
    });

});


// 이벤트 위임 방식을 사용하여 클릭 이벤트 처리
document.addEventListener("click", function (e) {
    // 1. 클릭된 요소가 .item-menu-box인지 확인 (상위 요소 포함)
    const target = e.target.closest(".setting-category-list .item-menu-box");
    if (!target) return;

    // 2. 현재 상태값 추출
    const checked = target.classList.contains("active");
    const rawText = target.innerText;

    // "진단" -> "진단비" 매핑 및 공백 제거 (trim 활용)
    const checked_insur_val = (rawText === "진단" ? "진단비" : rawText).trim();

    // 3. 상태(state) 업데이트
    state.checked_val = checked_insur_val;

    // 4. 로직 분기 처리
    if (checked && state.checked_val === "전체") {
        // [케이스 1] '전체' 카테고리가 활성화된 경우
        state.resetAllCoverages(checked);
        product_detail.recalculateTotalPremiumBySelection();

        state.renderPremiumAsc();
    }
    else {
        // [케이스 2] '전체'가 아니거나, 체크 해제된 경우 (중복 로직 통합)
        product_detail.insur_HTML = "";

        // 상태 설정
        state.syncCoverageSelection(checked);
        product_detail.recalculateTotalPremiumBySelection();

        // HTML 생성 및 렌더링
        product_detail.insur_HTML += product_detail.generateCoverageListHTML();

        const detailContainer = document.getElementById("allProductsdetailList");
        if (detailContainer) {
            detailContainer.innerHTML = product_detail.insur_HTML;
        }
        state.renderPremiumAsc();
    }
});
