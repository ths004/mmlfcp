export const app = {
    getUrlParameter(sParam) {
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
    getAgefromString(yyyymmdd) {
        if (!yyyymmdd || yyyymmdd.length < 8) return 0;

        const now = new Date();
        const birthYear = parseInt(yyyymmdd.slice(0, 4), 10);
        const birthMonth = parseInt(yyyymmdd.slice(4, 6), 10) - 1; // 0-based
        const birthDay = parseInt(yyyymmdd.slice(6, 8), 10);

        const birthDate = new Date(birthYear, birthMonth, birthDay);

        const totalMonths = this.monthDiff(birthDate, now);
        let age = Math.floor(totalMonths / 12);

        // 6개월 이상이면 보험나이 +1
        if (totalMonths % 12 >= 6) {
            age += 1;
        }
        return age;
    },

    monthDiff(birthDate, nowDate) {
        let months = (nowDate.getFullYear() - birthDate.getFullYear()) * 12;
        months += nowDate.getMonth() - birthDate.getMonth();

        // 현재 일(day)이 생일 일보다 작으면 한 달 차감
        if (nowDate.getDate() < birthDate.getDate()) {
            months--;
        }
        return months;
    },

    // 날짜 형식을 'YYYY-MM-DD'로 변환하는 함수
    formatDate(dateString) {
        // 1. 숫자로 들어올 경우를 대비해 문자열로 변환하고, 데이터가 없으면 빈 문자열 반환
        const str = String(dateString || "");

        // 2. 8자리가 아닐 경우 원본을 반환하거나 예외 처리 (방어 코드)
        if (str.length !== 8) return str;

        // 3. slice를 이용해 깔끔하게 분리 (죠르디러버님의 아이디어!)
        const year = str.slice(0, 4);
        const month = str.slice(4, 6);
        const day = str.slice(6, 8);

        // 4. 점(.)이나 대시(-) 등 원하는 구분자로 결합
        return `${year}.${month}.${day}`;
    },
    convertDateFormat(date) {
        if (!(date instanceof Date) || isNaN(date)) {
            console.warn('⚠️ convertDateFormat: 유효하지 않은 날짜입니다.', date);
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 01~12
        const day = String(date.getDate()).padStart(2, '0'); // 01~31

        return `${year}.${month}.${day}`;
    },


    formatNumber(number) {
        return number.toLocaleString('en-US');
    },
    parseNumber(val) {
        return Number(String(val).replace(/,/g, '')) || 0;
    },
    formatInsuranceBirtDate(dateStr) {
        const year = dateStr.substring(0, 4);   // 앞의 4자리: 연도
        const month = dateStr.substring(4, 6);  // 그다음 2자리: 월
        const day = dateStr.substring(6, 8);    // 마지막 2자리: 일
        return `${year}-${month}-${day}`;       // "YYYY-MM-DD" 형식으로 변환
    },
    isValidDate(dateString) {
        // yyyyMMdd 형식(숫자만, 총 8자리)인지 확인
        if (!/^\d{8}$/.test(dateString)) return false;

        const year = parseInt(dateString.slice(0, 4), 10);
        const month = parseInt(dateString.slice(4, 6), 10);
        const day = parseInt(dateString.slice(6, 8), 10);

        // 년/월 유효성 체크
        if (year < 1000 || year > 3000 || month < 1 || month > 12) return false;

        // 월별 최대 일수 (윤년 체크 포함)
        const monthLength = [31, (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) ? 29 : 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // 일(day) 범위 체크
        return day >= 1 && day <= monthLength[month - 1];
    },
};