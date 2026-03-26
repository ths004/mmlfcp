const BASE_URL = "/";
const API_LOADING = "api/MMCP/Mobile-JWTConfirm";
const API_SELECT_PRODUCTS = "api/MMCP/CompareProducts";
const API_PRINT_PRODUCTS = "api/MMCP/PrintProducts";


var state =
{

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
    birth_date: "19800101",
    PlanID: "",
    checked_val: "전체",

    prdt_cd: "11",
    expiration_cd: "4",
    use_display_yn: "N", //기본값  N으로 고정

    bojangGuideList: [],
    ProductList: [],
    insurProductList: [],

    productGroupName: "",
    paymentPeriodName: "",

    selected_gender: "남자",
    selected_product: "종합(무해지형)",
    selected_expiration: "20년/100세",

    init_load_data: function () {
        const url = BASE_URL + API_LOADING;
        state.jwt = "";
        state.jwt = app._getUrlParameter("token");
        state.show_spinner();

        $.ajax({
            type: "get",
            url: url,
            data:
            {
                token: state.jwt,
            },
            success: function (data) {
                if (data.error == false) {
                    state.setProductList(data.productsGroupList, data.paymentExpirationList, data.mmcpPlanList, data.mmcpUploadDate);
                    state.getProductList();
                }
                else {
                    alert(data.errorMessage);
                    state.init_setting();
                    state.setting_opacity();
                }
            },
            error: function (request, status, error) {
                switch (request.status) {
                    case 415:
                        alert("잘못된 파일입니다.");
                        break;
                    case 404:
                        alert("잘못된 요청입니다.");
                    case 500:
                        alert("서버에서 오류가 발생하였습니다.");
                        break;
                    default:
                        alert("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
                }
                console.log("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
            },
            complete: function () {
                state.hide_spinner();
            },
        });

    },

    init_setting: function () {

        $(".item-menu-box").removeClass("active");
        $("#all").addClass("active");

        //전체,암,뇌,심.. 선택 항목 안보이기
        $("article.popup3").css("display", "none");

        //암,뇌,심,진단,수술/입원 비활성화
        $("#all").css("pointer-events", "none");
        $("#cancer").css("pointer-events", "none");
        $("#brain").css("pointer-events", "none");
        $("#heart").css("pointer-events", "none");
        $("#diagnosis").css("pointer-events", "none");
        $("#surgery").css("pointer-events", "none");
        $("#change-bojang").css("pointer-events", "none");

        $("#change-bojang").prop("disabled", true);
        $(".mt40").css("display", "none");
        $(".list-filter-layout1").css("display", "none");
        $(".result-list-layout1").css("display", "none");
    },

    setting_opacity: function () {
        $("#all").css("opacity", "0.2");
        $("#cancer").css("opacity", "0.2");
        $("#brain").css("opacity", "0.2");
        $("#heart").css("opacity", "0.2");
        $("#diagnosis").css("opacity", "0.2");
        $("#surgery").css("opacity", "0.2");
    },

    init_opacity: function () {
        $("#all").css("opacity", "");
        $("#cancer").css("opacity", "");
        $("#brain").css("opacity", "");
        $("#heart").css("opacity", "");
        $("#diagnosis").css("opacity", "");
        $("#surgery").css("opacity", "");
    },



    display_setting: function () {

        //전체,암,뇌,심.. 선택 항목 보이기
        $("article.popup3").css("display", "block");

        //암,뇌,심,진단,수술/입원 비활성화 해제
        $("#all").removeAttr("style");
        $("#cancer").removeAttr("style");
        $("#brain").removeAttr("style");
        $("#heart").removeAttr("style");
        $("#diagnosis").removeAttr("style");
        $("#surgery").removeAttr("style");
        $("#change-bojang").css("pointer-events", "");

        //비활성화 해제
        $("#change-bojang").prop("disabled", false);
        $(".mt40").css("display", "block");
        $(".list-filter-layout1").css("display", "block");
        $(".result-list-layout1").css("display", "block");
    },


    calculate_insur_age: function () {
        var insur_age = app._insu_age(this.birth_date);
        state.insur_age = insur_age;
        $(".old-view-box").text("보험나이 : " + state.insur_age + "세");
    },
    init_data_load: function (data) {
        //생성
        this.bojangGuideList = data.mmcpBojangGuideList;
        this.ProductList = data.mmcpProductList;
        this.insurProductList = data.insurProductList;


        //보장
        for (var i = 0; i < this.bojangGuideList.length; i++) {
            //보장 종류 선택 전체-암-뇌-심-진단..
            this.bojangGuideList[i].bojang_checked = "all-checked";
        }
        //상품

        //회사별 대표담보위치
        this.guide_bojang_item = new Map();

        for (var i = 0; i < this.ProductList.length; i++) {
            this.ProductList[i].total_premium = 0;
            for (var j = 0; j < this.ProductList[i].DetailList.length; j++) {

                //각 보험료
                this.ProductList[i].DetailList[j].color = "price-black"; //black color 

                //보장 종류 선택 전체-암-뇌-심-진단..
                this.ProductList[i].DetailList[j].bojang_checked = "all-checked";

                //보장 항목 체크,비체크
                this.ProductList[i].DetailList[j].detail_checked = "checked";

                //가이드 대표담보 와 상품별 대표담보 위치를 매핑한다.
                this.guide_bojang_item.set(this.ProductList[i].CompanyCD + this.ProductList[i].DetailList[j].BojangCD, j);

                //합계보험료
                this.ProductList[i].total_premium += parseInt(this.ProductList[i].DetailList[j].PlanPremium);
            }
        }
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

    setProductList: function (productsGroupList, paymentExpirationList, mmcpPlanList, mmcpUploadDate) {
        this.productsGroupList = productsGroupList;
        this.paymentExpirationList = paymentExpirationList;
        this.mmcpPlanList = mmcpPlanList;
        this.mmcpUploadDate = mmcpUploadDate;
        this.setProductsGroupCD(); //최초 상품유형,만기 불러오기
    },

    setProductsGroupCD: function () {
        var list_HTML = "";
        $("#productsgroupList").empty();
        list_HTML += "<ul>";
        for (var i = 0; i < this.productsGroupList.length; i++) {

            list_HTML += "<li>";
            list_HTML += "<a href='#none' class='select-btn' prdt_cd={0} onclick='selectProduct(this)'>{1}</a>".Format(this.productsGroupList[i].ProductsGroupCD, this.productsGroupList[i].ProductsGroupName);
            list_HTML += "</li>";

            if ((this.insur_age >= 0 && this.insur_age <= 15) && this.productsGroupList[i].ProductsGroupCD == "31") {
                //초기화 후 재생성
                this.selected_product = "";
                this.selected_product = this.productsGroupList[i].ProductsGroupName;

                $("#selected_product").removeAttr("prdt_cd");
                $("#selected_product").attr("prdt_cd", this.productsGroupList[i].ProductsGroupCD);
                $("#selected_product").text(this.productsGroupList[i].ProductsGroupName);
                this.setPaymentExpirationCD(this.productsGroupList[i].ProductsGroupCD);
            }
            else if ((this.insur_age >= 16 && this.insur_age <= 40) && this.productsGroupList[i].ProductsGroupCD == "33") {
                //초기화 후 재생성
                this.selected_product = "";
                this.selected_product = this.productsGroupList[i].ProductsGroupName;

                $("#selected_product").removeAttr("prdt_cd");
                $("#selected_product").attr("prdt_cd", this.productsGroupList[i].ProductsGroupCD);
                $("#selected_product").text(this.productsGroupList[i].ProductsGroupName);
                this.setPaymentExpirationCD(this.productsGroupList[i].ProductsGroupCD);
            }
            else if (this.insur_age >= 41 && this.productsGroupList[i].ProductsGroupCD == "11") {
                $("#selected_product").removeAttr("prdt_cd");
                $("#selected_product").attr("prdt_cd", this.productsGroupList[i].ProductsGroupCD);
                $("#selected_product").text(this.productsGroupList[i].ProductsGroupName);
                this.setPaymentExpirationCD(this.productsGroupList[i].ProductsGroupCD);
            }
        }
        list_HTML += "</ul>";
        $("#productsgroupList").html(list_HTML);
    },

    setPaymentExpirationCD: function (prdt_cd) {

        //prdt_cd 속성 갱신
        $("#selected_product").removeAttr("prdt_cd");
        $("#selected_product").attr("prdt_cd", prdt_cd);

        var list_HTML = "";
        $("#paymentgroupList").empty();

        list_HTML += "<ul>";
        for (var i = 0; i < this.paymentExpirationList.length; i++) {
            if (this.paymentExpirationList[i].ProductsGroupString.indexOf(prdt_cd) >= 0) {
                list_HTML += "<li>";
                list_HTML += "<a href='#none' class='select-btn' expiration_cd={0} onclick='selectExpiration(this)'>{1}</a>".Format(this.paymentExpirationList[i].PaymentExpirationCD, this.paymentExpirationList[i].PaymentExpirationName);
                list_HTML += "</li>";
            }
        }
        list_HTML += "</ul>";
        $("#paymentgroupList").html(list_HTML);

        for (var j = (this.paymentExpirationList.length - 1); j >= 0; j--) {
            if (this.paymentExpirationList[j].ProductsGroupString.indexOf(prdt_cd) >= 0) {
                if ((this.insur_age >= 0 && this.insur_age <= 15) && prdt_cd == "31") {

                    //초기화 후 재생성
                    this.selected_expiration = "";
                    this.selected_expiration = this.paymentExpirationList[j].PaymentExpirationName;

                    $("#selected_expiration").removeAttr("expiration_cd");
                    $("#selected_expiration").attr("expiration_cd", this.paymentExpirationList[j].PaymentExpirationCD);
                    $("#selected_expiration").text(this.paymentExpirationList[j].PaymentExpirationName);
                }
                else if ((this.insur_age >= 16 && this.insur_age <= 40) && prdt_cd == "33") {

                    //초기화 후 재생성
                    this.selected_expiration = "";
                    this.selected_expiration = this.paymentExpirationList[j].PaymentExpirationName;

                    $("#selected_expiration").removeAttr("expiration_cd");
                    $("#selected_expiration").attr("expiration_cd", this.paymentExpirationList[j].PaymentExpirationCD);
                    $("#selected_expiration").text(this.paymentExpirationList[j].PaymentExpirationName);
                }
                else if (this.insur_age >= 41 && prdt_cd == "11") {

                    //초기화 후 재생성
                    this.selected_expiration = "";
                    this.selected_expiration = this.paymentExpirationList[4].PaymentExpirationName;

                    $("#selected_expiration").removeAttr("expiration_cd");
                    $("#selected_expiration").attr("expiration_cd", this.paymentExpirationList[4].PaymentExpirationCD);
                    $("#selected_expiration").text(this.paymentExpirationList[4].PaymentExpirationName);
                }
                else {

                    //초기화 후 재생성
                    this.selected_expiration = "";
                    this.selected_expiration = this.paymentExpirationList[j].PaymentExpirationName;

                    $("#selected_expiration").removeAttr("expiration_cd");
                    $("#selected_expiration").attr("expiration_cd", this.paymentExpirationList[j].PaymentExpirationCD);
                    $("#selected_expiration").text(this.paymentExpirationList[j].PaymentExpirationName);
                }
            }
        }
    },

    getProductList: function () {
        const url = BASE_URL + API_SELECT_PRODUCTS;
        var prdt_cd = $("#selected_product").attr("prdt_cd");
        var expiration_cd = $("#selected_expiration").attr("expiration_cd");
        var PlanID = this.mmcpPlanList.filter(function (key) {
            return (
                key.ProductsGroupCD == prdt_cd && key.PaymentExpirationCD == expiration_cd
            );
        })[0].PlanID;

        state.prdt_cd = prdt_cd;
        state.expiration_cd = expiration_cd;
        state.PlanID = PlanID;

        var add_data =
        {
            PlanID: state.PlanID,
            Gender: state.gender,
            isBojangCDShowAllYN: state.use_display_yn,
            InsurAge: state.insur_age
        };

        //start
        state.show_spinner();

        $.ajax({
            type: "POST",
            url: url,
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", state.jwt);
            },
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(add_data),
            datatype: "JSON",
            success: function (data) {

                if (data.error == false && (data.mmcpProductList.length != 0 || data.insurProductList.length != 0)) {
                    state.init_data_load(data);
                    state.display_setting();
                    state.get_product_all_premium_lists();
                }
                else {
                    alert("조회된 상품이 없습니다.");
                    state.init_setting();
                    return;
                }
            },
            error: function (request, status, error) {
                switch (request.status) {
                    case 415:
                        alert("잘못된 파일입니다.");
                        break;
                    case 404:
                        alert("잘못된 요청입니다.");
                    case 500:
                        alert("서버에서 오류가 발생하였습니다.");
                        break;
                    default:
                        alert("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
                }
                console.log("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
            },
            complete: function () {
                state.hide_spinner();
            },
        });
    },

    //초기화
    set_init_bojang_checked_value: function (is_checked) {
        //보장
        for (var i = 0; i < this.bojangGuideList.length; i++) {
            this.bojangGuideList[i].bojang_checked = is_checked == true ? "all-checked" : ""; //보장 종류 선택 암-뇌-심-진단..
        }

        //상품
        for (var i = 0; i < this.ProductList.length; i++) {
            for (var j = 0; j < this.ProductList[i].DetailList.length; j++) {
                this.ProductList[i].DetailList[j].bojang_checked = is_checked == true ? "all-checked" : ""; //보장 종류 선택 암-뇌-심-진단..
                this.ProductList[i].DetailList[j].detail_checked = is_checked == true ? "checked" : ""; //보장 항목 체크,비체크
            }
        }
    },

    //보장 종류 선택 시(전체-암-뇌-심-진단-수술-입원) bojang checked 상태 변경
    set_bojang_checked_value: function (is_checked) {

        var selected_bojang_name_list = $(".setting-category-list .item-menu-box.active");

        //보장
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            if (is_checked == true && state.bojangGuideList[i].BojangName.indexOf(this.checked_val) >= 0) {
                state.bojangGuideList[i].bojang_checked = "checked";
            }
            else if ((is_checked == true && this.checked_val == "수술/입원") && (state.bojangGuideList[i].BojangName.indexOf("수술") >= 0 || state.bojangGuideList[i].BojangName.indexOf("입원") >= 0)) {
                state.bojangGuideList[i].bojang_checked = "checked";
            }

            else if ((is_checked == true && state.bojangGuideList[i].BojangName.indexOf(this.checked_val) < 0) && state.bojangGuideList[i].bojang_checked == "all-checked") {
                state.bojangGuideList[i].bojang_checked = "";
            }

            else if (is_checked == false) {
                state.bojangGuideList[i].bojang_checked = "";
                for (var j = 0; j < selected_bojang_name_list.length; j++) {
                    if (state.bojangGuideList[i].BojangName.indexOf(selected_bojang_name_list[j].getAttribute("value")) >= 0) {
                        state.bojangGuideList[i].bojang_checked = "checked";
                    }
                    else if (selected_bojang_name_list[j].getAttribute("value") == "수술입원" && (state.bojangGuideList[i].BojangName.indexOf("수술") >= 0 || state.bojangGuideList[i].BojangName.indexOf("입원") >= 0)) {
                        state.bojangGuideList[i].bojang_checked = "checked";
                    }
                }
            }
        }

        //상품
        for (var i = 0; i < this.ProductList.length; i++) {
            for (var j = 0; j < this.ProductList[i].DetailList.length; j++) {
                if (is_checked == true && this.ProductList[i].DetailList[j].BojangName.indexOf(this.checked_val) >= 0) {
                    this.ProductList[i].DetailList[j].bojang_checked = "checked";
                    this.ProductList[i].DetailList[j].detail_checked = "checked";
                }
                else if ((is_checked == true && this.checked_val == "수술/입원") && (this.ProductList[i].DetailList[j].BojangName.indexOf("수술") >= 0 || this.ProductList[i].DetailList[j].BojangName.indexOf("입원") >= 0)) {
                    this.ProductList[i].DetailList[j].bojang_checked = "checked";
                    this.ProductList[i].DetailList[j].detail_checked = "checked";
                }

                else if ((is_checked == true && this.ProductList[i].DetailList[j].BojangName.indexOf(this.checked_val) < 0) && this.ProductList[i].DetailList[j].bojang_checked == "all-checked") {
                    this.ProductList[i].DetailList[j].bojang_checked = "";
                    this.ProductList[i].DetailList[j].detail_checked = "";
                }

                else if (is_checked == false) {
                    this.ProductList[i].DetailList[j].bojang_checked = "";
                    this.ProductList[i].DetailList[j].detail_checked = "";

                    for (var k = 0; k < selected_bojang_name_list.length; k++) {
                        if (this.ProductList[i].DetailList[j].BojangName.indexOf(selected_bojang_name_list[k].getAttribute("value")) >= 0) {
                            this.ProductList[i].DetailList[j].bojang_checked = "checked";
                            this.ProductList[i].DetailList[j].detail_checked = "checked";
                        }
                        else if (selected_bojang_name_list[k].getAttribute("value") == "수술입원" && (this.ProductList[i].DetailList[j].BojangName.indexOf("수술") >= 0 || this.ProductList[i].DetailList[j].BojangName.indexOf("입원") >= 0)) {
                            this.ProductList[i].DetailList[j].bojang_checked = "checked";
                            this.ProductList[i].DetailList[j].detail_checked = "checked";
                        }
                    }
                }
            }
        }
    },


    //오름차순
    get_product_all_premium_lists: function () {
        var class_attr = "";
        var list_HTML = "";
        var a_href_name = "detail";
        var min_pos = 0;
        var max_pos = 0;
        var exception_prdt = "51,61,71,81,86,91";

        if (exception_prdt.indexOf(this.prdt_cd) >= 0) {
            $("#all").css("pointer-events", "none");
            $("#cancer").css("pointer-events", "none");
            $("#brain").css("pointer-events", "none");
            $("#heart").css("pointer-events", "none");
            $("#diagnosis").css("pointer-events", "none");
            $("#surgery").css("pointer-events", "none");
            this.setting_opacity();
        }
        else {
            this.init_opacity();
        }


        this.ProductList.sort(function (a, b) {
            if (a.total_premium - b.total_premium > 0) { return 1; }
            else if (a.total_premium - b.total_premium < 0) { return -1; }
            else { return 0; }
        });

        if (this.ProductList.length > 0) {
            min_pos = this.ProductList[0].CompanyCD;
            max_pos = this.ProductList[this.ProductList.length - 1].CompanyCD;
        }

        $("#low_premium").prop("checked", true);
        $("#productList").empty();
        list_HTML += "<ul>";
        for (var i = 0; i < this.ProductList.length; i++) {
            class_attr = this.ProductList[i].CompanyCD == min_pos ? "price-blue" : this.ProductList[i].CompanyCD == max_pos ? "price-red" : "price-black";
            list_HTML += "<li>";
            list_HTML += "<a href={0} class='item-wrap'>".Format('javascript:popupOpen(\'' + a_href_name + "','" + this.ProductList[i].CompanyCD + "')");
            list_HTML += "<div class='img-box'>";
            list_HTML += "<img src={0} alt='이미지'>".Format("./img/" + this.ProductList[i].CompanyCD + ".png");
            list_HTML += "</div>";
            list_HTML += "<div class='info-box'>";
            list_HTML += "<div class={0} compy_cd={1}>{2}</div>"
                .Format(class_attr, this.ProductList[i].CompanyCD, this.ProductList[i].total_premium.format() + "원");
            list_HTML += "</div>";
            list_HTML += "</a>";
            list_HTML += "</li>";
        }
        list_HTML += "</ul>";
        $("#productList").html(list_HTML);
    },

    //내림차순
    get_desc_product_premium_lists: function () {
        var class_attr = "";
        var list_HTML = "";
        var a_href_name = "detail";
        var min_pos = 0;
        var max_pos = 0;

        // 내림차순으로 정렬하는 비교 함수를 사용
        this.ProductList.sort((a, b) => b.total_premium - a.total_premium);

        if (this.ProductList.length > 0) {
            min_pos = this.ProductList[this.ProductList.length - 1].CompanyCD;
            max_pos = this.ProductList[0].CompanyCD;
        }

        $("#productList").empty();
        list_HTML += "<ul>";
        for (var i = 0; i < this.ProductList.length; i++) {
            class_attr = this.ProductList[i].CompanyCD == min_pos ? "price-blue" : this.ProductList[i].CompanyCD == max_pos ? "price-red" : "price-black";
            list_HTML += "<li>";
            list_HTML += "<a href={0} class='item-wrap'>".Format('javascript:popupOpen(\'' + a_href_name + "','" + this.ProductList[i].CompanyCD + "')");
            list_HTML += "<div class='img-box'>";
            list_HTML += "<img src={0} alt='이미지'>".Format("./img/" + this.ProductList[i].CompanyCD + ".png");
            list_HTML += "</div>";
            list_HTML += "<div class='info-box'>";
            list_HTML += "<div class={0} compy_cd={1}>{2}</div>"
                .Format(class_attr, this.ProductList[i].CompanyCD, this.ProductList[i].total_premium.format() + "원");
            list_HTML += "</div>";
            list_HTML += "</a>";
            list_HTML += "</li>";
        }
        list_HTML += "</ul>";
        $("#productList").html(list_HTML);
    },

};


$(document).ready(function () {

    state.calculate_insur_age();
    state.init_load_data();

    //생년월일
    document.getElementById('birth_date').addEventListener("input", function (e) {
        //insert
        state.birth_date = e.target.value;
        $("#birth_date").attr("value", e.target.value);
        $("#birth_date").val(e.target.value);

        state.init_setting();
        state.calculate_insur_age();
        state.setProductsGroupCD();
    });

    //성별
    $('input[type=radio][name="gender"]').on('change', function () {

        state.init_setting();
        state.gender = this.value;
        state.selected_gender = state.gender == "M" ? "남자" : "여자";
    });


    //조회하기 클릭
    document.getElementById("product-retrieve").addEventListener("click", function () {

        if (app._isValidDate(state.birth_date) == false) {
            alert("생년월일을 확인해주세요.");
            $("#change-bojang").prop("disabled", true);
            state.setting_opacity();
            return;
        }
        else {
            $("#change-bojang").prop("disabled", false);
            //active 클래스 제거
            $(".setting-category-list .item-menu-box").removeClass("active");

            //추가
            $("#all-product").addClass("active");
            $("#all").addClass("active");
            state.init_opacity();
            state.getProductList();
        }

    });

    //보험료 낮은순, 높은순 정렬
    $('input[type=radio][name="filter"]').on('change', function () {
        var change_premium = this.value;
        if (change_premium == "low_premium") {
            state.get_product_all_premium_lists();
        }
        else if (change_premium == "high_premium") {
            state.get_desc_product_premium_lists();
        }
    });

});

$(document).on("click", ".setting-category-list .item-menu-box", function (e) {

    var is_checked = $(this).hasClass("active");
    var checked_insur_val = e.currentTarget.innerText == "진단" ? "진단비" : e.currentTarget.innerText;

    // init / setting
    state.checked_val = "";
    state.checked_val = checked_insur_val.replace(/^\s+|\s+$/g, "");

    if (is_checked == true && state.checked_val == "전체") {
        //setting
        state.set_init_bojang_checked_value(is_checked);
        product_detail.calc_selected_bojang_total_premium(is_checked);

        //rendering
        state.get_product_all_premium_lists();
    }
    else if (is_checked == true && state.checked_val != "전체") {

        //init
        product_detail.insur_HTML = "";

        //setting
        state.set_bojang_checked_value(is_checked);
        product_detail.calc_selected_bojang_total_premium(is_checked);
        product_detail.insur_HTML += product_detail.selected_bojang_lists();

        //rendering
        $("#allProductsDetailList").empty();
        $("#allProductsDetailList").append(product_detail.insur_HTML);
        state.get_product_all_premium_lists();
    }

    else if (is_checked == false) {
        //init
        product_detail.insur_HTML = "";

        //setting
        state.set_bojang_checked_value(is_checked);
        product_detail.calc_selected_bojang_total_premium(is_checked);
        product_detail.insur_HTML += product_detail.selected_bojang_lists();

        //rendering
        $("#allProductsDetailList").empty();
        $("#allProductsDetailList").append(product_detail.insur_HTML);
        state.get_product_all_premium_lists();
    }
});