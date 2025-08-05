namespace mmlfcp.Models
{
    // 공통 응답 모델
    public class ApiResponse<T>
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public T? data { get; set; }
    }

    // 사용자 인증 응답 모델
    public class AuthResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<PlanEntity> plans { get; set; } = new List<PlanEntity>();
    }

    // 플랜 기준 상품 보험료 조회 응답 모델
    public class ProductPremiumsResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<PlanCoverageEntity> plan_coverages { get; set; } = new List<PlanCoverageEntity>();
        public List<InsurCDPremiumEntity> product_insur_premiums { get; set; } = new List<InsurCDPremiumEntity>();
        public List<RequiredInsurCDPremiumEntity> required_premiums { get; set; } = new List<RequiredInsurCDPremiumEntity>();
    }

    // 플랜 연령별 보험료 조회 응답 모델
    public class ProductPremiumsByAgesResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<CoveragePremiumEntity> coverage_premiums_by_ages { get; set; } = new List<CoveragePremiumEntity>();
    }
}