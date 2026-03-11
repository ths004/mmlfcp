// detail_main.js
import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { detailController } from './components/detailcontroller.js';

// 파일 최상단에 변수 하나 선언
let isApiCalled = false;
document.addEventListener("DOMContentLoaded", async () => {

    // ✅ [추가] 이미 API를 호출했거나, 뒤로가기 이벤트가 발생 중이면 종료
    if (isApiCalled) return;

    try {
        // 1. URL에서 token 파라미터 추출
        const token = app.getUrlParameter("token");
        if (!token) {
            alert("접속 토큰이 존재하지 않습니다.");
            return;
        }

        // 2. 전역 appConstants에 토큰 저장
        appConstants.jwt = token;
        appConstants.access_path = "MMLFCP_WEB_DETAIL";

        isApiCalled = true; // 호출 시작할 때 true로 변경

        // 3. 인증 요청
        const authResult = await apiService.auth();
        if (!authResult.is_success) {
            console.error("인증 실패:", authResult.error_message);
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set("mmlfcp_plans_detail", authResult.plans);

        // 5. 상세 컨트롤러 초기화
        detailController.init();

    } catch (err) {
        isApiCalled = false; // 에러나면 다시 호출 가능하게 리셋
        console.error("[연령별/만기별 보험료 최초 조회 시 오류]", err.code);
        alert(err.message);
        return;
    }
});