namespace mmlfcp.Models
{
    /// <summary>
    /// 🔹 Dapper Row 매핑 전용 (DB 결과 1행)
    /// 절대 API Response로 직접 사용하지 않음
    /// </summary>
    public class PaytermCoveragePremiumRow
    {
        public string company_code { get; set; }
        public string company_name { get; set; }

        public string product_code { get; set; }
        public string product_name { get; set; }
        public string product_detail_name { get; set; }
        public string product_conditions { get; set; }

        public string plan_payterm_type_name { get; set; }

        public string gender { get; set; }
        public int age { get; set; }

        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }
        public string is_selected_coverage { get; set; }
        public int coverage_seq { get; set; }

        public float guide_coverage_amount { get; set; }
        public float guide_coverage_premium { get; set; }
        public float coverage_amount { get; set; }
        public float premium { get; set; }

        public int plan_payterm_type_seq { get; set; }
    }


    /// <summary>
    /// 🔹 API Response Group
    /// </summary>
    public class PaytermCoveragePremiumGroup
    {
        public string company_code { get; set; }
        public string company_name { get; set; }

        public string product_code { get; set; }
        public string product_name { get; set; }
        public string product_detail_name { get; set; }
        public string product_conditions { get; set; }

        public string plan_payterm_type_name { get; set; }

        public string gender { get; set; }
        public int age { get; set; }

        public List<PaytermCoveragePremiumDetail> DetailList { get; set; }
            = new();
    }


    /// <summary>
    /// 🔹 Coverage Detail
    /// </summary>
    public class PaytermCoveragePremiumDetail
    {
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }
        public string is_selected_coverage { get; set; }

        public int coverage_seq { get; set; }

        public float guide_coverage_amount { get; set; }
        public float guide_coverage_premium { get; set; }
        public float coverage_amount { get; set; }
        public float premium { get; set; }

        public int plan_payterm_type_seq { get; set; }
    }
}
