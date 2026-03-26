

const popupOpen = (name, compy_cd) => {

	//회사별 상세정보
	if (name == "detail") {
		product_detail.company_products_detail(compy_cd);
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
		product_detail.all_bojang_detail();
		$('article.popup.popup-' + name + '').show();
	}
}
const popupClose = (name) => {

	if (name == "detail") {
		$('article.popup.popup-' + name + '').hide();
		$("#low_premium").prop("checked", true);
		state.get_product_all_premium_lists();
	}
	else if (name == "setting") {
		$('article.popup.popup-' + name + '').hide();
		product_detail.get_selected_insur_products();
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

const termsLayerOpen = (compy_cd, bojang_cd) => {

	product_detail.selected_company_insurproducts_detail_list(compy_cd, bojang_cd);
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

	_wrap.find('.set-btn').text($(e).text());
	_wrap.removeClass('active');
	$('.container').removeClass('overlay');

	var prdt_cd = $(e).context.attributes.prdt_cd.value;
	state.prdt_cd = prdt_cd;

	state.selected_product = "";
	state.selected_product = $(e).context.innerText;
	state.init_setting();
	state.setPaymentExpirationCD(prdt_cd);
}

const selectExpiration = (e) => {

	let _wrap = $(e).parents('.sbox');

	_wrap.find('.select-btn').removeClass('selected');
	$(e).addClass('selected')

	_wrap.find('.set-btn').text($(e).text());
	_wrap.removeClass('active');

	$('.container').removeClass('overlay');

	var expiration_cd = $(e).context.attributes.expiration_cd.value;
	state.expiration_cd = expiration_cd;

	state.selected_expiration = "";
	state.selected_expiration = $(e).context.innerText;

	//expiration_cd 속성 갱신
	$("#selected_expiration").removeAttr("expiration_cd");
	$("#selected_expiration").attr("expiration_cd", expiration_cd);

	state.init_setting();
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
