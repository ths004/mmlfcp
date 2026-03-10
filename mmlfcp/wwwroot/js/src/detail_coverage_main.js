// detail_coverage_main.js
import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { detailSimplController } from './components/detailsimplcontroller.js';

// 파일 최상단에 변수 하나 선언
let isApiCalled = false;

document.addEventListener("DOMContentLoaded", async () => {
    try {

        // ✅ [추가] 이미 API를 호출했거나, 뒤로가기 이벤트가 발생 중이면 종료
        if (isApiCalled) return;

        // 1. URL에서 token 파라미터 추출
        const token = app.getUrlParameter("token");
        if (!token) {
            alert("접속 토큰이 존재하지 않습니다.");
            return;
        }

        // 2. 전역 appConstants에 토큰 저장
        appConstants.jwt = token;
        appConstants.access_path = "MMLFCP_WEB_SIMPLIFICATION_DETAIL";

        isApiCalled = true;

        // 3. 인증 요청
        const authResult = await apiService.auth();
        if (!authResult.is_success) {
            console.error("인증 실패:", authResult.error_message);
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set("mmlfcp_simplifi_plans", authResult.plans);

        // 5. 상세 컨트롤러 초기화
        detailSimplController.init();


    } catch (err) {
        isApiCalled = false; // 에러나면 다시 호출 가능하게 리셋
        console.error("[Detail Coverage Init 오류]", err);
        alert("무해지 및 간편보험료 초기화 중 오류가 발생했습니다.");
    }
});