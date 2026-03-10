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
    if (!res.ok || data?.is_success == false) {
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

    /**
    * 플랜 기준 만기별 보험료 조회 (GET)
    * /api/PaytermCoveragePremiums?plan_id=...&age=...&gender=...
    */
    async getPaytermCoveragePremiums({ plan_id, plan_type, plan_payterm_type, age, gender }) {
        const query = new URLSearchParams({
            plan_id: String(plan_id ?? ''),
            plan_type: String(plan_type ?? ''),
            plan_payterm_type: String(plan_payterm_type ?? ''),
            age: String(age ?? ''),
            gender: String(gender ?? '')
        }).toString();

        const url = `${BASE_URL}${API_MMLFCP_URL.API_PAYTERM_PRODUCT_PREMIUMS}?${query}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders()
        });
        return handleResponse(res);
    },

    /**
    * 무해지 및 간편보험료 조회 (GET)
    * /api/PlanCoveragePremiumComparison?plan_id=...&age=...&gender=...
    */
    async getPlanCoveragePremiumsComparison({ plan_id, plan_type, plan_payterm_type, age, gender }) {
        const query = new URLSearchParams({
            plan_id: String(plan_id ?? ''),
            plan_type: String(plan_type ?? ''),
            plan_payterm_type: String(plan_payterm_type ?? ''),
            age: String(age ?? ''),
            gender: String(gender ?? '')
        }).toString();

        const url = `${BASE_URL}${API_MMLFCP_URL.API_PLAN_COVERAGE_COMPARISON}?${query}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders()
        });
        return handleResponse(res);
    },

    /**
    * 플랜 연령별 보험료 조회 (GET)
    * /api/ProductPremiumsByAges?plan_id=...&age=...&gender=...
    */
    async getProductPremiumsByAges({ plan_id, age, gender }) {

        // 디버깅용 (토큰 확인)
        //console.log('[API] JWT exists?', !!appConstants.jwt);

        const query = new URLSearchParams({
            plan_id: String(plan_id ?? ''),
            age: String(age ?? ''),
            gender: String(gender ?? '')
        }).toString();

        const url = `${BASE_URL}${API_MMLFCP_URL.API_PRODUCT_PREMIUMS_BY_AGES}?${query}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders()
        });
        return handleResponse(res);
    },



    /*
    플랜별 기준보장, 상품별 담보별, 필수보험료 정보 한장출력
*/
    async PrintProducts({ cust_name, age, gender, birth_date, plan_id, plan_type_id, plan_type_name, plan_payment_expiration_cd, plan_payment_expiration_name, is_required_coverage, company_codes, coverages }) {
        const body = {
            cust_name: String(cust_name ?? ''),
            age: Number(age ?? 0),
            gender: String(gender ?? ''),
            birth_date: String(birth_date ?? ''),

            plan_id: String(plan_id ?? ''),
            plan_type_id: String(plan_type_id ?? ''),
            plan_type_name: String(plan_type_name ?? ''),

            plan_payment_expiration_cd: String(plan_payment_expiration_cd ?? ''),
            plan_payment_expiration_name: String(plan_payment_expiration_name ?? ''),
            is_required_coverage: String(is_required_coverage ?? 'N'),
            company_codes: company_codes || [],
            coverages: coverages || []
        };

        const url = `${BASE_URL}${API_MMLFCP_URL.API_PRINT_PRODUCTS}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...defaultHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        return handleResponse(res);
    },

    /**
     * 사용자 플랜 등록 (POST)
     * @param {Object} userCoverage 
     * 예시: {
     *   user_plan_id: '',
     *   user_plan_name: '내 플랜 이름',
     *   details: [{ coverage_cd: 'C01', coverage_amount: 100000 }]
     * }
     */

    async AddUserCoverages(userCoverage) {
        const url = `${BASE_URL}${API_MMLFCP_URL.API_ADD_USER_COVERAGES}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...defaultHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userCoverage)
        });
        return handleResponse(res);
    },

    /**
     * 사용자 플랜 수정/삭제 (POST)
     * @param {Object} userCoverage 
     * 예시: {
     *   user_plan_id: 'GUID',
     *   user_plan_name: '삭제할 플랜 이름'
     * }
     */
    async UpdateUserCoverages(userCoverage) {
        const url = `${BASE_URL}${API_MMLFCP_URL.API_UPDATE_USER_COVERAGES}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...defaultHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userCoverage)
        });
        return handleResponse(res);
    }


};