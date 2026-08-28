const BASE_URL = "/";
const API_LOADING = "api/Mobile-Auth";
const API_PRODUCT_PREMIUMS = "api/ProductPremiums";
const MOBILE_TOKEN_KEY = "mmlfcp_auth_token";


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
    insurance_type: 'F', //생손보유형 F|L (모바일은 생손보 LF 미지원)
    plan_category: '종합', //상품군

    plan_payterm_type: '01', //만기유형코드
    plan_payterm_type_name: "20년/100세", //만기유형명
    checked_val: "전체",

    /** 상품군 표시 순서 — 데스크톱과 동일 */
    PLAN_CATEGORY_ORDER: ['종합', '건강', '간편', '어린이·청소년', '기타'],


    /** URL/session 토큰 확보 후 주소창에서 token 제거 */
    resolveAuthToken: function () {
        let token = app._getUrlParameter("token");
        if (!token || token === true) {
            try {
                token = sessionStorage.getItem(MOBILE_TOKEN_KEY) || "";
            } catch (_) {
                token = "";
            }
        } else {
            try {
                sessionStorage.setItem(MOBILE_TOKEN_KEY, token);
            } catch (_) { /* ignore */ }
            try {
                const u = new URL(window.location.href);
                if (u.searchParams.has("token")) {
                    u.searchParams.delete("token");
                    const next = u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : "") + u.hash;
                    history.replaceState(history.state, "", next);
                }
            } catch (_) { /* ignore */ }
        }
        this.jwt = token || "";
        return this.jwt;
    },

    /** 상품유형 표시명 — 앞의 생손보/손보/생보 접두어 숨김 */
    formatPlanTypeLabel: function (planName) {
        return String(planName || "").replace(/^(생손보|손보|생보)\s+/, "");
    },

    /**
     * 표시용 상품명 → 상품군 키
     * (간편실손은 '간편'이 아닌 '기타') — 데스크톱과 동일
     */
    getPlanCategoryKey: function (displayLabel) {
        const t = String(displayLabel || "").trim();
        if (!t) return "기타";
        if (/^간편실손/.test(t)) return "기타";
        if (/^간편/.test(t)) return "간편";
        // 여성건강(무해지) → 종합 카테고리
        if (/^종합|^여성건강/.test(t) || /^\d+(\.\d+)+/.test(t)) return "종합";
        if (/^건강/.test(t)) return "건강";
        if (/^어린이|^청소년/.test(t)) return "어린이·청소년";
        return "기타";
    },

    /** 세부 목록 표시명 — 간편군에서는 '간편' 접두 생략 */
    formatPlanDetailLabel: function (displayLabel, categoryKey) {
        const t = String(displayLabel || "");
        if (categoryKey === "간편") {
            return t.replace(/^간편\s*/, "") || t;
        }
        return t;
    },

    /** 트리거 표시: 간편은 '군 · 세부', 그 외는 세부명만 */
    formatPlanPickerTriggerText: function (categoryKey, displayLabel) {
        const detail = this.formatPlanDetailLabel(displayLabel, categoryKey);
        if (!detail) return categoryKey || "상품 선택";
        if (categoryKey === "간편") return `간편 · ${detail}`;
        return detail;
    },

    /** 여성 전용 상품 (남성일 때 목록 제외) */
    isFemaleOnlyPlan: function (plan) {
        const type = String(plan?.plan_type ?? "");
        if (type === "08") return true;
        const label = this.formatPlanTypeLabel(plan?.plan_name || "").trim();
        return /^여성/.test(label);
    },

    init: async function () {
        const token = this.resolveAuthToken();
        if (!token) {
            alert("인증 토큰이 없습니다. 다시 접속해 주세요.");
            return;
        }

        const url = new URL(BASE_URL + API_LOADING, window.location.origin);
        url.searchParams.append("token", token);
        url.searchParams.append("access_path", "MMLFCP_MOBILE");
        url.searchParams.append("device", "MOBILE");
        this.show_spinner();

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            });
            const data = await response.json();
            if (data.is_success === true) {
                this.set_calculate_age();
                this.setPlanList(data.plans, data.upload_date);
                await this.onClickSearch();
            } else {
                alert(data.message || data.error_message || "데이터 로드에 실패했습니다.");
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            alert("서버 연결에 실패했거나 응답을 처리할 수 없습니다.");
        } finally {
            this.hide_spinner();
        }
    },

    onClickSearch: async function () {
        const token = this.jwt || this.resolveAuthToken();
        if (!token) {
            alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
            return;
        }

        if (!app._isValidDate(this.birth_date)) {
            alert("생년월일을 확인해주세요.");
            return;
        }

        this.set_calculate_age();
        this.setPlanIdByCurrentState();

        if (!this.plan_id) {
            this.showEmptyResults("해당 조건으로 조회된 상품이 없습니다.");
            return;
        }

        const url = new URL(BASE_URL + API_PRODUCT_PREMIUMS, window.location.origin);
        url.searchParams.append("plan_id", this.plan_id);
        url.searchParams.append("insurance_type", this.insurance_type);
        url.searchParams.append("age", String(this.insur_age));
        url.searchParams.append("gender", this.gender);
        this.show_spinner();

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`조회 요청 실패 (${response.status})`);
            }

            const data = await response.json();
            const hasCoverages = Array.isArray(data.plan_coverages) && data.plan_coverages.length > 0;
            const hasPremiums = Array.isArray(data.coverage_premiums) && data.coverage_premiums.length > 0;

            if (data.is_success === true && hasCoverages && hasPremiums) {
                this.setCoverageProductList(data);
                this.sync_menu_display();
                this.renderPremiumAsc();
            } else {
                this.showEmptyResults("해당 조건으로 조회된 상품이 없습니다.");
            }

        } catch (error) {
            console.error("Fetch Error:", error.message);
            this.showEmptyResults("해당 조건으로 조회된 상품이 없습니다.");
        }
        finally {
            this.hide_spinner();
        }
    },


    set_calculate_age: function () {
        const birthEl = document.getElementById("birth_date");
        if (birthEl && birthEl.value) {
            this.birth_date = String(birthEl.value).replace(/\D/g, "").slice(0, 8);
        }
        this.insur_age = app._insu_age(this.birth_date);
        $(".old-view-box").text("보험나이 : " + this.insur_age + "세");
        this.syncBirthDatePicker();
    },

    /** 텍스트 생년월일 → (레거시) date picker 동기화 — 커스텀 모달 사용으로 no-op 유지 */
    syncBirthDatePicker: function () {
        // custom modal reads state.birth_date on open
    },

    /** 생년월일 적용 (텍스트/캘린더 공통) */
    applyBirthDateValue: function (rawValue, options = {}) {
        const birth_date = app._toYyyymmdd(rawValue) || String(rawValue || "").replace(/\D/g, "").slice(0, 8);
        const birthEl = document.getElementById("birth_date");
        if (birthEl) {
            birthEl.value = birth_date;
            birthEl.setAttribute("value", birth_date);
        }

        this.birth_date = birth_date;
        this.reset_menu();
        this.set_calculate_age();

        // 데스크톱 setDefaultByAge와 동일: 손보 + 나이별 상품유형 + 20년/100세
        this.insurance_type = "F";
        this.plan_type = this.getDefaultPlanTypeByAge(this.insur_age);
        this.plan_payterm_type = "01";
        this.plan_payterm_type_name = "20년/100세";
        this.plan_category = this.getPreferredCategoryForInsurance(this.insurance_type, this.insur_age);

        this.setProductsGroupCD();

        if (options.autoSearch !== false && birth_date.length === 8 && app._isValidDate(birth_date)) {
            this.scheduleAutoSearch({ delay: options.delay ?? 280 });
        }
    },

    _calendarView: { year: 1985, month: 0, selectedYmd: "19850101", yearPickerOpen: false },
    _calendarYearMin: 1920,
    _calendarYearMax: 2026,

    openBirthCalendar: function () {
        const modal = document.getElementById("birth_calendar_modal");
        if (!modal) return;

        const ymd = app._toYyyymmdd(this.birth_date) || "19850101";
        const y = parseInt(ymd.slice(0, 4), 10);
        const m = parseInt(ymd.slice(4, 6), 10) - 1;
        this._calendarView = {
            year: y,
            month: m,
            selectedYmd: app._isValidDate(ymd) ? ymd : "19850101",
            yearPickerOpen: false
        };
        this.setBirthCalendarYearPicker(false);
        this.renderBirthCalendar();
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("birth-calendar-open");
    },

    closeBirthCalendar: function () {
        const modal = document.getElementById("birth_calendar_modal");
        if (!modal) return;
        this.setBirthCalendarYearPicker(false);
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("birth-calendar-open");
    },

    shiftBirthCalendarMonth: function (delta) {
        if (this._calendarView.yearPickerOpen) {
            this.setBirthCalendarYearPicker(false);
        }
        let { year, month } = this._calendarView;
        month += delta;
        if (month < 0) {
            month = 11;
            year -= 1;
        } else if (month > 11) {
            month = 0;
            year += 1;
        }
        if (year < this._calendarYearMin || year > this._calendarYearMax) return;
        this._calendarView.year = year;
        this._calendarView.month = month;
        this.renderBirthCalendar();
    },

    toggleBirthCalendarYearPicker: function () {
        this.setBirthCalendarYearPicker(!this._calendarView.yearPickerOpen);
    },

    setBirthCalendarYearPicker: function (open) {
        this._calendarView.yearPickerOpen = !!open;
        const yearPanel = document.getElementById("birth_cal_year_panel");
        const monthPanel = document.getElementById("birth_cal_month_panel");
        const titleBtn = document.getElementById("birth_calendar_title");
        const prevBtn = document.getElementById("birth_cal_prev");
        const nextBtn = document.getElementById("birth_cal_next");

        if (yearPanel) yearPanel.hidden = !open;
        if (monthPanel) monthPanel.hidden = !!open;
        if (titleBtn) {
            titleBtn.setAttribute("aria-expanded", open ? "true" : "false");
            titleBtn.classList.toggle("is-year-open", !!open);
        }
        if (prevBtn) prevBtn.disabled = !!open;
        if (nextBtn) nextBtn.disabled = !!open;

        if (open) {
            this.renderBirthCalendarYearList();
        }
    },

    renderBirthCalendarYearList: function () {
        const listEl = document.getElementById("birth_cal_year_list");
        if (!listEl) return;

        const selectedYear = this._calendarView.year;
        const years = [];
        for (let y = this._calendarYearMax; y >= this._calendarYearMin; y--) {
            const isActive = y === selectedYear;
            years.push(
                `<button type="button" class="birth-cal-year-item${isActive ? " is-selected" : ""}" data-year="${y}" role="option" aria-selected="${isActive ? "true" : "false"}">${y}년</button>`
            );
        }
        listEl.innerHTML = years.join("");

        const active = listEl.querySelector(".birth-cal-year-item.is-selected");
        if (active) {
            requestAnimationFrame(() => {
                active.scrollIntoView({ block: "center", inline: "nearest" });
            });
        }
    },

    selectBirthCalendarYear: function (year) {
        const y = Number(year);
        if (!Number.isFinite(y) || y < this._calendarYearMin || y > this._calendarYearMax) return;
        this._calendarView.year = y;

        // 선택된 일자 연도만 맞추고 월/일은 유지 (말일 보정)
        const selected = this._calendarView.selectedYmd || "";
        if (/^\d{8}$/.test(selected)) {
            const month = parseInt(selected.slice(4, 6), 10);
            let day = parseInt(selected.slice(6, 8), 10);
            const maxDay = new Date(y, month, 0).getDate();
            if (day > maxDay) day = maxDay;
            this._calendarView.month = month - 1;
            this._calendarView.selectedYmd =
                String(y) +
                String(month).padStart(2, "0") +
                String(day).padStart(2, "0");
        }

        this.setBirthCalendarYearPicker(false);
        this.renderBirthCalendar();
    },

    renderBirthCalendar: function () {
        const yearLabel = document.getElementById("birth_cal_year_label");
        const monthLabel = document.getElementById("birth_cal_month_label");
        const daysEl = document.getElementById("birth_calendar_days");
        if (!daysEl) return;

        const { year, month, selectedYmd } = this._calendarView;
        if (yearLabel) yearLabel.textContent = `${year}년`;
        if (monthLabel) monthLabel.textContent = `${month + 1}월`;

        const firstDay = new Date(year, month, 1);
        const startWeekday = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayYmd =
            String(today.getFullYear()) +
            String(today.getMonth() + 1).padStart(2, "0") +
            String(today.getDate()).padStart(2, "0");

        const cells = [];
        for (let i = 0; i < startWeekday; i++) {
            cells.push(`<button type="button" class="birth-cal-day is-empty" tabindex="-1" aria-hidden="true"></button>`);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const ymd =
                String(year) +
                String(month + 1).padStart(2, "0") +
                String(d).padStart(2, "0");
            const weekday = (startWeekday + d - 1) % 7;
            const classes = ["birth-cal-day"];
            if (weekday === 0) classes.push("is-sunday");
            if (weekday === 6) classes.push("is-saturday");
            if (ymd === todayYmd) classes.push("is-today");
            if (ymd === selectedYmd) classes.push("is-selected");
            cells.push(
                `<button type="button" class="${classes.join(" ")}" data-ymd="${ymd}" aria-label="${year}년 ${month + 1}월 ${d}일">${d}</button>`
            );
        }

        daysEl.innerHTML = cells.join("");
    },

    selectBirthCalendarDay: function (ymd) {
        if (!app._isValidDate(ymd)) return;
        this._calendarView.selectedYmd = ymd;
        this.renderBirthCalendar();
    },

    confirmBirthCalendar: function () {
        const ymd = this._calendarView.selectedYmd;
        this.closeBirthCalendar();
        if (ymd) {
            this.applyBirthDateValue(ymd, { delay: 120 });
        }
    },


    setPlanList: function (plans, upload_date) {
        this.plans = Array.isArray(plans) ? plans : [];
        this.upload_date = upload_date || {};
        this.setProductsGroupCD(); //최초 상품유형,만기 불러오기
    },

    /** 모바일 지원 보험유형만 정규화 (F|L). LF·기타는 빈 문자열 */
    normalizeInsuranceType: function (value) {
        const t = String(value || "").trim().toUpperCase();
        if (t === "L") return "L";
        if (t === "F") return "F";
        return "";
    },

    /** 모바일에서 조회 가능한 플랜 여부 */
    isMobileSupportedPlan: function (plan) {
        return this.normalizeInsuranceType(plan?.insurance_type) !== "";
    },

    /** 현재 성별·생손보 기준 노출 가능 플랜 */
    getVisiblePlans: function () {
        const gender = this.gender || "M";
        this.insurance_type = this.normalizeInsuranceType(this.insurance_type) || "F";
        let list = this.plans.filter((p) =>
            this.normalizeInsuranceType(p.insurance_type) === this.insurance_type
        );
        if (gender === "M") {
            list = list.filter((p) => !this.isFemaleOnlyPlan(p));
        }
        return list;
    },

    /** 고유 상품유형(+표시명·상품군) */
    getUniquePlanTypes: function () {
        const visiblePlans = this.getVisiblePlans();
        return [...new Map(visiblePlans.map((p) => [p.plan_type, p])).values()].map((plan) => {
            const displayLabel = this.formatPlanTypeLabel(plan.plan_name);
            const categoryKey = this.getPlanCategoryKey(displayLabel);
            return {
                ...plan,
                displayLabel,
                categoryKey,
            };
        });
    },

    /** 나이 기반 기본 상품유형 — 데스크톱 setDefaultByAge와 동일(손보 기준) */
    getDefaultPlanTypeByAge: function (age) {
        if (age <= 15) return "19"; // 손보 어린이(무해지)
        if (age > 15 && age <= 40) return "20"; // 손보 청소년
        return "06"; // 손보 종합(무해지)
    },

    /** 보험유형별 기본 상품군 */
    getPreferredCategoryForInsurance: function (insuranceType, age) {
        const type = String(insuranceType || "F").toUpperCase();
        if (type === "L") return "건강";
        if (age <= 40) return "어린이·청소년";
        return "종합";
    },

    /** 손보(F) 기본 상품유형 — 종합(무해지) */
    applyFireDefaultPlanType: function () {
        const plans = this.getUniquePlanTypes();
        const preferred = plans.find((p) => String(p.plan_type) === "06")
            || plans.find((p) => /^종합\s*\(무해지\)/.test(String(p.displayLabel || "")));

        if (preferred) {
            this.plan_type = preferred.plan_type;
            this.plan_name = preferred.plan_name || "손보 종합(무해지)";
            this.plan_category = preferred.categoryKey || "종합";
            return;
        }

        this.plan_type = "06";
        this.plan_name = "손보 종합(무해지)";
        this.plan_category = "종합";
    },

    /** 생보(L) 기본 상품유형 — 건강군 우선 */
    applyLifeDefaultPlanType: function () {
        const plans = this.getUniquePlanTypes();
        const preferred = plans.find((p) => p.categoryKey === "건강")
            || plans[0];

        if (preferred) {
            this.plan_type = preferred.plan_type;
            this.plan_name = preferred.plan_name;
            this.plan_category = preferred.categoryKey || "건강";
            return;
        }

        this.plan_category = "건강";
    },

    /** 상품군 칩 UI 동기화 — 항상 available 중 하나가 active */
    renderPlanCategoryChips: function (availableCategories) {
        const box = document.getElementById("plan_category_box");
        if (!box) return;

        const available = Array.isArray(availableCategories) ? availableCategories : this.PLAN_CATEGORY_ORDER;
        let current = this.plan_category;
        if (!available.includes(current)) {
            current = available[0] || "";
            if (current) this.plan_category = current;
        }

        box.innerHTML = this.PLAN_CATEGORY_ORDER.map((key) => {
            const enabled = available.includes(key);
            const active = enabled && key === current;
            return `<button type="button" class="plan-category-chip${active ? " is-active" : ""}${enabled ? "" : " is-disabled"}"
                data-category="${key}" aria-pressed="${active ? "true" : "false"}"
                ${enabled ? "" : "disabled aria-disabled=\"true\""}>${key}</button>`;
        }).join("");
    },

    /** 보험유형 라디오 UI 동기화 (F|L) */
    syncInsuranceTypeUI: function () {
        this.insurance_type = this.normalizeInsuranceType(this.insurance_type) || "F";
        document.querySelectorAll('input[type="radio"][name="insurance_type"]').forEach((radio) => {
            radio.checked = radio.value === this.insurance_type;
        });
    },

    /** 사용 가능한 상품군 중 현재값 보정 */
    resolvePlanCategory: function (availableCategories, age) {
        const available = Array.isArray(availableCategories) ? availableCategories : [];
        if (available.length === 0) {
            this.plan_category = "기타";
            return this.plan_category;
        }
        if (available.includes(this.plan_category)) {
            return this.plan_category;
        }
        const preferred = this.getPreferredCategoryForInsurance(this.insurance_type, age);
        this.plan_category = available.includes(preferred) ? preferred : available[0];
        return this.plan_category;
    },

    setProductsGroupCD: function () {
        const listContainer = document.getElementById("productsgroupList");
        const selectedProductEl = document.getElementById("selected_product");
        if (!listContainer || !selectedProductEl) return;

        this.syncInsuranceTypeUI();

        const age = this.insur_age;
        let uniquePlanTypes = this.getUniquePlanTypes();

        // 현재 상품유형이 해당 생손보에 없으면 유형별 기본값 적용
        const hasCurrent = uniquePlanTypes.some((p) => String(p.plan_type) === String(this.plan_type));
        if (!hasCurrent) {
            if (this.insurance_type === "L") {
                this.applyLifeDefaultPlanType();
            } else {
                this.applyFireDefaultPlanType();
            }
            uniquePlanTypes = this.getUniquePlanTypes();
        }

        const availableCategories = this.PLAN_CATEGORY_ORDER.filter(
            (key) => uniquePlanTypes.some((p) => p.categoryKey === key)
        );

        const matchedByType = uniquePlanTypes.find((p) => String(p.plan_type) === String(this.plan_type));
        if (matchedByType) {
            this.plan_category = matchedByType.categoryKey;
        } else {
            this.resolvePlanCategory(availableCategories, age);
        }
        // 칩/목록용으로 항상 available 범위로 한 번 더 보정
        this.resolvePlanCategory(availableCategories, age);
        this.renderPlanCategoryChips(availableCategories);

        const categoryPlans = uniquePlanTypes.filter((p) => p.categoryKey === this.plan_category);

        listContainer.innerHTML = `<ul>${categoryPlans.map((plan) => `
            <li>
                <a href="#none" class="select-btn" plan_type="${plan.plan_type}" onclick="selectProduct(this)">${this.formatPlanDetailLabel(plan.displayLabel, plan.categoryKey)}</a>
            </li>
        `).join("")}</ul>`;

        if (categoryPlans.length === 0) {
            selectedProductEl.textContent = "상품 없음";
            selectedProductEl.removeAttribute("plan_type");
            this.renderPlanCategoryChips(availableCategories);
            return;
        }

        const preferredType = this.getDefaultPlanTypeByAge(age);
        let selected = categoryPlans.find((p) => String(p.plan_type) === String(this.plan_type))
            || categoryPlans.find((p) => String(p.plan_type) === String(preferredType))
            || categoryPlans[0];

        if (this.gender === "M" && this.isFemaleOnlyPlan(selected)) {
            selected = categoryPlans.find((p) => String(p.plan_type) === String(preferredType)) || categoryPlans[0];
        }

        this.applySelectedPlan(selected);
        // 최종 선택 상품군으로 칩 재동기화
        this.renderPlanCategoryChips(availableCategories);
        this.setPaymentExpirationCD(this.plan_type);
        this.setPlanIdByCurrentState();
    },

    applySelectedPlan: function (plan) {
        if (!plan) return;
        const selectedProductEl = document.getElementById("selected_product");
        this.plan_type = plan.plan_type;
        this.plan_name = plan.plan_name;
        this.plan_id = plan.plan_id;
        const normalized = this.normalizeInsuranceType(plan.insurance_type);
        if (normalized) {
            this.insurance_type = normalized;
        }
        const displayLabel = plan.displayLabel || this.formatPlanTypeLabel(plan.plan_name);
        const categoryKey = plan.categoryKey || this.getPlanCategoryKey(displayLabel);
        this.plan_category = categoryKey;
        if (selectedProductEl) {
            selectedProductEl.setAttribute("plan_type", plan.plan_type);
            selectedProductEl.textContent = this.formatPlanPickerTriggerText(categoryKey, displayLabel);
        }
    },

    /** 생손보 유형 변경 (모바일: 손보/생보만) */
    setInsuranceType: function (insuranceType) {
        const next = this.normalizeInsuranceType(insuranceType) || "F";
        if (this.insurance_type === next) return;
        this.insurance_type = next;

        if (next === "L") {
            this.applyLifeDefaultPlanType();
        } else {
            this.applyFireDefaultPlanType();
        }

        this.setProductsGroupCD();
        this.setPlanIdByCurrentState();
        this.scheduleAutoSearch({ delay: 180 });
    },

    /** 상품군 변경 */
    setPlanCategory: function (categoryKey) {
        const key = String(categoryKey || "").trim();
        if (!key || key === this.plan_category) return;

        const uniquePlanTypes = this.getUniquePlanTypes();
        const availableCategories = this.PLAN_CATEGORY_ORDER.filter(
            (c) => uniquePlanTypes.some((p) => p.categoryKey === c)
        );
        if (!availableCategories.includes(key)) return;

        this.plan_category = key;
        // 해당 군의 첫 상품(또는 나이 기본)으로 전환
        const categoryPlans = uniquePlanTypes.filter((p) => p.categoryKey === key);
        const preferredType = this.getDefaultPlanTypeByAge(this.insur_age);
        const selected = categoryPlans.find((p) => String(p.plan_type) === String(preferredType))
            || categoryPlans[0];
        if (selected) {
            this.plan_type = selected.plan_type;
        } else {
            this.plan_type = "";
        }
        this.setProductsGroupCD();
        this.setPlanIdByCurrentState();
        this.scheduleAutoSearch({ delay: 180 });
    },

    setPaymentExpirationCD: function (plan_type) {
        const selectedProductEl = document.getElementById("selected_product");
        const paymentContainer = document.getElementById("paymentgroupList");
        const selectedExpirationEl = document.getElementById("selected_expiration");
        if (!paymentContainer || !selectedExpirationEl) return;

        if (selectedProductEl) {
            selectedProductEl.setAttribute("plan_type", plan_type);
        }

        // 현재 손보/생보 유형의 동일 plan_type만 (LF 제외)
        const filtered = this.getVisiblePlans().filter((p) => String(p.plan_type) === String(plan_type));
        const uniquePayTerms = [...new Map(filtered.map((p) => [p.plan_payterm_type, p])).values()];

        paymentContainer.innerHTML = `<ul>${uniquePayTerms.map((item) => `
            <li>
            <a href="#none" class="select-btn" plan_payterm_type="${item.plan_payterm_type}" onclick="selectExpiration(this)">${item.plan_payterm_type_name}</a>
            </li>
        `).join("")}</ul>`;

        if (uniquePayTerms.length === 0) {
            selectedExpirationEl.textContent = "만기 없음";
            selectedExpirationEl.removeAttribute("plan_payterm_type");
            return;
        }

        // 현재 선택 유지 우선 → 01(20년/100세) → 06(종신) → 첫 항목
        let targetItem = uniquePayTerms.find((item) => String(item.plan_payterm_type) === String(this.plan_payterm_type))
            || uniquePayTerms.find((item) => String(item.plan_payterm_type) === "01")
            || uniquePayTerms.find((item) => String(item.plan_payterm_type) === "06")
            || uniquePayTerms[0];

        this.plan_payterm_type = targetItem.plan_payterm_type;
        this.plan_payterm_type_name = targetItem.plan_payterm_type_name;
        const normalized = this.normalizeInsuranceType(targetItem.insurance_type);
        if (normalized) this.insurance_type = normalized;
        if (targetItem.plan_id) this.plan_id = targetItem.plan_id;

        selectedExpirationEl.setAttribute("plan_payterm_type", targetItem.plan_payterm_type);
        selectedExpirationEl.textContent = targetItem.plan_payterm_type_name;
    },

    setPlanIdByCurrentState: function () {
        this.insurance_type = this.normalizeInsuranceType(this.insurance_type) || "F";
        const planType = String(this.plan_type ?? "");
        const payterm = String(this.plan_payterm_type ?? "");

        // LF 플랜은 절대 매칭하지 않음 — plan_id/insurance_type 불일치로 조회 실패 방지
        const candidates = this.plans.filter((p) =>
            this.normalizeInsuranceType(p.insurance_type) === this.insurance_type
            && String(p.plan_type) === planType
        );

        let matched = candidates.find((p) => String(p.plan_payterm_type) === payterm)
            || candidates.find((p) => String(p.plan_payterm_type) === "01")
            || candidates.find((p) => String(p.plan_payterm_type) === "06")
            || candidates[0];

        if (!matched) {
            this.plan_id = "";
            return;
        }

        this.plan_id = matched.plan_id;
        this.plan_type = matched.plan_type;
        this.plan_name = matched.plan_name;
        this.plan_payterm_type = matched.plan_payterm_type;
        this.plan_payterm_type_name = matched.plan_payterm_type_name;
        this.insurance_type = this.normalizeInsuranceType(matched.insurance_type) || this.insurance_type;
        const displayLabel = this.formatPlanTypeLabel(matched.plan_name);
        this.plan_category = this.getPlanCategoryKey(displayLabel);
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
        if (!productListContainer) return;

        if (!Array.isArray(this.coverage_premiums) || this.coverage_premiums.length === 0) {
            this.renderEmptyProductList();
            return;
        }

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
        const listHTML = `<ul>${this.coverage_premiums.map((item, index) => {
            const class_attr = item.company_code === min_pos ? "price-blue" : item.company_code === max_pos ? "price-red" : "price-black";
            const formattedPremium = item.total_premium.toLocaleString() + "원";
            const companyName = item.company_name || item.product_name || "";

            return `
            <li>
                <a href="javascript:popupOpen('detail','${item.company_code}')" class="item-wrap">
                    <div class="rank-box">${index + 1}</div>
                    <div class="img-box">
                        <img src="./img/${item.company_code}.png" alt="${companyName || "보험사"}">
                    </div>
                    <div class="info-box">
                        ${companyName ? `<div class="company-name">${companyName}</div>` : ""}
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

        if (!Array.isArray(this.coverage_premiums) || this.coverage_premiums.length === 0) {
            this.renderEmptyProductList();
            return;
        }

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
        const listHTML = `<ul>${this.coverage_premiums.map((item, index) => {
            const class_attr = item.company_code === min_pos ? "price-blue" : item.company_code === max_pos ? "price-red" : "price-black";
            const formattedPremium = item.total_premium.toLocaleString() + "원";
            const companyName = item.company_name || item.product_name || "";

            return `
            <li>
                <a href="javascript:popupOpen('${a_href_name}','${item.company_code}')" class="item-wrap">
                    <div class="rank-box">${index + 1}</div>
                    <div class="img-box">
                        <img src="./img/${item.company_code}.png" alt="${companyName || "보험사"}">
                    </div>
                    <div class="info-box">
                        ${companyName ? `<div class="company-name">${companyName}</div>` : ""}
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

    /** 목록 영역 빈 결과 안내 */
    renderEmptyProductList: function (message) {
        const productListContainer = document.getElementById("productList");
        if (!productListContainer) return;
        const text = message || "해당 조건으로 조회된 상품이 없습니다.";
        productListContainer.innerHTML = `
            <div class="empty-result" role="status" aria-live="polite">
                <p class="empty-result-text">${text}</p>
            </div>
        `;
    },

    /** 조회 결과 없음 — 목록 위치에 안내 문구 표시 */
    showEmptyResults: function (message) {
        this.plan_coverages = [];
        this.coverage_premiums = [];
        this.product_insur_premiums = [];

        // 카테고리/정렬은 숨기고, 목록 영역만 노출
        document.querySelectorAll("article.popup3, .mt40, .list-filter-layout1").forEach((el) => {
            el.style.display = "none";
        });

        const resultsEl = document.querySelector(".result-list-layout1");
        if (resultsEl) resultsEl.style.display = "";

        const changeBojangBtn = document.getElementById("change-bojang");
        if (changeBojangBtn) {
            changeBojangBtn.disabled = true;
            changeBojangBtn.style.pointerEvents = "none";
        }

        this.renderEmptyProductList(message);
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
        // 1. 개별 요소 및 클래스 요소 노출 (인라인 display 제거 → CSS 기본값)
        const selectorsToBlock = ['article.popup3', '.mt40', '.list-filter-layout1', '.result-list-layout1'];
        selectorsToBlock.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => { el.style.display = ""; });
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

    /** 조회 버튼/자동조회 공통 진입점 */
    prepareAndSearch: function () {
        const changeBojangBtn = document.getElementById("change-bojang");
        const allProductEl = document.getElementById("all-product");
        const allEl = document.getElementById("all");

        this.set_calculate_age();

        if (!app._isValidDate(this.birth_date)) {
            if (changeBojangBtn) changeBojangBtn.disabled = true;
            this.sync_opacity();
            return false;
        }

        if (changeBojangBtn) changeBojangBtn.disabled = false;

        document.querySelectorAll(".setting-category-list .item-menu-box").forEach(item => {
            item.classList.remove("active");
        });
        allProductEl?.classList.add("active");
        allEl?.classList.add("active");

        this.reset_opacity();
        this.setPlanIdByCurrentState();
        this.onClickSearch();
        return true;
    },

    /**
     * 조건 변경 시 자동 조회 (디바운스)
     * @param {{ delay?: number, requireValidBirth?: boolean }} options
     */
    scheduleAutoSearch: function (options = {}) {
        const delay = typeof options.delay === "number" ? options.delay : 220;
        const requireValidBirth = options.requireValidBirth !== false;

        if (this._autoSearchTimer) {
            clearTimeout(this._autoSearchTimer);
            this._autoSearchTimer = null;
        }

        this._autoSearchTimer = setTimeout(() => {
            this._autoSearchTimer = null;
            if (!this.jwt && !this.resolveAuthToken()) return;
            if (requireValidBirth && !app._isValidDate(this.birth_date)) return;
            if (!this.plan_id) {
                this.setPlanIdByCurrentState();
            }
            if (!this.plan_id) return;
            this.prepareAndSearch();
        }, delay);
    },

};




$(document).ready(function () {

    state.set_calculate_age();
    state.init();

    // 생년월일 입력 이벤트
    document.getElementById('birth_date').addEventListener("input", function (e) {
        const birth_date = String(e.target.value || "").replace(/\D/g, "").slice(0, 8);
        e.target.value = birth_date;
        state.applyBirthDateValue(birth_date, { delay: 380 });
    });

    // 커스텀 캘린더 모달
    const birthCalBtn = document.getElementById("birth_calendar_btn");
    const birthCalModal = document.getElementById("birth_calendar_modal");
    if (birthCalBtn) {
        birthCalBtn.addEventListener("click", function () {
            state.openBirthCalendar();
        });
    }
    if (birthCalModal) {
        birthCalModal.addEventListener("click", function (e) {
            if (e.target.closest("[data-calendar-close]")) {
                state.closeBirthCalendar();
                return;
            }
            const yearBtn = e.target.closest(".birth-cal-year-item[data-year]");
            if (yearBtn) {
                state.selectBirthCalendarYear(yearBtn.getAttribute("data-year"));
                return;
            }
            const dayBtn = e.target.closest(".birth-cal-day[data-ymd]");
            if (dayBtn) {
                state.selectBirthCalendarDay(dayBtn.getAttribute("data-ymd"));
            }
        });
    }
    document.getElementById("birth_calendar_title")?.addEventListener("click", function () {
        state.toggleBirthCalendarYearPicker();
    });
    document.getElementById("birth_cal_prev")?.addEventListener("click", function () {
        state.shiftBirthCalendarMonth(-1);
    });
    document.getElementById("birth_cal_next")?.addEventListener("click", function () {
        state.shiftBirthCalendarMonth(1);
    });
    document.getElementById("birth_cal_today")?.addEventListener("click", function () {
        const now = new Date();
        state._calendarView.year = now.getFullYear();
        state._calendarView.month = now.getMonth();
        state.setBirthCalendarYearPicker(false);
        state.renderBirthCalendar();
    });
    document.getElementById("birth_cal_confirm")?.addEventListener("click", function () {
        state.confirmBirthCalendar();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && birthCalModal && !birthCalModal.hidden) {
            if (state._calendarView.yearPickerOpen) {
                state.setBirthCalendarYearPicker(false);
            } else {
                state.closeBirthCalendar();
            }
        }
    });

    // 성별 라디오 버튼 이벤트 연결
    document.querySelectorAll('input[type="radio"][name="gender"]').forEach(radio => {
        radio.addEventListener('change', function () {
            state.reset_menu();
            state.gender = this.value;
            // 성별 변경 시 상품 목록(여성전용 등) 재구성
            state.setProductsGroupCD();
            state.setPlanIdByCurrentState();
            state.scheduleAutoSearch({ delay: 180 });
        });
    });

    // 생보/손보 유형
    document.querySelectorAll('input[type="radio"][name="insurance_type"]').forEach((radio) => {
        radio.addEventListener("change", function () {
            if (typeof state.reset_menu === "function") state.reset_menu();
            state.setInsuranceType(this.value);
        });
    });

    // 상품군(종합/간편/어린이·청소년/기타)
    const planCategoryBox = document.getElementById("plan_category_box");
    if (planCategoryBox) {
        planCategoryBox.addEventListener("click", function (e) {
            const chip = e.target.closest(".plan-category-chip[data-category]");
            if (!chip || chip.disabled || chip.classList.contains("is-disabled")) return;
            if (typeof state.reset_menu === "function") state.reset_menu();
            state.setPlanCategory(chip.getAttribute("data-category"));
        });
    }

    // 조회하기 / 다시 조회
    document.getElementById("product-retrieve").addEventListener("click", function () {
        if (!app._isValidDate(state.birth_date)) {
            alert("생년월일을 확인해주세요.");
            return;
        }
        state.prepareAndSearch();
    });

    // 보험료 정렬 라디오 버튼 이벤트 연결
    document.querySelectorAll('input[type="radio"][name="filter"]').forEach(radio => {
        radio.addEventListener('change', function (e) {
            const change_premium = e.target.value;

            if (change_premium === "low_premium") {
                state.renderPremiumAsc();
            }
            else if (change_premium === "high_premium") {
                state.renderPremiumDesc();
            }
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

        const detailContainer = document.getElementById("allProductsDetailList");
        if (detailContainer) {
            detailContainer.innerHTML = product_detail.insur_HTML;
        }
        state.renderPremiumAsc();
    }
});
