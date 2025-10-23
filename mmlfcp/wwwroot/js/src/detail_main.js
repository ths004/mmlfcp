// detail_main.js
import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js';
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { detailController } from './components/detailcontroller.js';

document.addEventListener("DOMContentLoaded", async () => {
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

        // 3. 인증 요청
        const authResult = await apiService.auth();
        if (!authResult.is_success) {
            console.error("인증 실패:", authResult.error_message);
            return;
        }

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set("mmlfcp_plans", authResult.plans);

        // 5. 상세 컨트롤러 초기화
        detailController.init();


    } catch (err) {
        console.error("[Detail Init 오류]", err);
        alert("상세 초기화 중 오류가 발생했습니다.");
    }
});