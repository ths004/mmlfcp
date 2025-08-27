import { BASE_URL, API_MMLFCP_URL, appConstants } from '../constants/constants.js';

const defaultHeaders = () => {
    const headers = {};

    if (appConstants.jwt) {
        headers['Authorization'] = `Bearer ${appConstants.jwt}`;
    }
    return headers;
};

/**
 * 공통 응답 처리 함수
 * - 오류 응답시 에러 메시지를 포함한 예외 throw
 */
const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.is_success === false) {
        throw new Error(data?.error_message || `[API] ${res.status}`);
    }
    return data;
};



export const apiService = {
    /**
  * 사용자 인증 (GET 방식)
  * ?token=xxx&access_path=xxx
  */
    async auth() {
        const query = new URLSearchParams({
            token: appConstants.jwt,
            access_path: appConstants.access_path,
        }).toString();

        const url = `${BASE_URL}${API_MMLFCP_URL.API_AUTH}?${query}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders(),
        });

        return handleResponse(res);
    },

    /**
    * 플랜 기준 상품 보험료 조회 (GET)
    * /api/ProductPremiums?plan_id=...&age=...&gender=...
    */
    async getProductPremiums({ plan_id, age, gender }) {

        // 디버깅용 (토큰 확인)
        //console.log('[API] JWT exists?', !!appConstants.jwt);

        const query = new URLSearchParams({
            plan_id: String(plan_id ?? ''),
            age: String(age ?? ''),
            gender: String(gender ?? '')
        }).toString();

        const url = `${BASE_URL}${API_MMLFCP_URL.API_PRODUCT_PREMIUMS}?${query}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders()
        });
        return handleResponse(res);
    },
};