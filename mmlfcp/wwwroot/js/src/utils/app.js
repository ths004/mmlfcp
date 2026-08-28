const AUTH_TOKEN_KEY = 'mmlfcp_auth_token';
const URL_PATH_KEY = 'mmlfcp_url_path';
const DEVICE_KEY = 'mmlfcp_device';
const HIDDEN_QUERY_KEYS = ['token', 'path', 'device'];

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

    _sessionGet(key) {
        try {
            return sessionStorage.getItem(key) || '';
        } catch (_) {
            return '';
        }
    },

    _sessionSet(key, value) {
        if (value == null || value === '') return;
        try {
            sessionStorage.setItem(key, String(value));
        } catch (_) { /* ignore */ }
    },

    /** sessionStorage에 저장된 인증 토큰 */
    getStoredAuthToken() {
        return this._sessionGet(AUTH_TOKEN_KEY);
    },

    /** 토큰 저장 (탭/iframe 간 공유) */
    setStoredAuthToken(token) {
        this._sessionSet(AUTH_TOKEN_KEY, token);
    },

    getStoredUrlPath() {
        return this._sessionGet(URL_PATH_KEY);
    },

    getStoredDevice() {
        return this._sessionGet(DEVICE_KEY);
    },

    /**
     * URL·sessionStorage에서 token/path/device를 확보하고 주소창에서 제거한다.
     * @returns {{ token: string, path: string, device: string }}
     */
    captureEntryParams() {
        let token = '';
        let path = '';
        let device = '';
        try {
            const qs = new URLSearchParams(window.location.search);
            token = qs.get('token') || '';
            path = qs.get('path') || '';
            device = qs.get('device') || '';
        } catch (_) {
            token = this.getUrlParameter('token') || '';
            path = this.getUrlParameter('path') || '';
            device = this.getUrlParameter('device') || '';
        }

        if (!token) token = this.getStoredAuthToken();
        if (!path) path = this.getStoredUrlPath();
        if (!device) device = this.getStoredDevice();

        if (token) this.setStoredAuthToken(token);
        if (path) this._sessionSet(URL_PATH_KEY, path);
        if (device) this._sessionSet(DEVICE_KEY, device);

        this.stripQueryParams(HIDDEN_QUERY_KEYS);

        return {
            token: token || '',
            path: path || '',
            device: device || '',
        };
    },

    /**
     * URL·sessionStorage에서 토큰을 확보하고 주소창에서 token 파라미터를 제거한다.
     * @returns {string} JWT 또는 빈 문자열
     */
    captureAuthToken() {
        return this.captureEntryParams().token;
    },

    /** 주소창에서 지정 쿼리 키 제거 (history.replaceState) */
    stripQueryParams(keys = []) {
        try {
            const url = new URL(window.location.href);
            let changed = false;
            keys.forEach((key) => {
                if (url.searchParams.has(key)) {
                    url.searchParams.delete(key);
                    changed = true;
                }
            });
            if (!changed) return;
            const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
            history.replaceState(history.state, '', next);
        } catch (_) { /* ignore */ }
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

    getToday() {
        var date = new Date();
        var year = date.getFullYear();
        var month = ("0" + (1 + date.getMonth())).slice(-2);
        var day = ("0" + date.getDate()).slice(-2);
        return year + month + day;
    },

    formatNumber(number) {
        return number.toLocaleString('en-US');
    },

    /**
     * html[data-font] 의 CSS zoom 값.
     * Chrome에서 zoom 적용 시 getBoundingClientRect(시각)와 fixed top/left(레이아웃)가
     * 어긋나므로, fixed 배치 시 이 값으로 나눠야 한다.
     */
    getDocumentZoom() {
        try {
            const raw = getComputedStyle(document.documentElement).zoom;
            const n = parseFloat(raw);
            return Number.isFinite(n) && n > 0 ? n : 1;
        } catch (_) {
            return 1;
        }
    },

    /**
     * position:fixed 팝오버를 앵커 바로 아래에 배치 (html zoom 보정 포함)
     * @returns {{ top: number, left: number } | null}
     */
    placeFixedBelowAnchor(box, anchorEl, options = {}) {
        if (!box || !anchorEl || !document.contains(anchorEl)) return null;

        const gap = options.gap ?? 6;
        const pad = options.pad ?? 12;
        const zoom = this.getDocumentZoom();
        const rect = anchorEl.getBoundingClientRect();

        if (rect.width < 1 || rect.height < 1 ||
            rect.bottom < 0 || rect.top > window.innerHeight ||
            rect.right < 0 || rect.left > window.innerWidth) {
            return null;
        }

        const boxW = box.offsetWidth || options.fallbackWidth || 280;
        const boxH = box.offsetHeight || options.fallbackHeight || 160;

        // visual(rect) → layout(css px under zoom)
        const layoutLeftBound = window.innerWidth / zoom;
        const layoutTopBound = window.innerHeight / zoom;

        let left = (rect.left + rect.width / 2) / zoom - boxW / 2;
        left = Math.max(pad, Math.min(left, layoutLeftBound - boxW - pad));

        let top = rect.bottom / zoom + gap;
        const maxTop = layoutTopBound - Math.min(boxH, layoutTopBound - pad * 2) - pad;
        if (top > maxTop) top = Math.max(pad, maxTop);

        const topPx = Math.round(top);
        const leftPx = Math.round(left);
        box.style.top = `${topPx}px`;
        box.style.left = `${leftPx}px`;
        return { top: topPx, left: leftPx };
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

    /** YYYYMMDD 또는 YYYY-MM-DD → YYYYMMDD */
    toYyyymmdd(value) {
        const s = String(value ?? '').trim();
        if (/^\d{8}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '');
        return '';
    },

    /** YYYYMMDD → date input 값(YYYY-MM-DD) */
    toDateInputValue(yyyymmdd) {
        const s = this.toYyyymmdd(yyyymmdd);
        if (!s || !this.isValidDate(s)) return '';
        return this.formatInsuranceBirtDate(s);
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