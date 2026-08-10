import { app } from './utils/app.js';
import { appConstants } from './constants/constants.js'
import { apiService } from './services/apiService.js';
import { mmlfcp_state, _state } from './core/state.js';
import { Controller } from './components/controller.js?v=26.07.23.2';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        //1. URL에서 token 파라미터 추출
        const token = app.getUrlParameter("token");
        const path = app.getUrlParameter("path"); // ⭐ 생손보(lifefire / fire) 파라미터 추출 추가
        const device = app.getUrlParameter("device"); //APP, WEB 구분
        if (!token) {
            alert('접속 토큰이 존재하지 않습니다.');
            return;
        }

        //2. 전역 appConstants 에 토큰과 접근경로 저장
        appConstants.jwt = token;
        appConstants.access_path = 'MMLFCP_WEB';
        appConstants.device = device || "APP";

        // 3. 인증 요청
        const authResult = await apiService.auth();

        if (!authResult.is_success) {
            console.log(`인증 실패: ${authResult.error_message}`);
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
        const finalPath = (authResult.ga_id === 'A266') ? 'fire' : (path || 'lifefire');
        mmlfcp_state.set('url_path', finalPath);


        //localstorage 일부 제거
        Controller.resetBeforeSearch();

        // 5. ✅ 컨트롤러 초기화 호출
        Controller.init();

        //6. 최초 실행 시 조회 함수 호출
        Controller.onClickSearch();


    } catch (err) {
        console.error("[최초 실행 시 오류]", err);
        alert(err.message);
        return;
    }
});