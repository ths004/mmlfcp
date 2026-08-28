

const popupOpen = (name, company_code) => {

	//회사별 상세정보
	if (name == "detail") {
		product_detail.renderCompanyProductDetail(company_code);
		$('article.popup.popup-' + name + '').show();
	}

	//보장변경
	else if (name == "setting") {

		$("#all-product").removeClass("active");
		$("#assign").removeClass("active");
		$("#not-assign").removeClass("active");

		//전체상태만 active 상태로 초기화.
		$("#all-product").addClass("active");

		// scrollTop은 상단이기 때문에 0, duration은 애니메이션 속도입니다 (ms)
		$('div').animate({ scrollTop: 0 });
		product_detail.renderAllCoverageList();
		$('article.popup.popup-' + name + '').show();
	}
}
const popupClose = (name) => {

	if (name == "detail") {
		$('article.popup.popup-' + name + '').hide();
		$("#low_premium").prop("checked", true);
		// 낮은 보험료순 랜더링 호출
		state.renderPremiumAsc();
	}
	else if (name == "setting") {
		$('article.popup.popup-' + name + '').hide();
		// 선택된 보장의 총 보험료 재계산 및 리스트 갱신
		product_detail.refreshCoverageTotalPremium();
		state.renderPremiumAsc();
	}


}
const summaryOptionToggle = () => {
	$('.summary-option-box .summary-option-btn').toggleClass('active');
}

const listToggle = (e) => {

	if ($(e).hasClass('active')) {
		$(e).removeClass('active');
	} else {
		$('.list-layout3 .item-head-box').removeClass('active');
		$(e).addClass('active');
	}

}

const termsLayerOpen = (company_code, coverage_cd) => {

	product_detail.renderCoverageDetailTerms(company_code, coverage_cd);
	$('article.bottom-layer-terms').show();
}


const selectOpen = (e) => {
	// 기존에 열린 select 닫기
	let _wrap = $(e).parents('.sbox')

	if (_wrap.hasClass('active')) {
		_wrap.removeClass('active');

	} else {
		$('.sbox').removeClass('active');
		_wrap.addClass('active');
	}

	$('.container').addClass('overlay');
}

const selectProduct = (e) => {

	let _wrap = $(e).parents('.sbox');

	_wrap.find('.select-btn').removeClass('selected');
	$(e).addClass('selected')
	_wrap.removeClass('active');
	$('.container').removeClass('overlay');


	const plan_type = e.getAttribute('plan_type');
	state.plan_type = plan_type;

	if (typeof state.getUniquePlanTypes === 'function') {
		const matched = state.getUniquePlanTypes().find((p) => String(p.plan_type) === String(plan_type));
		if (matched) {
			state.plan_name = matched.plan_name;
			state.plan_category = matched.categoryKey;
			if (matched.insurance_type) {
				const t = typeof state.normalizeInsuranceType === "function"
					? state.normalizeInsuranceType(matched.insurance_type)
					: String(matched.insurance_type).trim().toUpperCase();
				if (t === "L" || t === "F") state.insurance_type = t;
			}
		}
	}

	const selectedProductEl = document.getElementById("selected_product");
	const label = (typeof state.formatPlanPickerTriggerText === 'function' && state.plan_name)
		? state.formatPlanPickerTriggerText(
			state.plan_category,
			typeof state.formatPlanTypeLabel === 'function'
				? state.formatPlanTypeLabel(state.plan_name)
				: $(e).text().trim()
		)
		: $(e).text().trim();

	_wrap.find('.set-btn').text(label);
	if (selectedProductEl) {
		selectedProductEl.setAttribute("plan_type", plan_type);
		selectedProductEl.textContent = label;
	}

	if (typeof state.reset_menu === 'function') state.reset_menu();
	if (typeof state.setPaymentExpirationCD === 'function') state.setPaymentExpirationCD(plan_type);
	if (typeof state.setPlanIdByCurrentState === 'function') state.setPlanIdByCurrentState();
	if (typeof state.scheduleAutoSearch === 'function') state.scheduleAutoSearch({ delay: 160 });
}

const selectExpiration = (e) => {

	let _wrap = $(e).parents('.sbox');

	_wrap.find('.select-btn').removeClass('selected');
	$(e).addClass('selected')

	_wrap.find('.set-btn').text($(e).text());
	_wrap.removeClass('active');

	$('.container').removeClass('overlay');

	// 데이터 추출 및 전역 상태(state) 반영
	const plan_payterm_type = e.getAttribute('plan_payterm_type');
	state.plan_payterm_type = plan_payterm_type;

	// 전역 선택 요소(#selected_expiration) 정보 갱신
	const selectedExpirationEl = document.getElementById("selected_expiration");
	if (selectedExpirationEl) {
		// 기존 속성을 덮어쓰므로 removeAttribute 없이 바로 설정합니다.
		selectedExpirationEl.setAttribute("plan_payterm_type", plan_payterm_type);
		selectedExpirationEl.textContent = e.textContent.trim();
	}

	// 후속 설정 초기화 (함수 존재 여부 체크 후 호출)
	if (typeof state.reset_menu === 'function') state.reset_menu();
	if (typeof state.setPlanIdByCurrentState === 'function') state.setPlanIdByCurrentState();
	if (typeof state.scheduleAutoSearch === 'function') state.scheduleAutoSearch({ delay: 160 });
}



$(document).mouseup(function (e) {

	let _selectPopup = $(".sbox");

	if (_selectPopup.has(e.target).length === 0) {
		_selectPopup.removeClass('active');
		$('.container').removeClass('overlay');
	}

})

$(document).mouseup(function (e) {

	let _bottomLayer = $("article.bottom-layer");

	if (_bottomLayer.has(e.target).length === 0) {
		_bottomLayer.hide();
	}

})

$(".item-menu-box").click(function () {
	$(this).toggleClass('active');
	if ($(this).hasClass('type-all')) {
		if ($(this).hasClass('active')) {
			$('.item-menu-box').not('.type-all').removeClass('active');
		}
	}
	else {
		$('.item-menu-box.type-all').removeClass('active');
	}
});


// 정규식
var regexp = {

	number: function (obj) {
		$(obj).val($(obj).val().replace(/[^0-9]/g, ""));
	},

	numberWithCommas: function (obj) {
		$(obj).val(addComma($(obj).val().replace(/[^0-9]/g, "")));
	},

	numberNot: function (obj) {
		$(obj).val($(obj).val().replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣|a-z|A-Z]/g, ""));
	}

};

// 콤마제거
function removeComma(str) {
	return str.replace(/\,/g, '');
}

// 숫자 3자리 콤마 생성
function addComma(str) {
	return str.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
