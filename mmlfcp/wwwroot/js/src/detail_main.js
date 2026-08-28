// detail_main.js
import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { detailController } from './components/detailcontroller.js?v=26.07.21.04';
import { bindDetailTabs, applyDetailTabVisibility, goDetailTab } from './utils/detailTabs.js';

// 파일 최상단에 변수 하나 선언
let isApiCalled = false;
document.addEventListener("DOMContentLoaded", async () => {

    // ✅ [추가] 이미 API를 호출했거나, 뒤로가기 이벤트가 발생 중이면 종료
    if (isApiCalled) return;

    try {
        detailController.setLoading(true);

        // 1. 토큰 확보 후 주소창에서 숨김
        const token = app.captureAuthToken();
        if (!token) {
            alert("접속 토큰이 존재하지 않습니다.");
            detailController.setLoading(false);
            return;
        }

        // 2. 전역 appConstants에 토큰 저장
        appConstants.jwt = token;
        appConstants.access_path = "MMLFCP_WEB_DETAIL";

        isApiCalled = true; // 호출 시작할 때 true로 변경

        const urlTab = new URLSearchParams(location.search).get('tab') || 'premium';
        // 상품유형별은 별도 페이지로 이동
        if (urlTab === 'simplifi') {
            goDetailTab('simplifi');
            return;
        }
        bindDetailTabs(urlTab);
        applyDetailTabVisibility({
            planTypeId: localStorage.getItem('plan_type_id'),
            planPaymentExpirationName: localStorage.getItem('plan_payment_expiration_name'),
        });

        // 3. 인증 요청
        const authResult = await apiService.auth();
        if (!authResult.is_success) {
            console.error("인증 실패:", authResult.error_message);
            detailController.setLoading(false);
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set("mmlfcp_plans_detail", authResult.plans);

        // 5. 상세 컨트롤러 초기화 (내부에서 로딩 표시)
        await detailController.init();

    } catch (err) {
        isApiCalled = false; // 에러나면 다시 호출 가능하게 리셋
        console.error("[연령별/만기별 보험료 최초 조회 시 오류]", err.code);
        detailController.setLoading(false);
        alert(err.message);
        return;
    }
});