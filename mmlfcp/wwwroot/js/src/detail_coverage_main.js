// detail_coverage_main.js
import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { detailSimplController } from './components/detailsimplcontroller.js?v=26.07.21.04';
import { bindDetailTabs, applyDetailTabVisibility } from './utils/detailTabs.js';

// 파일 최상단에 변수 하나 선언
let isApiCalled = false;

document.addEventListener("DOMContentLoaded", async () => {
    try {

        // ✅ [추가] 이미 API를 호출했거나, 뒤로가기 이벤트가 발생 중이면 종료
        if (isApiCalled) return;

        // 1. 토큰 확보 후 주소창에서 숨김
        const token = app.captureAuthToken();
        if (!token) {
            alert("접속 토큰이 존재하지 않습니다.");
            return;
        }

        // 2. 전역 appConstants에 토큰 저장
        appConstants.jwt = token;
        appConstants.access_path = "MMLFCP_WEB_SIMPLIFICATION_DETAIL";

        isApiCalled = true;

        // 상단 탭 (다른 세부화면과 동일) + 상품유형별 active
        bindDetailTabs('simplifi');
        applyDetailTabVisibility({
            planTypeId: localStorage.getItem('plan_type_id'),
            planPaymentExpirationName: localStorage.getItem('plan_payment_expiration_name'),
            forceSimplifi: true,
        });

        // 3. 인증 요청
        const authResult = await apiService.auth();
        if (!authResult.is_success) {
            console.error("인증 실패:", authResult.error_message);
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set("mmlfcp_simplifi_plans", authResult.plans);

        // 5. 상세 컨트롤러 초기화 (내부에서 로딩 표시)
        await detailSimplController.init();

    } catch (err) {
        isApiCalled = false; // 에러나면 다시 호출 가능하게 리셋
        console.error("[상품유형별 보험료 최초 조회 시 오류]", err.code);
        detailSimplController.setLoading(false);
        alert(err.message);
        return;
    }
});