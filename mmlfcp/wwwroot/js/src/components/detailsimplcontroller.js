
import { app } from '../utils/app.js';
import { apiService } from '../services/apiService.js';
import { mmlfcp_state } from '../core/state.js';

const simplified_detail_coverage =
{
    cust_name: '',
    birth_date: '',
    age: 0,
    gender: '',

    plan_id: '',
    plan_type: '',
    plan_type_name: '',


    plan_payterm_type: '',
    plan_payment_expiration_name: '',
    coverage_cd_checked: {},
    company_code_checked: {},

    guide_coverage_item: {},
    coverage_product_result: [],

    simplified_plan_coverages: [],
    simplified_coverage_premiums: [],
    simplified_coverage_insur_premiums: [],
    simplified_required_coverage_premiums: [],
    coverage_ratio_map: {},
};


export const detailSimplController = {
    async init() {
        this.loadBasicInfo();

        //1. 서버 데이터 조회 및 보험료 계산 로직 실행
        await this.getPlanSimplifiPremiumsComparison();

        //2. 고객정보, 상품 select 박스 생성
        this.setupComparisonHeader();

        //3. map 생성
        this.setFilteredProductsMap();

        //4. 보험사 상품유형, 월보험료 정보
        this.setupComparisonMain();

        //5. 담보리스트 랜더링
        this.renderCoverageList();

        //6. 상품별 보험료 랜더링
        this.renderPremiumTable();

        //7. 이벤트 실행
        this.simplifi_events();

    },

    loadBasicInfo() {
        simplified_detail_coverage.cust_name = localStorage.getItem('cust_name') || '';
        simplified_detail_coverage.birth_date = localStorage.getItem('birth_date') || '';
        simplified_detail_coverage.age = localStorage.getItem('age') || 0;
        simplified_detail_coverage.gender = localStorage.getItem('gender') || '';


        simplified_detail_coverage.plan_id = localStorage.getItem('plan_id') || '';
        simplified_detail_coverage.plan_type = localStorage.getItem('plan_type_id') || '';
        simplified_detail_coverage.plan_type_name = localStorage.getItem('plan_type_name') || '';

        simplified_detail_coverage.coverage_cd_checked = JSON.parse(localStorage.getItem('coverage_cd_checked') || {});
        simplified_detail_coverage.company_code_checked = JSON.parse(localStorage.getItem('company_code_checked') || {});

        simplified_detail_coverage.plan_payterm_type = localStorage.getItem('plan_payment_expiration_cd') || '';
        simplified_detail_coverage.plan_payment_expiration_name = localStorage.getItem('plan_payment_expiration_name') || '';

        simplified_detail_coverage.simplified_plan_coverages = JSON.parse(localStorage.getItem("plan_coverages") || []);
        simplified_detail_coverage.coverage_ratio_map = JSON.parse(localStorage.getItem("coverage_ratio_map") || {});

    },

    async getPlanSimplifiPremiumsComparison() {
        try {

            const { plan_id, plan_type, plan_payterm_type, age, gender } = simplified_detail_coverage;
            const res = await apiService.getPlanCoveragePremiumsComparison({ plan_id, plan_type, plan_payterm_type, age, gender });
            if (res?.is_success == true) {

                // 👉 state에 캐싱
                simplified_detail_coverage.simplified_coverage_premiums = res.simplified_coverage_premiums;
                simplified_detail_coverage.simplified_coverage_insur_premiums = res.simplified_coverage_insur_premiums;
                simplified_detail_coverage.simplified_required_coverage_premiums = res.simplified_required_coverage_premiums;
                this.setPlanSimplifiPreiumsComparison();
                this.setPlanSimplifiPreiumsDetailComparison();
            }
        }
        catch (err) {
            alert(err?.message || '무해지 및 간편보험료 비교 조회 중 오류가 발생했습니다.');
            return;
        }
    },

    setPlanSimplifiPreiumsComparison() {
        const {
            simplified_coverage_premiums,
            simplified_required_coverage_premiums,
            coverage_cd_checked,
            company_code_checked,
            plan_type,
        } = simplified_detail_coverage;

        // 1️⃣ 데이터 전처리 (파싱 및 맵 생성)
        const ratioMap = this._getSafeRatioMap(simplified_detail_coverage.coverage_ratio_map);
        const checked_coverage_cd = (coverage_cd_checked || "").split(',').map(s => s.trim()).filter(Boolean);
        const checked_company_code = (company_code_checked || "").split(',').map(s => s.trim()).filter(Boolean);

        // 필수보험료 그룹화 (ID 기반 매핑)
        const reqMap = simplified_required_coverage_premiums.reduce((map, r) => {
            const key = `${r.company_code}_${r.product_code}`;
            (map[key] ||= []).push(r);
            return map;
        }, {});

        //simplified_coverage_premiums 매핑
        const products = Array.isArray(simplified_coverage_premiums) ? simplified_coverage_premiums : [simplified_coverage_premiums];

        //납입 기간 산출
        const periods = [1, 10, 20, 30];
        const payment_period = periods.find(p => simplified_detail_coverage.plan_payment_expiration_name.includes(`${p}년`)) || 1;

        // 2️⃣ 메인 로직 실행
        products.forEach(product => {
            product.DispValue = checked_company_code.includes(product.company_code);
            //aa00 setting
            this._ensureMinimumContract(product, reqMap);

            let currentTotal = 0; // 합계용 변수 분리
            product.detailList.forEach(detail => {
                // 1. 체크 여부 판단 (공백 제거 확실히!)
                const isSelected = checked_coverage_cd.includes(String(detail.coverage_cd).trim());

                // 2. 비율 계산 (비율에 따라 detail.premium이 바뀔 수 있음)
                this._calculateDetailRatio(detail, ratioMap);

                // 3. 상태값 먼저 업데이트
                detail.is_selected_coverage = isSelected ? 'Y' : 'N';
                detail.cover_selected = isSelected ? 'checked' : '';

                // 4. '최종 확정된 상태'가 'checked'인 경우에만 합산
                if (detail.cover_selected === 'checked') {
                    currentTotal += Math.round(detail.premium || 0);

                }
            });

            //총 보험료 합계 구하기
            product.total_premium = currentTotal;
            // 총 납입 보험료 계산 (월 보험료 * 12개월 * 납입년수)
            product.payment_total_premium = currentTotal * payment_period * 12;

        });

        // 🌟 정렬: 조회한 유형 우선 + 보험료 오름차순
        products.sort((a, b) => {
            const aMatch = String(a.plan_type) === String(plan_type);
            const bMatch = String(b.plan_type) === String(plan_type);
            if (aMatch !== bMatch) return aMatch ? -1 : 1;
            return (a.total_premium || 0) - (b.total_premium || 0);
        });

        simplified_detail_coverage.simplified_coverage_premiums = products;
        //console.log('[🚀 상품별 보험료 갱신 완료]', products);
    },

    setPlanSimplifiPreiumsDetailComparison() {
        const {
            simplified_coverage_insur_premiums: product_insur_premiums,
            simplified_required_coverage_premiums: required_premiums,
            coverage_ratio_map: coverage_ratio_map,
            company_code_checked
        } = simplified_detail_coverage


        // 필수보험료 그룹화 (ID 기반 매핑)
        const reqMap = required_premiums.reduce((map, r) => {
            const key = `${r.company_code}_${r.product_code}`;
            (map[key] ||= []).push(r);
            return map;
        }, {});


        // 1️. 데이터 전처리 (파싱 및 맵 생성)
        const ratioMap = this._getSafeRatioMap(coverage_ratio_map);
        const checked_company_code = (company_code_checked || "").split(',').map(s => s.trim()).filter(Boolean);
        const products = Array.isArray(product_insur_premiums) ? product_insur_premiums : [product_insur_premiums];

        // 2. 메인 로직 실행
        products.forEach(product => {
            product.DispValue = checked_company_code.includes(product.company_code);

            //aa00 setting
            this._ensureMinimumContractDetail(product, reqMap);

            //비율 계산 (비율에 따라 detail.premium이 바뀔 수 있음)
            product.detailList.forEach(detail => {
                this._calculateInsurDetailRatio(detail, ratioMap);
            });
        });
        //simplified_coverage_insur_premiums 반영
        simplified_detail_coverage.simplified_coverage_insur_premiums = products;
        //console.log('[🚀 상품별 상세 보험료 갱신 완료]', products);
    },

    //map 생성
    setFilteredProductsMap() {
        const { simplified_coverage_premiums: allProducts } = simplified_detail_coverage;
        const selectedCompany = document.getElementById('product_group_name')?.value;

        if (!selectedCompany) {
            console.warn("⚠️ 선택된 보험사가 없습니다.");
            return;
        }

        // 1️⃣ 선택된 보험사의 상품만 필터링하여 저장
        const filteredProducts = allProducts.filter(p => p.company_code === selectedCompany);
        simplified_detail_coverage.coverage_product_result = filteredProducts;

        // 2️⃣ 가이드 맵 생성 (reduce를 활용하여 객체 생성 로직을 일원화)
        const guideMap = filteredProducts.reduce((map, product) => {
            if (!Array.isArray(product.detailList)) return map;

            product.detailList.forEach((detail, index) => {
                const key = `${product.company_code}_${product.product_code}_${detail.coverage_cd}`;
                // 초기화 로직을 짧게 처리
                if (!map[key]) map[key] = [];
                map[key].push(index);
            });
            return map;
        }, {});

        // 3️⃣ 최종 결과 저장 및 로그
        simplified_detail_coverage.guide_coverage_item = guideMap;
        //console.log(`[📍${selectedCompany} 지도 생성 완료]`, guideMap);
    },

    // [헤더 정보 및 보험사 선택박스 렌더링]
    setupComparisonHeader() {
        const { cust_name, birth_date, age, gender, plan_type_name, plan_payment_expiration_name, simplified_coverage_premiums } = simplified_detail_coverage;

        // 1. 상단 텍스트 정보(고객, 납기, 플랜명) 업데이트
        this.renderTextInfo({ cust_name, birth_date, age, gender, plan_type_name, plan_payment_expiration_name });

        // 2. 보험사 선택(Select Box) 필터링 및 구성
        this.setupCompanySelect(simplified_coverage_premiums);

    },

    //보험사 상품유형, 월보험료 정보
    setupComparisonMain() {
        const { simplified_coverage_premiums } = simplified_detail_coverage;

        //1. 상품유형 정보
        this.CompanyInfo(simplified_coverage_premiums);

        //2. 월 보험료 정보
        this.MonthlyPremiumInfo(simplified_coverage_premiums);

        //3. 총 납입 보험료 정보
        this.PaymentTotalPremiumInfo(simplified_coverage_premiums);
    },


    //상단 텍스트 정보(고객, 납기, 플랜명) 업데이트
    renderTextInfo(data) {
        const { cust_name, birth_date, age, gender, plan_type_name, plan_payment_expiration_name } = data;

        const genderText = gender === 'M' ? '남성' : '여성';
        const formattedDate = app.formatDate(birth_date);

        // 고객정보
        const custInfo = document.getElementById('cust_info');
        if (custInfo) {
            custInfo.innerHTML = `
            <strong>${cust_name}</strong>
            <span>(${age}세, ${genderText}, 생년월일 : ${formattedDate})</span>
        `;
        }

        // 만기정보
        const paymentInfo = document.getElementById('payment_info');
        if (paymentInfo) {
            paymentInfo.innerHTML = `<strong>${plan_payment_expiration_name},</strong>`;
        }

        // 상품정보 (플랜유형)
        const productInfo = document.getElementById("product_info");
        if (productInfo) {
            productInfo.innerHTML = `<strong>${plan_type_name},</strong>`;
        }
    },

    //보험사 선택(Select Box) 필터링 및 구성
    setupCompanySelect(simplified_coverage_premiums) {
        if (!Array.isArray(simplified_coverage_premiums)) return;

        // 1️⃣ [수정] 이미 정렬된 simplified_coverage_premiums 순서를 그대로 유지하며 중복 제거
        // filter 내 index 확인 로직을 통해 "정렬된 순서의 첫 번째 보험사"가 유지됩니다.
        const uniqueCompanies = simplified_coverage_premiums
            .filter(item => item.DispValue === true)
            .map(item => ({
                company_code: item.company_code,
                company_name: item.company_name
            }))
            .filter((company, index, self) =>
                index === self.findIndex((t) => t.company_code === company.company_code)
            );

        // 🔹 Select Box 렌더링
        const productGroupSelect = document.getElementById('product_group_name');
        if (productGroupSelect) {
            const optionsHTML = uniqueCompanies.map((product, index) => {
                const selected = index === 0 ? "selected" : "";
                return `<option value="${product.company_code}" ${selected}>${product.company_name}</option>`;
            }).join("");

            productGroupSelect.innerHTML = optionsHTML;
        }
    },

    //보험사 정보
    CompanyInfo(simplified_coverage_premiums) {
        const simplifi_company_lists = document.getElementById('simplifi_company_lists');
        const selectedCompany = document.getElementById('product_group_name')?.value;

        if (!Array.isArray(simplified_coverage_premiums)) return;
        if (!simplifi_company_lists) return;
        if (!selectedCompany) { console.warn("⚠️ 선택된 보험사가 없습니다."); return; }

        // 1️⃣ 선택된 보험사의 상품만 필터링하여 저장
        const filteredProducts = simplified_coverage_premiums.filter(p => p.company_code === selectedCompany);

        // 2. 템플릿 리터럴을 활용한 HTML 생성
        const listItemsHtml = filteredProducts.map((product, i) => {
            const checkId = `chk_${product.company_code}_${product.product_code}`;
            const btnId = `btn_${product.company_code}_${product.product_code}`;
            return `
                <li>
                <div class='innerc'>
                    <div class='checkbox-area'>
                        <input type='checkbox' id='${checkId}' company_code='${product.company_code}' company_name='${product.company_name}' ${[product.DispValue ? 'checked' : '']}>
                            <label for='${checkId}'></label>
                    </div>
                    
                    <div class='img-area' style='font-size:14px;'>${product.plan_name}</div>
                        <button type='button' id='${btnId}' class='btn__product-info'>상품정보</button>

                    <div class='alert__product-info'>
                        <img src='./images/ico__alert-close.svg' alt='닫기' class='btn-close__alert'>
                            <div class='alert__top'>
                                <span>${product.company_name}</span>
                                <strong>${product.product_name}</strong>
                            </div>
                            <div class='alert__bottom'>
                                <strong>${product.product_detail_name}</strong>
                                <br />
                                <span>가입조건 :</span>
                                <strong>${product.product_conditions}</strong>
                            </div>
                    </div>
                </div>
            </li > `;
        }).join('');
        // 3. 최종 HTML 삽입 (ul 태그로 감싸기)
        simplifi_company_lists.innerHTML = `<ul>${listItemsHtml}</ul>`;

        //4. 상품정보 버튼 활성화
        this._ensureCompanyInfoTogglesBound();

    },

    //월 보험료 정보
    MonthlyPremiumInfo(simplified_coverage_premiums) {
        const monthly_premium_lists = document.getElementById('monthly_premium_lists');
        const selectedCompany = document.getElementById('product_group_name')?.value;

        if (!Array.isArray(simplified_coverage_premiums)) return;
        if (!monthly_premium_lists) return;
        if (!selectedCompany) { console.warn("⚠️ 선택된 보험사가 없습니다."); return; }

        // 1️⃣ 선택된 보험사의 상품만 필터링하여 저장
        const filteredProducts = simplified_coverage_premiums.filter(p => p.company_code === selectedCompany);

        //2. 필터링 된 데이터 기준으로 max/min 계산
        const { max: globalMax, min: globalMin } = this._getMaxMinPremium(filteredProducts, 'total_premium');

        // 3. 플래그 초기화
        const flags = { maxAssigned: false, minAssigned: false };

        // 4. HTML 생성 (템플릿 리터럴 활용)
        const listHtml = filteredProducts.map((product, i) => {
            // 색상 클래스 결정 (최저: 파랑, 최고: 빨강, 나머지: 검정)
            const formattedPremium = app.formatNumber(product.total_premium);
            const monthly_premium_id = `monthly_${product.company_code}_${product.plan_type}`;
            return `<span id='${monthly_premium_id}'>${formattedPremium}</span>`;
        }).join('');

        // 5. 랜더링
        monthly_premium_lists.innerHTML = listHtml;

        //6. applyPremiumStyle → 전체 기준(globalMax/globalMin)으로 스타일 적용
        filteredProducts.forEach(product => {
            const el = document.getElementById(`monthly_${product.company_code}_${product.plan_type}`);
            if (el) {
                const total_premium = product.DispValue ? product.total_premium : 0;
                el.textContent = app.formatNumber(total_premium);
                el.setAttribute("total_premium", total_premium);
                // ⚠️ 0일 경우에는 스타일 적용 대상에서 제외
                if (total_premium > 0) {
                    this._applyPremiumStyle(el, total_premium, globalMax, globalMin, flags);
                }
                else {
                    el.classList.remove('company__red', 'company__blue', 'company__black');
                    el.classList.add('company__black');
                }
            }
        });

    },

    //총 납입 보험료 정보
    PaymentTotalPremiumInfo(simplified_coverage_premiums) {
        const payment_total_premium_lists = document.getElementById('payment_total_premium_lists');
        const selectedCompany = document.getElementById('product_group_name')?.value;

        if (!Array.isArray(simplified_coverage_premiums)) return;
        if (!payment_total_premium_lists) return;
        if (!selectedCompany) { console.warn("⚠️ 선택된 보험사가 없습니다."); return; }

        // 1️⃣ 선택된 보험사의 상품만 필터링하여 저장
        const filteredProducts = simplified_coverage_premiums.filter(p => p.company_code === selectedCompany);


        //2. 필터링 된 데이터 기준으로 max/min 계산
        const { max: globalMax, min: globalMin } = this._getMaxMinPremium(filteredProducts, 'payment_total_premium');

        // 3. 플래그 초기화
        const flags = { maxAssigned: false, minAssigned: false };

        // 4. HTML 생성 (템플릿 리터럴 활용)
        const listHtml = filteredProducts.map((product, i) => {
            // 색상 클래스 결정 (최저: 파랑, 최고: 빨강, 나머지: 검정)
            const formattedPremium = app.formatNumber(product.payment_total_premium);
            const payment_total_premium_id = `payment_${product.company_code}_${product.plan_type}`;
            return `<span id='${payment_total_premium_id}'>${formattedPremium}</span>`;
        }).join('');

        // 5. 랜더링
        payment_total_premium_lists.innerHTML = listHtml;

        //6. applyPremiumStyle → 전체 기준(globalMax/globalMin)으로 스타일 적용
        filteredProducts.forEach(product => {
            const el = document.getElementById(`payment_${product.company_code}_${product.plan_type}`);
            if (el) {
                const payment_total_premium = product.DispValue ? product.payment_total_premium : 0;
                el.textContent = app.formatNumber(payment_total_premium);
                el.setAttribute("payment_total_premium", payment_total_premium);
                // ⚠️ 0일 경우에는 스타일 적용 대상에서 제외
                if (payment_total_premium > 0) {
                    this._applyPremiumStyle(el, payment_total_premium, globalMax, globalMin, flags);
                }
                else {
                    el.classList.remove('company__red', 'company__blue', 'company__black');
                    el.classList.add('company__black');
                }
            }
        });
    },

    //담보명 리스트 랜더링
    renderCoverageList() {
        const coveragePlansList = document.getElementById('simplifi_plan_lists');
        if (!coveragePlansList) return;

        const planCoverages = simplified_detail_coverage.simplified_plan_coverages || [];
        const listHtml = planCoverages
            .filter(item => item.DispValue === true)
            .map((item) => {
                const isChecked = item.plan_coverage_selected === "checked" ? "checked" : "";
                const amount = item.coverage_cd === "aa00" ? "-" : app.formatNumber(item.guide_coverage_amount);
                return `<li>
                        <div class='left'>
                            <div class='checkbox-area'>
                                <input type='checkbox' id='chk_${item.coverage_cd}' data-cd="${item.coverage_cd}" guide_coverage_amount="${amount}" ${isChecked}>
                                <label for='chk_${item.coverage_cd}'>${item.coverage_name}</label>
                            </div>
                        </div>
                        <div class='rightn'><em>${amount}</em></div>
                    </li>`;
            }).join('');

        coveragePlansList.innerHTML = listHtml;
    },

    //상품별 보험료 랜더링
    //상품별 보험료 랜더링
    renderPremiumTable() {
        const {
            simplified_plan_coverages: planCoverages,
            coverage_product_result: products,
            guide_coverage_item: guideMap
        } = simplified_detail_coverage;

        const container = document.getElementById('simplifi_premium_lists');
        if (!container) return;

        // 1️⃣ [추가] 담보별 Max/Min 보험료를 저장할 Map 생성
        const coverageMinMaxMap = {};

        // 2️⃣ [추가] 렌더링 전, 미리 모든 담보의 최저/최고가를 계산하여 Map에 저장
        planCoverages.forEach(coverage => {
            if (coverage.DispValue === true) {
                // 해당 담보에 대한 모든 상품의 보험료 수집
                const premiums = products.map(product => {
                    const coverageKey = `${product.company_code}_${product.product_code}_${coverage.coverage_cd}`;
                    const detailIdxList = guideMap[coverageKey] || [];
                    return detailIdxList.reduce((acc, idx) => {
                        const detail = product.detailList[idx];
                        return acc + (Number(detail?.premium) || 0);
                    }, 0);
                });
                // 🌟 죠르디러버님이 원하신 방식대로 Map에 저장!
                coverageMinMaxMap[coverage.coverage_cd] = this._getMaxMinPremium(premiums.map(v => ({ premium: v })), 'premium');
            }
        });

        // 3️⃣ HTML 조립
        const listHtml = planCoverages.filter(coverage => coverage.DispValue === true).map(coverage => {

            const columnsHtml = products.map(product => {
                const coverageKey = `${product.company_code}_${product.product_code}_${coverage.coverage_cd}`;
                const detailIdxList = guideMap[coverageKey] || [];

                const { totalAmount, totalPremium } = detailIdxList.reduce((acc, idx) => {
                    const detail = product.detailList[idx];
                    if (detail) {
                        acc.totalAmount += (Number(detail.coverage_amount) || 0);
                        acc.totalPremium += (Number(detail.premium) || 0);
                    }
                    return acc;
                }, { totalAmount: 0, totalPremium: 0 });

                const isVisible = (coverage.plan_coverage_selected === "checked" && product.DispValue);
                const displayValue = isVisible ? app.formatNumber(totalPremium) : 0;
                return `<span>
                            <em id="${coverageKey}" company_code="${product.company_code}" product_code="${product.product_code}" coverage_cd="${coverage.coverage_cd}" coverage_amount="${totalAmount}" premium="${totalPremium}">${displayValue}</em>
                        </span>`;
            }).join('');

            return `<li> ${columnsHtml}</li>`;
        }).join('');
        container.innerHTML = listHtml;

        planCoverages.filter(cov => cov.DispValue).forEach(cov => {
            this._applyCoverageMinMaxStyles(cov.coverage_cd);
        });
    },

    //상품별 상세 보험료 랜더링
    renderPremiumDetailTable(company_code, product_code, coverage_cd) {
        const container = document.getElementById('simplifiList');
        if (!container) return;

        const { simplified_coverage_insur_premiums: product_insur_premiums } = simplified_detail_coverage;
        let targetList = product_insur_premiums.filter(r => r.company_code == company_code && r.product_code == product_code);
        let product_name = targetList[0]?.product_name.trim() || '';

        container.innerHTML = `
        <div style="font-size: 1.6rem; margin: 35px 0px 10px 0px; font-weight: 500;">${product_name}</div>
        <div style="margin: 0; overflow: scroll; height: 200px;">
        <table>
            <tbody>
            ${targetList.map(product =>
            product.detailList
                // ✅ coverage_cd 조건 추가
                .filter(detail => detail.coverage_cd == coverage_cd)
                .map(detail => `
                            <tr>
                                <td style="font-size: 1.0rem; padding: 25px 0px 10px 0px;">
                                    <h3 id="${company_code}_${product_code}_${coverage_cd}" style="color: #2f88ff;">
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
        <button type="button" class="btn__close">닫기</button>
    </div>
    `;
    },

    /**
     * 특정 회사의 노출 여부(DispValue)를 업데이트
     * @param {string} company_code - 대상 회사 코드
     * @param {boolean} checked - 노출 여부 (true/false)
     */
    updateSimpliProductState(company_code, checked, id) {
        const coveragePremiums = simplified_detail_coverage.simplified_coverage_premiums || [];
        // 1. 데이터가 없으면 즉시 종료 (Early Return)
        if (!coveragePremiums.length) return;

        let isChanged = false;

        // 2. 새로운 배열을 생성하며 값 업데이트 (불변성 유지)
        //chk_LDB_82601015
        const updatedPremiums = coveragePremiums.map(item => {
            if (item.company_code === company_code && item.DispValue !== checked && `chk_${item.company_code}_${item.product_code}` == id) {
                isChanged = true;
                return { ...item, DispValue: checked }; // 변경된 객체만 새로 생성
            }
            return item; // 변경 없는 데이터는 그대로 반환
        });

        // 3. 실제 변경이 일어난 경우에만 상태 반영
        if (isChanged) {
            simplified_detail_coverage.simplified_coverage_premiums = updatedPremiums;
            //console.log(`[🏢 회사 필터 변경] ${company_code} -> ${checked ? '노출' : '숨김'} 乔!`);
        }
    },

    //coverage_cd 체크상태 업데이트
    updateSimpliCoverageState(coverage_cd, checked) {
        const selectedValue = checked ? 'checked' : '';
        const planCoverages = simplified_detail_coverage.simplified_plan_coverages;
        const targetCoverage = planCoverages.find(item => item.coverage_cd === coverage_cd);

        if (targetCoverage) {
            targetCoverage.plan_coverage_selected = selectedValue;
            simplified_detail_coverage.simplified_plan_coverages = planCoverages;
        }

        //2. coverage_premius 업데이트
        const coveragePremiums = simplified_detail_coverage.simplified_coverage_premiums;
        if (coveragePremiums.length > 0) {
            this.updateSimpliCoverageproductList(coveragePremiums, coverage_cd, selectedValue);
            simplified_detail_coverage.simplified_coverage_premiums = coveragePremiums;
        }

        // console.log('[🚀 보장리스트 갱신 완료]', planCoverages);
        // console.log('[🚀 상품별 리스트 갱신 완료]', coveragePremiums);

    },

    //product 상세 coverage_cd 체크상태 업데이트
    updateSimpliCoverageproductList(products, coverage_cd, selectedValue) {
        // 중첩 forEach 대신 조금 더 직관적인 루프 활용
        products.forEach(product => {
            const detail = product.detailList?.find(d => d.coverage_cd === coverage_cd);
            if (detail) {
                detail.cover_selected = selectedValue;
            }
        });
    },

    //보험료 합계 갱신
    calculateSimpliPremiums() {
        const planCoverages = simplified_detail_coverage.simplified_plan_coverages || [];
        const coveragePremiums = simplified_detail_coverage.simplified_coverage_premiums || [];
        const periods = [1, 10, 20, 30];
        const payment_period = periods.find(p => simplified_detail_coverage.plan_payment_expiration_name.includes(`${p}년`)) || 1;

        let isChanged = false;

        //선택한 담보 코드 Set 생성 
        const selectedCodes = new Set(planCoverages.filter(cov => cov.plan_coverage_selected === 'checked').map(cov => String(cov.coverage_cd).trim()));

        //상품별 보험료 합산 로직
        if (coveragePremiums.length > 0) {
            //노출되지 않는 상품 처리
            coveragePremiums.forEach(product => {
                if (!product.DispValue) {
                    if (product.total_premium !== 0 && product.payment_total_premium !== 0) {
                        product.total_premium = 0;
                        product.payment_total_premium = 0;
                        isChanged = true;
                    }
                    return;
                }

                const newTotal = product.detailList.reduce((sum, detail) => {
                    const isSelected = selectedCodes.has(detail.coverage_cd.trim());
                    return isSelected ? sum + Math.round(detail.premium || 0) : sum;
                }, 0);

                //변경사항이 있을때만 update
                if (product.total_premium !== newTotal) {
                    product.total_premium = newTotal;
                    product.payment_total_premium = newTotal * payment_period * 12;
                    isChanged = true;
                }
            });
        }
        // 4. 변경된 경우에만 상태(State) 반영
        if (isChanged) {
            simplified_detail_coverage.simplified_coverage_premiums = coveragePremiums; // 불변성 유지를 위해 복사본 권장
        }
        //console.log('[🚀 보험리스트 합계 갱신 완료]', coveragePremiums);
    },


    //월 보험료, 총 납입보험료 색상 갱신
    syncSimpliPremiumCells() {
        const coveragePremiums = (simplified_detail_coverage.simplified_coverage_premiums || []).filter(item => item.DispValue);
        if (coveragePremiums.length === 0) return;

        // 1. 비교를 위한 값 배열 추출
        const totalList = coveragePremiums.map(item => item.total_premium);
        const paymentList = coveragePremiums.map(item => item.payment_total_premium);

        // 2. 각각의 Max, Min 값 계산
        const stats = {
            total: { max: Math.max(...totalList), min: Math.min(...totalList), flags: { maxAssigned: false, minAssigned: false } },
            payment: { max: Math.max(...paymentList), min: Math.min(...paymentList), flags: { maxAssigned: false, minAssigned: false } }
        };

        // 3. 단일 루프로 두 종류의 셀 모두 업데이트
        coveragePremiums.forEach(item => {
            const suffix = `${item.company_code}_${item.plan_type}`;

            // A. 합계 보험료 (monthly_) 처리
            const monthlyEl = document.getElementById(`monthly_${suffix}`);
            if (monthlyEl) {
                const total_premium = item.total_premium || 0;
                monthlyEl.textContent = app.formatNumber(total_premium);
                monthlyEl.setAttribute("total_premium", total_premium);
                this._applyPremiumStyle(monthlyEl, total_premium, stats.total.max, stats.total.min, stats.total.flags);
            }

            // B. 총 납입 보험료 (payment_) 처리
            const paymentEl = document.getElementById(`payment_${suffix}`);
            if (paymentEl) {
                const payment_total_premium = item.payment_total_premium || 0;
                paymentEl.textContent = app.formatNumber(payment_total_premium);
                paymentEl.setAttribute("payment_total_premium", payment_total_premium);
                this._applyPremiumStyle(paymentEl, payment_total_premium, stats.payment.max, stats.payment.min, stats.payment.flags);
            }
        });

    },

    //특정 담보(coverage_cd) 만 보험료 갱신
    syncSimpliPremiumByCoverageCd(coverage_cd) {
        const planCoverages = simplified_detail_coverage.simplified_plan_coverages || [];
        const coveragePremiums = simplified_detail_coverage.simplified_coverage_premiums || [];

        const planCoverage = planCoverages.find(c => String(c.coverage_cd) === String(coverage_cd));
        if (!planCoverage) return;
        const isSelected = planCoverage.plan_coverage_selected === 'checked';

        // --- Part 1. 담보 리스트 UI 업데이트 ---
        const lists = document.getElementById('simplifi_plan_lists'); // ID 확인: simplifi_plan_lists
        if (lists) {
            const li = lists.querySelector(`#chk_${coverage_cd}`)?.closest('li');
            if (li) {
                // 1. 체크박스 상태 업데이트
                const checkbox = li.querySelector('.checkbox-area input');
                if (checkbox) checkbox.checked = isSelected;

                // 2. 금액 텍스트 계산
                const displayVal = coverage_cd === 'aa00' ? '-' : app.formatNumber(planCoverage.guide_coverage_amount);
                // 선택되지 않았을 때는 0 혹은 '-' 처리
                const guide_coverage_amount = (coverage_cd === 'aa00') ? '-' : (isSelected ? displayVal : 0);

                // 3. 우측 금액 표시 업데이트 (.rightn 내의 em 태그)
                const emTarget = li.querySelector('.rightn em');
                if (emTarget) {
                    emTarget.textContent = guide_coverage_amount;
                }
            }
        }

        // --- Part 2. 전체 기준 Max/Min 계산 ---
        const allValues = coveragePremiums.map(product => {
            const totalPremium = product.detailList.filter(d => String(d.coverage_cd) === String(coverage_cd)).reduce((sum, d) => sum + Math.round(d.premium || 0), 0);
            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;
            return { code: product.company_code, premium: premiumValue };
        });

        const { max: globalMax, min: globalMin } = this._getMaxMinPremium(allValues, 'premium');
        const flags = { maxAssigned: false, minAssigned: false };

        // --- Part 3. 테이블 내 보험료 셀 업데이트 (coveragePremiums 사용) ---
        coveragePremiums.forEach(product => {
            // 해당 상품에서 이 담보의 보험료 합산
            const totalPremium = product.detailList.filter(d => String(d.coverage_cd) === String(coverage_cd)).reduce((sum, d) => sum + Math.round(d.premium || 0), 0);
            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;

            // ID 규칙에 맞춰 요소 찾기
            const el = document.querySelector(`em[id="${product.company_code}_${product.product_code}_${coverage_cd}"][coverage_cd="${coverage_cd}"]`);
            if (el) {
                // 텍스트 업데이트
                el.textContent = app.formatNumber(premiumValue);
                // 색상 및 스타일 적용 (Part 2에서 구한 globalMax/Min 기준)
                this._applyPremiumStyle(el, premiumValue, globalMax, globalMin, flags);
            }
        });
        //console.log(`[Sync] 담보(${coverage_cd}) 관련 모든 UI 갱신 완료! 乔!`);
    },

    /**
    * 보험료 정렬 및 상태 업데이트
    * (0원 상품은 뒤로 배치, 나머지는 오름차순 정렬)
    */
    syncSimpliCoverageSortPremium() {
        // 1. 상태값 가져오기
        const coveragePremiums = simplified_detail_coverage.simplified_coverage_premiums || [];
        // 2. 데이터가 없으면 즉시 종료
        if (coveragePremiums.length === 0) return;

        // 3. 변경 여부 확인을 위한 기존 순서 저장 (company_code 리스트 생성)
        const originalOrder = coveragePremiums.map(p => p.company_code).join(',');

        // 4. 정렬 로직 실행
        coveragePremiums.sort((a, b) => {
            const aTotal = a.total_premium || 0;
            const bTotal = b.total_premium || 0;

            // [1순위] 보험료 0원은 항상 리스트의 가장 뒤로 보냄
            if (aTotal === 0 && bTotal !== 0) return 1;
            if (bTotal === 0 && aTotal !== 0) return -1;
            if (aTotal === 0 && bTotal === 0) return 0;

            // [2순위] 보험료 기준 오름차순 정렬 (낮은 가격이 위로)
            return aTotal - bTotal;
        });

        // 5. 실제 순서가 변경되었는지 확인
        const newOrder = coveragePremiums.map(p => p.company_code).join(',');

        if (originalOrder !== newOrder) {
            // 6. 상태 업데이트 (불변성을 위해 새 배열로 할당)
            simplified_detail_coverage.simplified_coverage_premiums = coveragePremiums;
            //console.log('[✅ 정렬 완료] 보험료 낮은 순으로 상품 순서가 업데이트되었습니다. 乔!');
        }

    },

    //--------------- 이벤트 함수 실행 ---------------
    simplifi_events() {
        const productgroupBtn = document.getElementById('product_group_name');
        const companyLists = document.getElementById('simplifi_company_lists');
        const bojangLists = document.getElementById('simplifi_plan_lists');
        const container = document.getElementById('simplifiList');
        const premiumListContainer = document.getElementById('simplifi_premium_lists');

        if (productgroupBtn) {
            productgroupBtn.addEventListener('change', () => {
                this.setFilteredProductsMap(); // 지도를 다시 그리고
                this.setupComparisonMain(); //상품정보 리스트 갱신
                this.renderPremiumTable(); // 상품별 보험료 리스트 갱신
            });
        }

        if (companyLists) {
            companyLists.addEventListener('click', (e) => {
                const cb = e.target.closest('input[type="checkbox"][id^="chk_"]');
                if (!cb) return;
                const company_code = cb.getAttribute("company_code"); // DB, HA, LABL
                const checked_id = cb.getAttribute("id");
                console.log('checked_id,', checked_id);

                // 1.회사체크 Dispvalue 상태값 업데이트
                this.updateSimpliProductState(company_code, cb.checked, checked_id);

                // 2. 보험료 합계 갱신
                this.calculateSimpliPremiums();

                // 3. 정렬
                this.syncSimpliCoverageSortPremium();

                //4. 다시 랜더링
                requestAnimationFrame(() => {
                    this.setFilteredProductsMap(); // 지도를 다시 그리고
                    this.setupComparisonMain(); //상품정보 리스트 갱신
                    this.renderPremiumTable(); // 상품별 보험료 리스트 갱신
                }, 100);

            });
        }


        if (bojangLists) {
            bojangLists.addEventListener('click', (e) => {
                const cb = e.target.closest('input[type="checkbox"][id^="chk_"]');
                if (cb) {
                    const coverage_cd = cb.dataset.cd;
                    const bojangs = document.getElementById(`chk_${coverage_cd}`);
                    if (!bojangs) return;

                    //1.보장별, 상품별 체크 상태 갱신
                    this.updateSimpliCoverageState(coverage_cd, cb.checked);

                    //2.보험료 합계 갱신
                    this.calculateSimpliPremiums();

                    // 3. 국소 업데이트 (입력창에만 반영) - 한 프레임에 몰아서
                    requestAnimationFrame(() => {
                        //3. 월 보험료, 총 납입보험료 색상 갱신
                        this.syncSimpliPremiumCells();

                        //4. 특정 담보(coverage_cd) 만 보험료 갱신
                        this.syncSimpliPremiumByCoverageCd(coverage_cd);
                    }, 100);
                }
            });
        }


        //보험료 상세 클릭 이벤트
        if (premiumListContainer) {
            premiumListContainer.addEventListener("click", (e) => {
                const em = e.target.closest('em[company_code]');
                if (!em) return;
                const company_code = em.getAttribute('company_code');
                const product_code = em.getAttribute('product_code');
                const coverage_cd = em.getAttribute('coverage_cd') || em.id.slice(2);
                const premium = em.textContent;
                if (premium == 0) return;
                this._show_layer();
                this.renderPremiumDetailTable(company_code, product_code, coverage_cd);
            });

        }


        if (container) {
            // 1. 닫기 버튼 클릭 이벤트 (이미 잘 짜셨어요!)
            container.addEventListener("click", (e) => {
                const closeBtn = e.target.closest('.btn__close'); // 두 클래스 모두 대응
                if (closeBtn) {
                    const modal = document.querySelector('#modal01'); // 대상 모달 선택
                    const bottomContent = document.querySelector(".bottom-content .bottom");

                    if (modal) modal.style.display = 'none';
                    if (bottomContent) bottomContent.style.display = "block";
                    document.body.classList.remove('modal');
                }
            });

            // 2. 배경 클릭 시 닫기 (이벤트 위임 방식 최적화)
            document.addEventListener("click", (e) => {
                // 배경(.modal-bg 또는 .bg)을 클릭했는지 확인
                const isBackground = e.target.classList.contains('modal-bg') || e.target.classList.contains('bg');

                if (isBackground) {
                    // 클릭된 배경의 부모 모달 찾기
                    const modal = e.target.closest('#modal01');
                    if (modal) {
                        modal.style.display = 'none';
                        document.body.classList.remove('modal');

                        const bottomContent = document.querySelector('.bottom-content .bottom');
                        if (bottomContent) bottomContent.style.display = 'block';
                    }
                }
            });
        }

    },



    //회사 "상품정보" 버튼 토글
    _ensureCompanyInfoTogglesBound() {
        const area = document.getElementById('simplifi_company_lists');
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
    },

    /** 헬퍼 함수 1: ratioMap 안전하게 가져오기 */
    _getSafeRatioMap(rawMap) {
        if (typeof rawMap === 'string') {
            try { return JSON.parse(rawMap); } catch (e) { return {}; }
        }
        return rawMap || {};
    },

    /** 헬퍼 함수 2: 최저기본계약(aa00) 보장 */
    _ensureMinimumContract(product, reqMap) {
        const key = `${product.company_code}_${product.product_code}`;
        const reqList = reqMap[key];

        if (reqList?.length && !product.detailList.some(d => d.coverage_cd === 'aa00')) {
            const sumPremium = reqList.reduce((sum, r) => sum + Math.round(r.min_premium || 0), 0);
            const aa00 = {
                coverage_cd: 'aa00',
                coverage_name: '최저기본계약조건',
                coverage_seq: -1,
                guide_coverage_amount: reqList[0].min_insur_amount || 0,
                coverage_amount: reqList[0].min_insur_amount || 0,
                guide_coverage_premium: sumPremium,
                premium: sumPremium,
                is_selected_coverage: 'N',
                cover_selected: ''
            };
            product.detailList = [aa00, ...(product.detailList || [])];
        }
    },

    /** 헬퍼 함수 3: 상세 최저기본계약(aa00) 보장 */
    _ensureMinimumContractDetail(product, reqMap) {
        const key = `${product.company_code}_${product.product_code}`;
        const reqList = reqMap[key];
        if (reqList?.length && !product.detailList.some(d => d.coverage_cd === 'aa00')) {
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
    },

    /** 헬퍼 함수 4: 담보별 비율 및 보험료 계산 */
    _calculateDetailRatio(detail, ratioMap) {
        if (detail.coverage_cd === 'aa00') return;

        const coverage_cd = String(detail.coverage_cd).trim();
        const ratio = Number(ratioMap[coverage_cd]) || 1;

        // base_premium 원본 보존
        if (detail.base_premium === undefined || detail.base_premium === null) {
            detail.base_premium = Number(detail.premium) || 0;
        }

        const baseAmount = Number(detail.guide_coverage_amount) || 0;
        const basePremium = Number(detail.base_premium) || 0;

        detail.coverage_amount = Math.round(ratio * baseAmount);
        detail.premium = Math.round(ratio * basePremium);
    },

    /** 헬퍼 함수 5: 담보 상세별 비율 및 보험료 계산 */
    _calculateInsurDetailRatio(detail, ratioMap) {
        if (detail.coverage_cd === 'aa00') return;

        const coverage_cd = String(detail.coverage_cd).trim();
        const ratio = Number(ratioMap[coverage_cd]) || 1;

        // base_premium 원본 보존
        if (detail.base_premium === undefined || detail.base_premium === null) {
            detail.base_premium = Number(detail.premium) || 0;
        }

        const baseAmount = Number(detail.guide_contract_amount) || 0;
        const basePremium = Number(detail.base_premium) || 0;

        detail.contract_amount = Math.round(ratio * baseAmount);
        detail.premium = Math.round(ratio * basePremium);
    },

    //coverage_cd 별 보장보험료 최대-최소 색상 지정
    _applyCoverageMinMaxStyles(coverage_cd) {

        // 1. 전달받은 max/min과 현재 값을 비교
        // 2. 최대면 빨강, 최소면 파랑 등 클래스/스타일 추가
        // 3. flags를 사용해 중복 할당 방지 로직 실행
        const {
            simplified_plan_coverages: planCoverages,
            coverage_product_result: products
        } = simplified_detail_coverage;

        const cov = planCoverages.find(c => c.coverage_cd == coverage_cd);
        const isSelected = cov?.plan_coverage_selected == 'checked';

        // ✅ 전체 기준 values: 모든 회사 데이터에서 premium 합산
        let allValues = products.map(product => {
            const totalPremium = product.detailList
                .filter(d => d.coverage_cd == coverage_cd)
                .reduce((sum, d) => sum + Math.round(d.premium || 0), 0);

            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;
            return { code: product.company_code, premium: premiumValue };
        });

        // 전체 기준 min/max
        const { max: globalMax, min: globalMin } = this._getMaxMinPremium(allValues, 'premium');
        const flags = { maxAssigned: false, minAssigned: false };

        // ✅ 페이지 데이터만 DOM 반영 (색상은 global 기준)
        products.forEach(product => {
            const totalPremium = product.detailList
                .filter(d => d.coverage_cd == coverage_cd)
                .reduce((sum, d) => sum + Math.round(d.premium || 0), 0);

            const premiumValue = (product.DispValue && isSelected) ? totalPremium : 0;
            const el = document.querySelector(`em[id="${product.company_code}_${product.product_code}_${coverage_cd}"][company_code="${product.company_code}"][product_code="${product.product_code}"]`);

            if (el) {
                this._applyPremiumStyle(el, premiumValue, globalMax, globalMin, flags);
            }
        });

    },

    /**
  * 특정 셀에 보험료 숫자 + 색상 적용 (공용)
  */
    _applyPremiumStyle(el, premium, maxVal, minVal, flags) {

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

    /**
    * * 최대·최소 보험료 계산 (담보 셀 & 합계 셀 공통)
    * */
    _getMaxMinPremium(values, key = 'premium') {
        if (!values.length) return { max: 0, min: 0 };
        const filtered = values.map(v => Number(v[key]) || 0).filter(v => v > 0); // 0 제외
        if (!filtered.length) return { max: 0, min: 0 };
        return {
            max: Math.max(...filtered),
            min: Math.min(...filtered)
        };
    },




    _show_layer() {
        const modal = document.querySelector('#modal01');
        const inner = document.querySelector('.simplifi_main');
        const body = document.body;

        // 1. 마스크/전체 레이아웃 크기 설정
        this._wrapWindowByMask();

        // 2. 모달 보이기 (FadeIn 효과는 CSS transition 추천)
        modal.style.display = 'block';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);

        // 3. 중앙 정렬 계산 (Vanilla JS 버전)
        // 사실 CSS로 처리하는 게 베스트지만, 기존 로직을 유지한다면:
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const innerHeight = inner.offsetHeight;
        const innerWidth = inner.offsetWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        inner.style.position = 'absolute';
        inner.style.top = `${Math.max(0, (windowHeight - innerHeight) / 2 + scrollTop - 100)}px`;
        inner.style.left = `${Math.max(0, (windowWidth - innerWidth) / 2)}px`;
        inner.style.display = 'block';

        // 4. body 클래스 추가
        body.classList.add('modal');

    },

    _wrapWindowByMask() {
        const modal = document.querySelector('#modal01');
        // document.height 대체: scrollHeight 사용
        const maskHeight = document.documentElement.scrollHeight;
        const maskWidth = window.innerWidth;

        modal.style.width = `${maskWidth}px`;
        modal.style.height = `${maskHeight}px`;
    },




}