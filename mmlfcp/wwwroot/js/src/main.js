import { app } from './utils/app.js?v=26.08.26.26';
import { appConstants } from './constants/constants.js'
import { apiService } from './services/apiService.js';
import { mmlfcp_state, _state } from './core/state.js';
import { Controller } from './components/controller.js?v=26.08.26.26';
import { compareView } from './utils/compareView.js?v=26.08.27.13';

/** 인증 실패 시 화면 안내 (alert만으로는 원인 파악이 어려움) */
function showAuthFailure(message) {
    const msg = message || '인증에 실패했습니다. 접속 토큰을 확인해 주세요.';
    console.error(`[인증 실패] ${msg}`);

    const empty = document.getElementById('searchEmptyState');
    const msgEl = document.getElementById('searchEmptyMessage');
    const titleEl = empty?.querySelector('.search-empty-title');
    const table = document.querySelector('.product-table-wrap');
    if (titleEl) titleEl.textContent = '접속 인증에 실패했습니다';
    if (msgEl) msgEl.textContent = msg;
    if (empty) empty.hidden = false;
    if (table) table.style.display = 'none';

    // 입력/조회 비활성화
    ['coverage_btn_print', 'planPickerTrigger', 'genderPickerTrigger', 'insurancePickerTrigger', 'paytermPickerTrigger', 'selProductsGroupCD', 'selPaymentExpirationCD', 'selInsuranceType', 'gender', 'birth_date', 'cust_name']
        .forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        });

    try { alert(msg); } catch (_) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        //1. token/path/device 확보 후 주소창에서 숨김 (sessionStorage 보관)
        const { token, path, device } = app.captureEntryParams();
        if (!token) {
            showAuthFailure('접속 토큰이 존재하지 않습니다.');
            return;
        }

        //2. 전역 appConstants 에 토큰과 접근경로 저장
        appConstants.jwt = token;
        appConstants.access_path = 'MMLFCP_WEB';
        appConstants.device = device || "APP";

        // 3. 인증 요청
        let authResult;
        try {
            authResult = await apiService.auth();
        } catch (authErr) {
            showAuthFailure(authErr?.message || 'JWT 토큰 인증에 실패했습니다.');
            return;
        }

        if (!authResult?.is_success) {
            showAuthFailure(authResult?.error_message || authResult?.message || '인증에 실패했습니다.');
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set('mmlfcp_plans', authResult.plans);
        mmlfcp_state.set('consultant_id', authResult.consultant_id);
        mmlfcp_state.set('ga_id', authResult.ga_id);
        mmlfcp_state.set('upload_date', authResult.upload_date);

        // ⭐ [추가] ga_id가 저장된 후, cust_name의 기본값을 판단하고 반영합니다.
        const defaultCustName = mmlfcp_state.initCustName();
        const custNameInput = document.getElementById('cust_name');
        if (custNameInput) {
            custNameInput.value = defaultCustName; // HTML 인풋 값 변경
            custNameInput.readOnly = (authResult.ga_id === 'A210');
        }

        // ⭐ 추가: URL에서 받은 path 값을 state에 저장
        if (path) {
            mmlfcp_state.set('url_path', path);
        }
        else {
            mmlfcp_state.set('url_path', 'lifefire');
        }

        //localstorage 일부 제거
        Controller.resetBeforeSearch();

        // GA별 브랜드 테마 (A242 → #ff9b00, 그 외 → 기본 테마)
        try {
            window.mmlfcpUiSettings?.applyGaBrandTheme?.(authResult.ga_id);
        } catch (_) { /* ignore */ }

        // 5. ✅ 컨트롤러 초기화 호출
        Controller.init();

        //6. 최초 실행 시 조회 함수 호출
        Controller.onClickSearch();


    } catch (err) {
        console.error("[최초 실행 시 오류]", err);
        showAuthFailure(err?.message || '초기화 중 오류가 발생했습니다.');
        return;
    }
});