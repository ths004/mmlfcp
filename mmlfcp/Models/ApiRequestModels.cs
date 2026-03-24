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

        public String ga_id { get; set; }
        public String consultant_id { get; set; }

        public List<PlanEntity> plans { get; set; } = new List<PlanEntity>();
        public UploadDateEntity upload_date { get; set; } 
    }

    // 플랜 기준 상품 보험료 조회 응답 모델
    public class ProductPremiumsResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<PlanCoverageEntity> plan_coverages { get; set; } = new List<PlanCoverageEntity>();

        public List<CoverageProductDto> coverage_premiums { get; set; } = new List<CoverageProductDto>();

        public List<InsurProductDto> product_insur_premiums { get; set; } = new List<InsurProductDto>();
        public List<RequiredInsurCDPremiumEntity> required_premiums { get; set; } = new List<RequiredInsurCDPremiumEntity>();

        public List<UserCoverage> user_coverages { get; set; } = new List<UserCoverage>();
    }



    // 플랜 연령별 보험료 조회 응답 모델
    public class ProductPremiumsByAgesResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<CoverageProductDto> coverage_premiums_by_ages { get; set; } = new List<CoverageProductDto>();

        public List<RequiredInsurGrouped> coverage_required_premiums_by_ages { get; set; } = new List<RequiredInsurGrouped>();
    }

    //플랜 만기별 보혐료 조회 응답 모델
    public class ProductPaytermPremiumsByAgesResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;

        public List<PaytermCoveragePremiumGroup> payterm_coverage_premiums { get; set; } = new List<PaytermCoveragePremiumGroup>();
        public List<RequiredInsurCDPremiumEntity> payterm_required_coverage_premiums { get; set; } = new List<RequiredInsurCDPremiumEntity>();
        
    }


    //무해지 및 간편보험료 조회 응답 모델
    public class SimplifiedPremiumResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;

        public List<PaytermCoveragePremiumGroup> simplified_coverage_premiums { get; set; } = new List<PaytermCoveragePremiumGroup>();

        public List<InsurProductDto> simplified_coverage_insur_premiums { get; set; } = new List<InsurProductDto>();

        public List<RequiredInsurCDPremiumEntity> simplified_required_coverage_premiums { get; set; } = new List<RequiredInsurCDPremiumEntity>();
    }



    public class PrintProductsResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; }

        public string pdf_uri { get; set; }

    }    
}