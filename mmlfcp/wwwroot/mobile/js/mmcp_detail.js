var product_detail =
{
    insur_HTML: "",
    selected_bojang_name: "",


    //보장 체크, 체크해제시  detail checked setting
    set_detail_checked_value: function (bojang_cd, is_checked) {
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            //보장 항목 체크
            if (state.bojangGuideList[i].BojangCD == bojang_cd && is_checked == true) {
                state.bojangGuideList[i].bojang_checked = "checked";
            }
            //보장 항목 체크해제
            else if (state.bojangGuideList[i].BojangCD == bojang_cd && is_checked == false) {
                state.bojangGuideList[i].bojang_checked = "";
            }
        }

        for (var i = 0; i < state.ProductList.length; i++) {
            for (var j = 0; j < state.ProductList[i].DetailList.length; j++) {

                //보장 항목 체크
                if (state.ProductList[i].DetailList[j].BojangCD == bojang_cd && is_checked == true) {
                    state.ProductList[i].DetailList[j].detail_checked = "checked";
                }

                //보장 항목 체크해제
                else if (state.ProductList[i].DetailList[j].BojangCD == bojang_cd && is_checked == false) {
                    state.ProductList[i].DetailList[j].detail_checked = "";
                }
            }
        }

    },
    //가입금액 변경
    set_bojang_changed_value: function (bojang_cd, change_contract_amount) {
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            if (state.bojangGuideList[i].BojangCD == bojang_cd) {
                state.bojangGuideList[i].GuideContractAmount = parseInt(change_contract_amount);
            }
        }
    },

    //보험료 변경
    set_premium_changed_value: function (bojang_cd, change_contract_amount) {
        var contract_percent = 0;
        var guide_contract_amount = 0;
        var guide_premium = 0;
        var contract_amount = 0;
        var premium = 0;

        for (var i = 0; i < state.ProductList.length; i++) {
            for (var j = 0; j < state.ProductList[i].DetailList.length; j++) {

                if (state.ProductList[i].DetailList[j].BojangCD == bojang_cd) {
                    guide_contract_amount = state.ProductList[i].DetailList[j].GuideContractAmount;
                    guide_premium = state.ProductList[i].DetailList[j].GuidePremium;
                    contract_percent = change_contract_amount / guide_contract_amount; // 비율
                    premium = isNaN(Math.round(contract_percent * guide_premium)) ? 0 : Math.round(contract_percent * guide_premium); //change premium
                    state.ProductList[i].DetailList[j].PlanContractAmount = parseInt(change_contract_amount);
                    state.ProductList[i].DetailList[j].PlanPremium = premium;
                }

            }
        }

        for (var i = 0; i < state.insurProductList.length; i++) {
            for (var j = 0; j < state.insurProductList[i].DetailList.length; j++) {
                if (state.insurProductList[i].DetailList[j].BojangCD == bojang_cd) {

                    guide_contract_amount = state.insurProductList[i].DetailList[j].GuideContractAmount;
                    guide_premium = state.insurProductList[i].DetailList[j].GuidePremium;
                    contract_amount = contract_percent * guide_contract_amount;
                    premium = isNaN(Math.round(contract_percent * guide_premium)) ? 0 : Math.round(contract_percent * guide_premium); //change premium
                    state.insurProductList[i].DetailList[j].ContractAmount = contract_amount;
                    state.insurProductList[i].DetailList[j].Premium = premium;
                }
            }
        }



    },


    //전체,암,뇌,심,진단,수술/입원 중 선택했을 경우
    calc_selected_bojang_total_premium: function (is_checked) {
        for (var i = 0; i < state.ProductList.length; i++) {
            state.ProductList[i].total_premium = 0;
            for (var j = 0; j < state.ProductList[i].DetailList.length; j++) {
                if (is_checked == true && state.ProductList[i].DetailList[j].detail_checked == "checked" && state.checked_val == "전체") {
                    state.ProductList[i].total_premium += parseInt(state.ProductList[i].DetailList[j].PlanPremium);
                }
                else if (is_checked == true && state.ProductList[i].DetailList[j].detail_checked == "checked" && state.checked_val != "전체") {
                    state.ProductList[i].total_premium += parseInt(state.ProductList[i].DetailList[j].PlanPremium);
                }
                else if (is_checked == false && state.ProductList[i].DetailList[j].detail_checked == "checked" && state.checked_val != "전체") {
                    state.ProductList[i].total_premium += parseInt(state.ProductList[i].DetailList[j].PlanPremium);
                }
            }
        }
    },

    //보장변경 화면에서 보장을 선택/미선택 했을경우
    calc_bojang_total_premium: function () {
        for (var i = 0; i < state.ProductList.length; i++) {
            state.ProductList[i].total_premium = 0;
            for (var j = 0; j < state.ProductList[i].DetailList.length; j++) {
                //전체
                if (state.ProductList[i].DetailList[j].detail_checked == "checked" && state.checked_val == "전체") {
                    state.ProductList[i].total_premium += parseInt(state.ProductList[i].DetailList[j].PlanPremium);
                }
                else if (state.ProductList[i].DetailList[j].detail_checked == "checked" && state.checked_val != "전체") {
                    state.ProductList[i].total_premium += parseInt(state.ProductList[i].DetailList[j].PlanPremium);
                }
            }
        }
    },

    //보장항목 전체 리스트
    all_bojang_detail: function () {

        var list_HTML = "";
        var bojang_exception_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016";

        $(".setting-head-box").empty();
        list_HTML += "<div class='subject-box'>{0}</div>".Format(state.selected_product);
        list_HTML += "<div class='sub-box'>{0}</div>".Format(state.selected_expiration + " ( " + state.insur_age + "세" + "/" + state.selected_gender + " ) ");
        $(".setting-head-box").html(list_HTML);


        list_HTML = "";
        $("#allProductsDetailList").empty();
        list_HTML += "<div class='list-box'>";
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            list_HTML += "<a href='#none' class='{0}'>".Format(state.bojangGuideList[i].bojang_checked == "" ? "row" : "row selected");
            list_HTML += "<div class='check-box'>";
            list_HTML += "<i class='ic ic-check'></i>";
            list_HTML += "</div>";

            list_HTML += "<div class='info-box'>";
            list_HTML += "<div class='subject-box'>{0}</div>".Format(state.bojangGuideList[i].BojangName);
            list_HTML += "<div class='con-box'>";
            list_HTML += "<div class='input-box'>";
            list_HTML += "<input type='text' {0} value='{1}' id='{2}' name='change_contract' plan_id='{3}' bojang_name='{4}' bojang_cd='{5}' contract_amount='{6}' bojang_gubun='{7}' maxlength='7' inputmode='numeric' pattern='[0-9]*' onclick='this.select();'>"
                .Format(bojang_exception_code.indexOf(state.bojangGuideList[i].BojangCD) >= 0 ? "readonly" : "", state.bojangGuideList[i].bojang_checked == "" ? 0 : state.bojangGuideList[i].GuideContractAmount.format(), "contract" + (i), state.bojangGuideList[i].PlanID, state.bojangGuideList[i].BojangName, state.bojangGuideList[i].BojangCD, state.bojangGuideList[i].GuideContractAmount, state.bojangGuideList[i].BojangGubun);
            list_HTML += "</div>";
            list_HTML += "</div>";
            list_HTML += "</div>";
            list_HTML += "</a>";

        }
        list_HTML += "</div>"; //end list-box
        $("#allProductsDetailList").html(list_HTML);
    },

    //전체를 눌렀을 경우 보장항목 전체,가입,미가입
    all_selected_assign_bojang_detail: function (selected_assign) {

        var list_HTML = "";
        var bojang_exception_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016";
        $("#allProductsDetailList").empty();
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            if (selected_assign == "all") {
                list_HTML += "<div class='list-box'>";
                list_HTML += "<a href='#none' class='{0}'>".Format(state.bojangGuideList[i].bojang_checked == "" ? "row" : "row selected");
                list_HTML += "<div class='check-box'>";
                list_HTML += "<i class='ic ic-check'></i>";
                list_HTML += "</div>";
                list_HTML += "<div class='info-box'>";
                list_HTML += "<div class='subject-box'>{0}</div>".Format(state.bojangGuideList[i].BojangName);
                list_HTML += "<div class='con-box'>";
                list_HTML += "<div class='input-box'>";
                list_HTML += "<input type='text' {0} value='{1}' id='{2}' name='change_contract' plan_id='{3}' bojang_name='{4}' bojang_cd='{5}' contract_amount='{6}' bojang_gubun='{7}' maxlength='7' inputmode='numeric' pattern='[0-9]*' onclick='this.select();'>"
                    .Format(bojang_exception_code.indexOf(state.bojangGuideList[i].BojangCD) >= 0 ? "readonly" : "", state.bojangGuideList[i].bojang_checked == "" ? 0 : state.bojangGuideList[i].GuideContractAmount.format(), "contract" + (i), state.bojangGuideList[i].PlanID, state.bojangGuideList[i].BojangName, state.bojangGuideList[i].BojangCD, state.bojangGuideList[i].GuideContractAmount, state.bojangGuideList[i].BojangGubun);
            }

            //가입
            else if (selected_assign == "assign" && state.bojangGuideList[i].bojang_checked != "") {
                list_HTML += "<div class='list-box'>";
                list_HTML += "<a href='#none' class='{0}'>".Format("row selected");
                list_HTML += "<div class='check-box'>";
                list_HTML += "<i class='ic ic-check'></i>";
                list_HTML += "</div>";

                list_HTML += "<div class='info-box'>";
                list_HTML += "<div class='subject-box'>{0}</div>".Format(state.bojangGuideList[i].BojangName);
                list_HTML += "<div class='con-box'>";
                list_HTML += "<div class='input-box'>";
                list_HTML += "<input type='text' {0} value='{1}' id='{2}' name='change_contract' plan_id='{3}' bojang_name='{4}' bojang_cd='{5}' contract_amount='{6}' bojang_gubun='{7}' maxlength='7' inputmode='numeric' pattern='[0-9]*' onclick='this.select();'>"
                    .Format(bojang_exception_code.indexOf(state.bojangGuideList[i].BojangCD) >= 0 ? "readonly" : "", state.bojangGuideList[i].GuideContractAmount.format(), "contract" + (i), state.bojangGuideList[i].PlanID, state.bojangGuideList[i].BojangName, state.bojangGuideList[i].BojangCD, state.bojangGuideList[i].GuideContractAmount, state.bojangGuideList[i].BojangGubun);
            }

            //미가입
            else if (selected_assign == "not-assign" && state.bojangGuideList[i].bojang_checked == "") {
                list_HTML += "<div class='list-box'>";
                list_HTML += "<a href='#none' class='{0}'>".Format("row");
                list_HTML += "<div class='check-box'>";
                list_HTML += "<i class='ic ic-check'></i>";
                list_HTML += "</div>";

                list_HTML += "<div class='info-box'>";
                list_HTML += "<div class='subject-box'>{0}</div>".Format(state.bojangGuideList[i].BojangName);
                list_HTML += "<div class='con-box'>";
                list_HTML += "<div class='input-box'>";
                list_HTML += "<input type='text' {0} value='{1}' id='{2}' name='change_contract' plan_id='{3}' bojang_name='{4}' bojang_cd='{5}' contract_amount='{6}' bojang_gubun='{7}' maxlength='7' inputmode='numeric' pattern='[0-9]*' onclick='this.select();'>"
                    .Format(bojang_exception_code.indexOf(state.bojangGuideList[i].BojangCD) >= 0 ? "readonly" : "", 0, "contract" + (i), state.bojangGuideList[i].PlanID, state.bojangGuideList[i].BojangName, state.bojangGuideList[i].BojangCD, state.bojangGuideList[i].GuideContractAmount, state.bojangGuideList[i].BojangGubun);
            }
            list_HTML += "</div>";
            list_HTML += "</div>";
            list_HTML += "</div>";
            list_HTML += "</a>";
        }
        list_HTML += "</div>"; //end list-box
        $("#allProductsDetailList").html(list_HTML);
    },

    //보장 변경화면에서 선택한 항목(암/뇌/심...전체 )보여주기
    selected_bojang_lists: function () {

        var list_HTML1 = "";
        var list_HTML2 = "";
        var bojang_exception_code = "i001,i002,i003,i004,i005,i006,i008,i009,i010,i011,i012,f007,f009,f010,f011,f015,f016";

        $(".setting-head-box").empty();
        list_HTML1 += "<div class='subject-box'>{0}</div>".Format(state.selected_product);
        list_HTML1 += "<div class='sub-box'>{0}</div>".Format(state.selected_expiration + " ( " + state.insur_age + "세" + "/" + state.selected_gender + " ) ");
        $(".setting-head-box").html(list_HTML1);

        list_HTML2 += "<div class='list-box'>";
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            list_HTML2 += "<a href='#none' class='{0}'>".Format(state.bojangGuideList[i].bojang_checked == "" ? "row" : "row selected");
            list_HTML2 += "<div class='check-box'>";
            list_HTML2 += "<i class='ic ic-check'></i>";
            list_HTML2 += "</div>";

            list_HTML2 += "<div class='info-box'>";
            list_HTML2 += "<div class='subject-box'>{0}</div>".Format(state.bojangGuideList[i].BojangName);
            list_HTML2 += "<div class='con-box'>";
            list_HTML2 += "<div class='input-box'>";
            list_HTML2 += "<input type='text' {0} value='{1}' id='{2}' name='change_contract' plan_id='{3}' bojang_name='{4}' bojang_cd='{5}' contract_amount='{6}' bojang_gubun='{7}' maxlength='7' inputmode='numeric' pattern='[0-9]*' onclick='this.select();'>"
                .Format(bojang_exception_code.indexOf(state.bojangGuideList[i].BojangCD) >= 0 ? "readonly" : "", state.bojangGuideList[i].bojang_checked == "" ? 0 : state.bojangGuideList[i].GuideContractAmount.format(), "contract" + (i), state.bojangGuideList[i].PlanID, state.bojangGuideList[i].BojangName, state.bojangGuideList[i].BojangCD, state.bojangGuideList[i].GuideContractAmount, state.bojangGuideList[i].BojangGubun);
            list_HTML2 += "</div>";
            list_HTML2 += "</div>";
            list_HTML2 += "</div>";
            list_HTML2 += "</a>";
        }
        list_HTML2 += "</div>"; //end list-box
        return list_HTML2;
    },

    company_products_detail: function (compy_cd) {
        var a_href_name = "detail";
        var list_HTML = "";
        var arr_temp_premium = [];

        $("#productDetailList").empty();
        list_HTML += "<div class='popup-contents'>";
        list_HTML += "<div class='popup-head-box align-right'>";
        list_HTML += "<a href={0} class='popup-close-btn'>".Format('javascript:popupClose(\'' + a_href_name + "')") + "</a>";
        list_HTML += "</div>"; //end popup-head-box align-right
        list_HTML += "<div class='popup-body-box'>";
        list_HTML += "<article class='popup-detail-layout1'>";

        //상품정보
        for (var i = 0; i < state.ProductList.length; i++) {
            if (compy_cd == state.ProductList[i].CompanyCD) {
                list_HTML += "<div class='detail-head-box'>";
                list_HTML += "<div class='img-box'>";
                list_HTML += "<img src={0} alt={1}>".Format("./img/" + state.ProductList[i].CompanyCD + ".png", state.ProductList[i].CompanyName);
                list_HTML += "</div>"; //end img-box
                list_HTML += "<div class='subject-box'>{0}</div>".Format(state.ProductList[i].ProductName);
                list_HTML += "<div class='desc-box'>{0}</div>".Format(state.ProductList[i].ProductDetailName);
                list_HTML += "</div>"; // end detail-head-box
                list_HTML += "<div class='detail-note-box'>";
                list_HTML += "<div class='note-txt-box'>{0}</div>".Format(state.ProductList[i].ProductCondition == null ? "-" : state.ProductList[i].ProductCondition.replace(/(?:\r\n|\r|\n)/g, '<br />'));
                list_HTML += "</div>"; //end detail-note-box
            }
        }

        //각 보험료 최대값,최소값
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            arr_temp_premium = [];
            for (var j = 0; j < state.ProductList.length; j++) {
                var product = state.ProductList[j];
                var detail = state.guide_bojang_item.get(product.CompanyCD + state.bojangGuideList[i].BojangCD);
                if (detail != null && state.bojangGuideList[i].bojang_checked != "") {
                    arr_temp_premium.push({ premium: product.DetailList[detail].PlanPremium, product_pos_idx: j, detail_pos_idx: detail });
                }
            }

            arr_temp_premium.sort(function (a, b) {
                if (a.premium - b.premium > 0) { return 1; }
                else if (a.premium - b.premium < 0) { return -1; }
                else { return 0; }
            });

            if (arr_temp_premium.length > 0) {
                state.ProductList[arr_temp_premium[0].product_pos_idx].DetailList[arr_temp_premium[0].detail_pos_idx].color = "price-blue";
                state.ProductList[arr_temp_premium[arr_temp_premium.length - 1].product_pos_idx].DetailList[arr_temp_premium[arr_temp_premium.length - 1].detail_pos_idx].color = "price-red";
            }
        }


        list_HTML += "<div class='detail-list-box'>";
        list_HTML += "<div class='list-wrap'>";
        list_HTML += "<ul>";
        for (var i = 0; i < state.bojangGuideList.length; i++) {
            for (var j = 0; j < state.ProductList.length; j++) {
                var product = state.ProductList[j];
                var detail = state.guide_bojang_item.get(product.CompanyCD + state.bojangGuideList[i].BojangCD) == null ? null : product.DetailList[state.guide_bojang_item.get(product.CompanyCD + state.bojangGuideList[i].BojangCD)];
                if ((detail != null && product.CompanyCD == compy_cd) && state.bojangGuideList[i].bojang_checked != "") {
                    list_HTML += "<li>";
                    list_HTML += "<div class='item-wrap'>";
                    list_HTML += "<div class='subject-box'>{0}</div>".Format(detail.BojangName);
                    list_HTML += "<div class='price-black'>{0}</div>".Format(detail.PlanContractAmount.format() + "만원");
                    list_HTML += "<div class='{0}'>{1}</div>".Format(detail.color, detail.PlanPremium.format() + "원");
                    list_HTML += "<a href={0} class='info-btn'>".Format('javascript:termsLayerOpen(\'' + detail.CompanyCD + "','" + detail.BojangCD + "')") + "</a>";
                    list_HTML += "</div>"; //end item-wrap
                    list_HTML += "</li>";
                }
            }
        }
        list_HTML += "</ul>";
        list_HTML += "</div>"; //end list-wrap
        list_HTML += "</div>"; //end detail-list-box

        list_HTML += "<div class='detail-guide-box'>";
        list_HTML += "<div class='inner wrap'>";
        list_HTML += "<div class='guide-wrap'>";
        list_HTML += "<div class='tit-box'>";
        list_HTML += "<i class='ic ic-click'></i>";
        list_HTML += "<span class='txt'>눌러보세요!</span>";
        list_HTML += "</div>";
        list_HTML += "<div class='con-box'>";
        list_HTML += "<div class='row'>";
        list_HTML += "<div class='con-txt-box'>";
        list_HTML += "<span class='txt'>보장내역에서</span>";
        list_HTML += "<i class='ic ic-info'></i>";
        list_HTML += "<span class='txt'>를 누르면 담보 상세 정보가 보입니다</span>";
        list_HTML += "</div>";
        list_HTML += "</div>";
        list_HTML += "</div>";
        list_HTML += "</div>";
        list_HTML += "</div>";
        list_HTML += "</div>";
        list_HTML += "</article>"; //end popup-detail-layout1
        list_HTML += "</div>"; //end popup-body-box
        list_HTML += "</div>"; //end popup-contents class
        $("#productDetailList").html(list_HTML);
    },

    //상세보장 리스트 보여주기
    selected_company_insurproducts_detail_list: function (compy_cd, bojang_cd) {
        var list_HTML1 = "";
        var list_HTML2 = "";
        $("#insurproductDetailList").empty();
        for (var i = 0; i < state.ProductList.length; i++) {
            for (var j = 0; j < state.ProductList[i].DetailList.length; j++) {
                if (state.ProductList[i].CompanyCD == compy_cd && state.ProductList[i].DetailList[j].BojangCD == bojang_cd) {
                    list_HTML1 += "<div class='layer-fixed-box'>";
                    list_HTML1 += "<div class='terms-head-box'>";
                    list_HTML1 += "<div class='subject-box'>{0}</div>".Format(state.ProductList[i].DetailList[j].BojangName);
                    list_HTML1 += "<div class='con-box'>";
                    list_HTML1 += "<div class='con-item-box'>";
                    list_HTML1 += "<div class='label-box'>보장금액</div>";
                    list_HTML1 += "<div class='txt-box'>{0}</div>".Format(state.ProductList[i].DetailList[j].PlanContractAmount.format() + "만원");
                    list_HTML1 += "</div>";

                    list_HTML1 += "<div class='con-item-box'>";
                    list_HTML1 += "<div class='label-box'>보험료</div>";
                    list_HTML1 += "<div class='txt-box'>{0}</div>".Format(state.ProductList[i].DetailList[j].PlanPremium.format() + "원");
                    list_HTML1 += "</div>";
                    list_HTML1 += "</div>";
                    list_HTML1 += "</div>";
                    list_HTML1 += "</div>";
                }
            }
        }
        list_HTML2 += "<div class='layer-scroll-box'>";
        list_HTML2 += "<div class='terms-list-box'>";
        for (var i = 0; i < state.insurProductList.length; i++) {
            for (var j = 0; j < state.insurProductList[i].DetailList.length; j++) {
                if (state.insurProductList[i].DetailList[j].CompanyCD == compy_cd && state.insurProductList[i].DetailList[j].BojangCD == bojang_cd) {
                    var con_box_text = state.insurProductList[i].DetailList[j].InsurName + ":"
                        + state.insurProductList[i].DetailList[j].ContractAmount.format() + "만원"
                        + "(" + state.insurProductList[i].DetailList[j].Premium.format() + "원)"
                        + "(" + state.insurProductList[i].DetailList[j].PayTerm + ")";
                    list_HTML2 += "<div class='terms-item-box'>";
                    list_HTML2 += "<div class='subject-box'>{0}</div>".Format(con_box_text);
                    list_HTML2 += "<div class='con-box'>{0}</div>".Format(state.insurProductList[i].DetailList[j].insurBojang.replace(/(?:\r\n|\r|\n)/g, '<br />'));
                    list_HTML2 += "</div>"; //end terms-item-box
                }
            }
        }
        list_HTML2 += "</div>"; //end terms-list-box
        list_HTML2 += "</div>"; //end layer-scroll-box
        $("#insurproductDetailList").html(list_HTML1 + list_HTML2);
    },

    get_selected_insur_products: function () {

        //setting calc premium
        product_detail.calc_bojang_total_premium();

        //rendering
        state.get_product_all_premium_lists();

    },
};

//보장항목 클릭, 비클릭 시
$(document).on("click", ".setting-check-list .row", function (event) {

    if ($(event.target).parents('.input-box').length) {
        return false;
    }
    $(this).toggleClass('selected');

    var id = "";
    var bojang_cd = "";
    var contract_amount = 0;

    //체크 해제
    if (event.currentTarget.className == "row") {

        id = event.currentTarget.childNodes[1].childNodes[1].childNodes[0].childNodes[0].attributes.id.value;
        bojang_cd = event.currentTarget.childNodes[1].childNodes[1].childNodes[0].childNodes[0].attributes.bojang_cd.value;

        $("#" + id).attr("value", contract_amount);
        $("#" + id).val(contract_amount);

        //setting
        product_detail.set_detail_checked_value(bojang_cd, false);

    }
    //체크
    else if (event.currentTarget.className = "row selected") {

        id = event.currentTarget.childNodes[1].childNodes[1].childNodes[0].childNodes[0].attributes.id.value;
        bojang_cd = event.currentTarget.childNodes[1].childNodes[1].childNodes[0].childNodes[0].attributes.bojang_cd.value;
        contract_amount = event.currentTarget.childNodes[1].childNodes[1].childNodes[0].childNodes[0].attributes.contract_amount.value;

        $("#" + id).attr("value", addComma(contract_amount));
        $("#" + id).val(addComma(contract_amount));

        //setting
        product_detail.set_detail_checked_value(bojang_cd, true);

    }
});


//가입금액 바뀔 시
$(document).on("input", "input[name='change_contract']", function (e) {
    var change_contract_amount = removeComma(e.target.value);
    var bojang_cd = $(this).attr("bojang_cd");

    //바뀐 가입금액 value  갱신
    $(this).removeAttr("value");
    $(this).attr("value", change_contract_amount.format());
    $(this).val(change_contract_amount.format());

    //setting
    product_detail.set_bojang_changed_value(bojang_cd, change_contract_amount);
    product_detail.set_premium_changed_value(bojang_cd, change_contract_amount);

});

//전체 선택 시
$("#all-product").click(function () {

    $("#assign").removeClass("active");
    $("#not-assign").removeClass("active");

    $(this).removeClass('active');
    $(this).addClass("active");

    product_detail.all_selected_assign_bojang_detail("all");

});

//가입 선택 시
$("#assign").click(function () {

    $("#all-product").removeClass("active");
    $("#not-assign").removeClass("active");

    $(this).removeClass('active');
    $(this).addClass("active");

    product_detail.all_selected_assign_bojang_detail("assign");
});

//미가입 선택 시
$("#not-assign").click(function () {

    $("#all-product").removeClass("active");
    $("#assign").removeClass("active");
    $(this).removeClass('active');
    $(this).addClass("active");

    product_detail.all_selected_assign_bojang_detail("not-assign");
});

