var app = {
  _monthDiff: function (birthDate, nowdate) {
    var months = nowdate.getMonth() - birthDate.getMonth() + (12 * (nowdate.getFullYear() - birthDate.getFullYear()));

    if (nowdate.getDate() < birthDate.getDate()) {
      months--;

    }
    return months;
  },

  _isValidDate: function (dateString) {

    var regex_date = /^\d{4}\d{1,2}\d{1,2}$/;
    if (!regex_date.test(dateString)) {
      return false;
    }
    var year = dateString[0] + dateString[1] + dateString[2] + dateString[3];
    var month = dateString[4] + dateString[5];
    var day = dateString[6] + dateString[7];
    var monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Check the ranges of month and year
    if (year < 1000 || year > 3000 || month == 0 || month > 12) {
      return false;
    }
    // Adjust for leap years
    if (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)) {
      monthLength[1] = 29;
    }
    // Check the range of the day
    return day > 0 && day <= monthLength[month - 1];
  },

  _insu_age: function (yyyymmdd) {


    var nowdate = new Date();
    var birthDate = new Date(yyyymmdd.substring(0, 4), yyyymmdd.substring(4, 6) - 1, yyyymmdd.substring(6, 8));
    var difM = this._monthDiff(birthDate, nowdate);
    var x = difM % 12;
    var insuAge = insuAge = parseInt(difM / 12);

    if (yyyymmdd.length < 8) {
      insuAge = 0;

    }
    else if (x >= 6 && yyyymmdd.length >= 8) {
      insuAge = insuAge + 1;
    }
    else if (insuAge < 0) {
      insuAge = 0;
    }
    return insuAge;
  },

  _getUrlParameter: function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

    for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === sParam) {
        return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
      }
    }
    return false;
  },

  _addComma(str) {
    return str.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },
  _removeComma(str) {
    return str.replace(/\,/g, '');
  },

  _removeSpaces(str) {
    return str.replace(/\s/g, "");
  },

  /** YYYYMMDD 또는 YYYY-MM-DD → YYYYMMDD */
  _toYyyymmdd: function (value) {
    const s = String(value ?? "").trim();
    if (/^\d{8}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "");
    return "";
  },

  /** YYYYMMDD → date input 값(YYYY-MM-DD) */
  _toDateInputValue: function (yyyymmdd) {
    const s = this._toYyyymmdd(yyyymmdd);
    if (!s || !this._isValidDate(s)) return "";
    return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  },

};

$(document).ready(function () {
  // 숫자 타입에서 쓸 수 있도록 format() 함수 추가
  Number.prototype.format = function () {
    if (this == 0) return 0;

    var reg = /(^[+-]?\d+)(\d{3})/;
    var n = this + "";

    while (reg.test(n)) n = n.replace(reg, "$1" + "," + "$2");

    return n;
  };

  // 문자열 타입에서 쓸 수 있도록 format() 함수 추가
  String.prototype.format = function () {
    var num = parseFloat(this);
    if (isNaN(num)) return "0";

    return num.format();
  };

  String.prototype.currency = function () {
    let currency = this.replace(/,/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return currency.includes('.') ? currency.substr(0, currency.indexOf('.')) : currency;
  };


  if (!String.prototype.Format) {
    String.prototype.Format = function () {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != "undefined" ? args[number] : match;
      });
    };
  }

  if (!Map.prototype.getNumber) {
    Map.prototype.getNumber = function (key, value) {
      return this.has(key) ? this.get(key) : value
    }
  }

});