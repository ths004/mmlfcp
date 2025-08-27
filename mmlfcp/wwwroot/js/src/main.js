import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js'
import { apiService } from './services/apiService.js';
import { mmlfcp_state } from './core/state.js';
import { Controller } from './components/controller.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        //1. URL에서 token 파라미터 추출
        const token = app.getUrlParameter("token");
        if (!token) {
            alert('접속 토큰이 존재하지 않습니다.');
            return;
        }

        //2. 전역 appConstants 에 토큰과 접근경로 저장
        appConstants.jwt = token;
        appConstants.access_path = 'MMLFCP_WEB';

        // console.log('[Init] JWT:', appConstants.jwt);
        // console.log('[Init] ACCESS PATH:', appConstants.access_path);

        // 3. 인증 요청
        const authResult = await apiService.auth();

        if (!authResult.is_success) {
            console.log(`인증 실패: ${authResult.error_message}`);
            return;
        }
        // console.log('[Auth 성공] plans:', authResult.plans);

        // ✅ 4. plans를 상태에 저장
        mmlfcp_state.set('mmlfcp_plans', authResult.plans);

        // 디버깅용 확인
        mmlfcp_state.debug();

        // 5. ✅ 컨트롤러 초기화 호출
        Controller.init();

        //6. 최초 실행 시 조회 함수 호출
        Controller.onClickSearch();


    } catch (err) {
        console.log('[Init 오류]', err);
        alert('초기화 중 오류가 발생했습니다.');
    }
});