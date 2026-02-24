export const BASE_URL = "/";
export const MMLFCP_URL = "/html/index.html";


export const API_MMLFCP_URL = {
    API_AUTH: "api/Auth",
    API_PRODUCT_PREMIUMS: "api/ProductPremiums", //플랜기준 상품 보험료 조회
    API_PRODUCT_PREMIUMS_BY_AGES: "api/ProductPremiumsByAges", //플랜 연령별 보험료 조회
    API_PAYTERM_PRODUCT_PREMIUMS: "api/PaytermCoveragePremiums", //플랜기준 만기별 보험료 조회
    API_PRINT_PRODUCTS: "api/PrintProducts", // 플랜별 기준보장, 상품별 담보별, 필수보험료 정보 한장출력
    API_ADD_USER_COVERAGES: "api/AddUserCoverages", //사용자 플랜 추가
    API_UPDATE_USER_COVERAGES: "api/UpdateUserCoverages" //사용자 플랜 수정

};


export const appConstants = {
    jwt: '',
    access_path: '',
};