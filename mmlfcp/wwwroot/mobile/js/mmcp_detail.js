var product_detail =
{
    insur_HTML: "",
    selected_coverage_name: "",


    /**
     * 보장 항목 및 상세 리스트의 체크 상태를 업데이트합니다.
     * @param {string} coverage_cd - 업데이트할 보장 코드
     * @param {boolean} checked - 체크 여부
     */
    updateCoverageSelection: function (coverage_cd, checked) {
        const checkedValue = checked ? "checked" : "";

        // 1. 플랜 보장 항목 상태 업데이트
        state.plan_coverages.forEach(item => {
            if (item.coverage_cd === coverage_cd) {
                item.coverages_checked = checkedValue;
            }
        });

        // 2. 보장 보험료 상세 리스트 상태 업데이트
        state.coverage_premiums.forEach(premium => {
            premium.detailList.forEach(detail => {
                if (detail.coverage_cd === coverage_cd) {
                    detail.cover_selected = checkedValue;
                }
            });
        });
    },

    /**
     * 선택된 보장 카테고리 및 체크 상태에 따라 제품별 총 보험료를 계산합니다.
     */
    recalculateTotalPremiumBySelection: function () {
        state.coverage_premiums.forEach(product => {
            // 1. 각 제품의 total_premium을 0으로 초기화하며 합산 시작
            product.total_premium = product.detailList.reduce((sum, detail) => {
                // 조건 통합: detail_checked가 "checked"인 경우에만 보험료 합산
                // 기존 코드의 is_checked와 state.checked_val 조건은 결과적으로 이 조건에 수렴합니다.
                if (detail.cover_selected === "checked") {
                    return sum + Math.floor(detail?.base_premium || 0);
                }
                return sum;
            }, 0);
        });
    },


    /**
     * 특정 보장 항목의 가입 금액을 업데이트합니다.
     * @param {string} coverage_cd - 대상 보장 코드
     * @param {number|string} change_coverage_amount - 변경할 가입 금액
     */
    updateCoverageAmount: function (coverage_cd, change_coverage_amount) {
        // 1. 해당 코드를 가진 항목을 찾습니다.
        const targetCoverage = state.plan_coverages.find((item) => item.coverage_cd === coverage_cd);

        // 2. 항목이 존재할 경우에만 값을 업데이트합니다.
        if (targetCoverage) {
            targetCoverage.guide_coverage_amount = Number(change_coverage_amount);
        }
    },

    /**
     * 가입금액 변경에 따른 보험료 재계산 및 업데이트
     * @param {string} coverage_cd - 대상 보장 코드
     * @param {number|string} change_coverage_amount - 변경된 가입금액
     */
    updateInsurancePremium: function (coverage_cd, change_coverage_amount) {
        let contract_percent = 0;
        const targetAmount = parseInt(change_coverage_amount) || 0;

        // 1. 보장 보험료(coverage_premiums) 업데이트 및 비율(contract_percent) 산출
        state.coverage_premiums.forEach(premiumItem => {
            premiumItem.detailList.forEach(detail => {
                if (detail.coverage_cd === coverage_cd) {
                    const { guide_coverage_amount, guide_coverage_premium } = detail;

                    // 비율 계산 (0으로 나누기 방지)
                    contract_percent = guide_coverage_amount ? (targetAmount / guide_coverage_amount) : 0;

                    // 보험료 계산 및 할당
                    detail.base_coverage_amount = targetAmount;
                    detail.base_premium = Math.floor(contract_percent * (guide_coverage_premium || 0));
                }
            });
        });

        // 2. 상품 보험료(product_insur_premiums) 업데이트
        state.product_insur_premiums.forEach(productItem => {
            productItem.detailList.forEach(detail => {
                if (detail.coverage_cd === coverage_cd) {
                    const { guide_premium, guide_contract_amount } = detail;

                    detail.contract_amount = contract_percent * guide_contract_amount;
                    detail.premium = Math.floor(contract_percent * (guide_premium || 0));
                }
            });
        });
    },


    /**
     * 보장 변경 화면의 선택 상태에 따라 총 보험료를 계산합니다.
     */
    refreshCoverageTotalPremium: function () {
        state.coverage_premiums.forEach(premiumItem => {
            // 각 그룹의 total_premium을 초기화하고 detailList를 순회하며 합산
            premiumItem.total_premium = premiumItem.detailList.reduce((sum, detail) => {
                // 항목이 체크된 상태라면 보험료를 더함
                if (detail.cover_selected === "checked") {
                    return sum + Math.floor(detail?.base_premium || 0);
                }
                return sum;
            }, 0);
        });
    },


    /**
     * 모든 보장 항목 상세 리스트를 화면에 랜더링합니다.
     */
    renderAllCoverageList: function () {
        // 1. 헤더 영역 렌더링 (setting-head-box)
        const headBox = document.querySelector(".setting-head-box");
        if (headBox) {
            headBox.innerHTML = `
                <div class='subject-box'>${state.plan_name}</div>
                <div class='sub-box'>${state.plan_payterm_type_name} ( ${state.insur_age}세 / ${state.gender === 'M' ? '남자' : '여자'} )</div>
            `;
        }

        // 2. 예외 코드 확인용 배열 (검색 속도 향상을 위해 Set이나 Array 활용)
        const coverage_except_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016".split(',');

        // 3. 리스트 본문 생성
        const listContainer = document.getElementById("allProductsDetailList");
        if (!listContainer) return;

        // map을 사용해 각 항목의 HTML 배열을 만들고 join으로 합칩니다.
        const listItemsHTML = state.plan_coverages.map((item, i) => {
            const isSelected = item.coverages_checked !== "";
            const isReadonly = coverage_except_code.includes(item.coverage_cd) ? "readonly" : "";
            const displayAmount = isSelected ? item.guide_coverage_amount.toLocaleString() : "0";

            return `
                <a href='#none' class='${isSelected ? "row selected" : "row"}'>
                    <div class='check-box'>
                        <i class='ic ic-check'></i>
                    </div>
                    <div class='info-box'>
                        <div class='subject-box'>${item.coverage_name}</div>
                        <div class='con-box'>
                            <div class='input-box'>
                                <input type='text' ${isReadonly} 
                                    value='${displayAmount}' 
                                    id='contract${i}' 
                                    name='change_coverage_amount' 
                                    plan_id='${item.plan_id}' 
                                    coverage_name='${item.coverage_name}' 
                                    coverage_cd='${item.coverage_cd}' 
                                    coverage_amount='${item.guide_coverage_amount}' 
                                    is_selected_coverage='${item.is_selected_coverage}' 
                                    maxlength='7' 
                                    inputmode='numeric' 
                                    pattern='[0-9]*' 
                                    onclick='this.select();'>
                            </div>
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        listContainer.innerHTML = `<div class='list-box'>${listItemsHTML}</div>`;
    },

    /**
     * 가입 상태 필터(전체, 가입, 미가입)에 따라 보장 상세 리스트를 렌더링합니다.
     * @param {string} selected_assign - 필터 기준 ('all', 'assign', 'not-assign')
     */
    filterCoverageListByStatus: function (selected_assign) {
        const listContainer = document.getElementById("allProductsDetailList");
        if (!listContainer) return;

        const coverage_except_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016".split(',');

        // 1. 조건에 맞는 항목만 필터링
        const filteredList = state.plan_coverages.filter(item => {
            if (selected_assign === "all") return true;
            if (selected_assign === "assign") return item.coverages_checked !== "";
            if (selected_assign === "not-assign") return item.coverages_checked === "";
            return false;
        });

        // 2. 필터링된 항목들을 HTML로 변환
        const listItemsHTML = filteredList.map((item, i) => {
            const isSelected = item.coverages_checked !== "";
            const isReadonly = coverage_except_code.includes(item.coverage_cd) ? "readonly" : "";

            // 미가입 필터일 때는 금액을 0으로 표시, 그 외에는 가이드 금액 표시
            const displayAmount = (selected_assign === "not-assign" || !isSelected) ? "0" : item.guide_coverage_amount.toLocaleString();

            return `
                <div class='list-box'>
                    <a href='#none' class='${isSelected ? "row selected" : "row"}'>
                        <div class='check-box'>
                            <i class='ic ic-check'></i>
                        </div>
                        <div class='info-box'>
                            <div class='subject-box'>${item.coverage_name}</div>
                            <div class='con-box'>
                                <div class='input-box'>
                                    <input type='text' ${isReadonly} 
                                        value='${displayAmount}' 
                                        id='contract${i}' 
                                        name='change_coverage_amount' 
                                        plan_id='${item.plan_id}' 
                                        coverage_name='${item.coverage_name}' 
                                        coverage_cd='${item.coverage_cd}' 
                                        coverage_amount='${item.guide_coverage_amount}' 
                                        is_selected_coverage='${item.is_selected_coverage}' 
                                        maxlength='7' 
                                        inputmode='numeric' 
                                        pattern='[0-9]*' 
                                        onclick='this.select();'>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = listItemsHTML;
    },

    /**
     * 선택된 보장 카테고리에 따른 마크업을 생성하고 헤더를 업데이트합니다.
     * @returns {string} 생성된 보장 리스트 HTML 문자열
     */
    generateCoverageListHTML: function () {
        const coverage_except_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016".split(',');

        // 1. 헤더 영역 업데이트 (Vanilla JS)
        const headBox = document.querySelector(".setting-head-box");
        if (headBox) {
            const genderText = state.gender === 'M' ? '남성' : '여성';
            headBox.innerHTML = `
            <div class='subject-box'>${state.plan_name}</div>
            <div class='sub-box'>${state.plan_payterm_type_name} ( ${state.insur_age}세 / ${genderText} )</div>
            `;
        }

        // 2. 리스트 마크업 생성 (map 사용)
        const listItemsHTML = state.plan_coverages.map((item, i) => {
            const isSelected = item.coverages_checked !== "";
            const isReadonly = coverage_except_code.includes(item.coverage_cd) ? "readonly" : "";
            const displayAmount = isSelected ? item.guide_coverage_amount.toLocaleString() : "0";

            return `
            <a href='#none' class='${isSelected ? "row selected" : "row"}'>
                <div class='check-box'>
                    <i class='ic ic-check'></i>
                </div>
                <div class='info-box'>
                    <div class='subject-box'>${item.coverage_name}</div>
                    <div class='con-box'>
                        <div class='input-box'>
                            <input type='text' ${isReadonly} 
                                value='${displayAmount}' 
                                id='coverage_${i}' 
                                name='change_coverage_amount' 
                                plan_id='${item.plan_id}' 
                                coverage_name='${item.coverage_name}' 
                                coverage_cd='${item.coverage_cd}' 
                                guide_coverage_amount='${item.guide_coverage_amount}' 
                                is_selected_coverage='${item.is_selected_coverage}' 
                                maxlength='7' 
                                inputmode='numeric' 
                                pattern='[0-9]*' 
                                onclick='this.select();'>
                        </div>
                    </div>
                </div>
            </a>
        `;
        }).join('');

        // 3. 최종 list-box 래퍼로 감싸서 반환
        return `<div class='list-box'>${listItemsHTML}</div>`;
    },

    /**
     * 특정 보험사의 상품 상세 정보 팝업을 렌더링합니다.
     * @param {string} company_code - 선택된 보험사 코드
     */
    renderCompanyProductDetail: function (company_code) {
        const productDetailList = document.getElementById("productDetailList");
        if (!productDetailList) return;

        // 1. 보험료 비교 및 컬러(Red/Blue) 설정 로직
        state.plan_coverages.forEach((coverage) => {
            const arr_temp_premium = [];

            state.coverage_premiums.forEach((product, pIdx) => {
                const detailIdx = state.guide_bojang_item.get(product.company_code + coverage.coverage_cd);
                if (detailIdx != null && coverage.coverages_checked !== "") {
                    const detail = product.detailList[detailIdx];
                    arr_temp_premium.push({
                        premium: detail.base_premium,
                        product_pos_idx: pIdx,
                        detail_pos_idx: detailIdx
                    });
                }
            });

            // 정렬 및 색상 부여
            if (arr_temp_premium.length > 0) {
                arr_temp_premium.sort((a, b) => a.premium - b.premium);

                // 최저가: 파란색, 최고가: 빨간색
                state.coverage_premiums[arr_temp_premium[0].product_pos_idx].detailList[arr_temp_premium[0].detail_pos_idx].color = "price-blue";

                state.coverage_premiums[arr_temp_premium[arr_temp_premium.length - 1].product_pos_idx].detailList[arr_temp_premium[arr_temp_premium.length - 1].detail_pos_idx].color = "price-red";
            }
        });

        // 2. 선택된 보험사 정보 가져오기
        const selectedProduct = state.coverage_premiums.find(p => p.company_code === company_code);
        const productConditions = selectedProduct?.product_conditions ? selectedProduct.product_conditions.replace(/(?:\r\n|\r|\n)/g, '<br />') : "-";

        // 3. 리스트 항목 마크업 생성
        const listItemsHTML = state.plan_coverages.map(coverage => {
            return state.coverage_premiums.map(product => {
                const detailIdx = state.guide_bojang_item.get(product.company_code + coverage.coverage_cd);
                const detail = detailIdx != null ? product.detailList[detailIdx] : null;

                if (detail && product.company_code === company_code && coverage.coverages_checked !== "") {
                    return `
                        <li>
                            <div class='item-wrap'>
                                <div class='subject-box'>${detail.coverage_name}</div>
                                <div class='price-black'>${detail.base_coverage_amount.toLocaleString()}만원</div>
                                <div class='${detail.color || ""}'>${detail.base_premium.toLocaleString()}원</div>
                                <a href="javascript:termsLayerOpen('${company_code}', '${detail.coverage_cd}')" class='info-btn'></a>
                            </div>
                        </li>`;
                }
                return "";
            }).join('');
        }).join('');

        // 4. 전체 레이아웃 구성
        productDetailList.innerHTML = `
            <div class='popup-contents'>
                <div class='popup-head-box align-right'>
                    <a href="javascript:popupClose('detail')" class='popup-close-btn'></a>
                </div>
                <div class='popup-body-box'>
                    <article class='popup-detail-layout1'>
                        ${selectedProduct ? `
                            <div class='detail-head-box'>
                                <div class='img-box'>
                                    <img src="./img/${selectedProduct.company_code}.png" alt="${selectedProduct.company_name}">
                                </div>
                                <div class='subject-box'>${selectedProduct.product_name}</div>
                                <div class='desc-box'>${selectedProduct.product_detail_name}</div>
                            </div>
                            <div class='detail-note-box'>
                                <div class='note-txt-box'>${productConditions}</div>
                            </div>
                        ` : ""}
                        
                        <div class='detail-list-box'>
                            <div class='list-wrap'>
                                <ul>${listItemsHTML}</ul>
                            </div>
                        </div>
    
                        <div class='detail-guide-box'>
                            <div class='inner wrap'>
                                <div class='guide-wrap'>
                                    <div class='tit-box'>
                                        <i class='ic ic-click'></i>
                                        <span class='txt'>눌러보세요!</span>
                                    </div>
                                    <div class='con-box'>
                                        <div class='row'>
                                            <div class='con-txt-box'>
                                                <span class='txt'>보장내역에서</span>
                                                <i class='ic ic-info'></i>
                                                <span class='txt'>를 누르면 담보 상세 정보가 보입니다</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>`;
    },


    /**
     * 선택된 보험사 및 담보의 상세 보장 리스트를 레이어로 렌더링합니다.
     * @param {string} company_code - 보험사 코드
     * @param {string} coverage_cd - 담보 코드
     */
    renderCoverageDetailTerms: function (company_code, coverage_cd) {
        const detailContainer = document.getElementById("insurproductDetailList");
        if (!detailContainer) return;

        // 1. 전체 coverage_premiums 배열에서 필터링 시작
        const fixedBoxHTML = state.coverage_premiums
            .filter(coverage => coverage.company_code === company_code) // 해당 회사 찾기
            .flatMap(coverage => coverage.detailList) // 해당 회사의 모든 담보 리스트 펼치기
            .filter(detail => detail.coverage_cd === coverage_cd) // 그 중 선택한 담보코드 찾기
            .map(detail => {
                // 데이터 필드명 매칭: base_coverage_amount, base_premium
                const base_coverage_amount = (detail.base_coverage_amount || 0).toLocaleString();
                const base_premium = (detail.base_premium || 0).toLocaleString();

                return `
            <div class='layer-fixed-box'>
                <div class='terms-head-box'>
                    <div class='subject-box'>${detail.coverage_name}</div>
                    <div class='con-box'>
                        <div class='con-item-box'>
                            <div class='label-box'>보장금액</div>
                            <div class='txt-box'>${base_coverage_amount}만원</div>
                        </div>
                        <div class='con-item-box'>
                            <div class='label-box'>보험료</div>
                            <div class='txt-box'>${base_premium}원</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
            }).join('');

        // 2. 스크롤 본문 영역 (product_insur_premiums 데이터 활용)
        const scrollItemsHTML = state.product_insur_premiums
            .filter(insur => insur.company_code === company_code)
            .flatMap(insur => insur.detailList) // 해당 회사의 모든 상세 담보 리스트 펼치기
            .filter(detail => detail.coverage_cd === coverage_cd) // 그 중 선택한 담보코드 찾기
            .map(detail => {
                const headerText = `${detail.insur_nm}:${detail.contract_amount.toLocaleString()}만원(${detail.premium.toLocaleString()}원)(${detail.pay_term})`;
                const bodyContent = detail.insur_bojang ? detail.insur_bojang.replace(/(?:\r\n|\r|\n)/g, '<br />') : "";

                return `
                    <div class='terms-item-box'>
                        <div class='subject-box'>${headerText}</div>
                        <div class='con-box'>${bodyContent}</div>
                    </div>
                `;
            }).join('');

        const scrollBoxHTML = `
            <div class='layer-scroll-box'>
                <div class='terms-list-box'>
                    ${scrollItemsHTML}
                </div>
            </div>
        `;

        // 3. 최종 반영
        detailContainer.innerHTML = fixedBoxHTML + scrollBoxHTML;
    },
};


/**
 * 보장 리스트의 행 클릭 이벤트를 처리합니다.
 */

document.addEventListener("click", function (event) {
    // 1. 클릭된 요소가 .setting-check-list .row 내부인지 확인
    const row = event.target.closest(".setting-check-list .row");
    if (!row) return;

    // 2. input-box 내부 클릭 시 이벤트 무시 (버블링 방지)
    if (event.target.closest(".input-box")) {
        return;
    }

    // 3. 'selected' 클래스 토글 및 상태 확인
    row.classList.toggle("selected");
    const isChecked = row.classList.contains("selected");

    // 4. 내부 input 요소 찾기 (기존의 복잡한 childNodes 대체)
    const inputElement = row.querySelector("input[name='change_coverage_amount']");
    if (!inputElement) return;

    const id = inputElement.id;
    const coverage_cd = inputElement.getAttribute("coverage_cd");
    let coverage_amount = 0;

    // 5. 체크 상태에 따른 로직 처리
    if (!isChecked) {
        // 체크 해제 시
        inputElement.setAttribute("value", coverage_amount);
        inputElement.value = coverage_amount;

        // 기존에 리팩토링했던 상태 동기화 함수 호출
        product_detail.updateCoverageSelection(coverage_cd, false);
    }
    else {
        // 체크 선택 시
        coverage_amount = inputElement.getAttribute("coverage_amount");

        // 콤마 추가 (표준 메서드 또는 기존 addComma 활용)
        const formattedAmount = Number(coverage_amount).toLocaleString();
        inputElement.setAttribute("value", formattedAmount);
        inputElement.value = formattedAmount;

        // 기존에 리팩토링했던 상태 동기화 함수 호출
        product_detail.updateCoverageSelection(coverage_cd, true);
    }
});


/**
 * 가입금액 입력 시 실시간으로 금액 포맷팅 및 보험료를 업데이트합니다.
 */
document.addEventListener("input", function (event) {
    // 1. 이벤트 타겟이 가입금액 input인지 확인
    const inputElement = event.target;
    if (inputElement.name !== 'change_coverage_amount') return;

    // 2. 콤마 제거 및 숫자 변환 (기존 removeComma 기능)
    const rawValue = inputElement.value.replace(/,/g, '');
    const change_coverage_amount = Number(rawValue) || 0;
    const coverage_cd = inputElement.getAttribute("coverage_cd");

    // 3. 천 단위 콤마 포맷팅 (toLocaleString 사용)
    const formattedAmount = change_coverage_amount.toLocaleString();

    // 4. Input 값 및 속성 갱신
    // setAttribute는 DOM 구조상의 value를, .value는 현재 화면상의 값을 갱신합니다.
    inputElement.setAttribute("value", formattedAmount);
    inputElement.value = formattedAmount;

    // 5. 기존 리팩토링된 로직 호출
    // 가입금액 상태 업데이트
    product_detail.updateCoverageAmount(coverage_cd, change_coverage_amount);

    // 변경된 금액에 따른 보험료 재계산
    product_detail.updateInsurancePremium(coverage_cd, change_coverage_amount);
});



/**
 * 보장 필터 탭(전체, 가입, 미가입)의 클릭 이벤트를 통합 처리합니다.
 */
const filterButtons = document.querySelectorAll("#all-product, #assign, #not-assign");
filterButtons.forEach(button => {
    button.addEventListener("click", function () {
        // 1. 모든 버튼에서 active 클래스 제거 (기존 removeClass 대체)
        filterButtons.forEach(btn => btn.classList.remove("active"));

        // 2. 클릭된 버튼에만 active 클래스 추가
        this.classList.add("active");

        // 3. 버튼의 ID 또는 미리 정의된 데이터셋에 따라 필터링 호출
        let filterType = "all";
        if (this.id === "assign") filterType = "assign";
        else if (this.id === "not-assign") filterType = "not-assign";

        product_detail.filterCoverageListByStatus(filterType);
    });
});

