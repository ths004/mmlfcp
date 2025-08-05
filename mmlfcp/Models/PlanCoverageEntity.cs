namespace mmlfcp.Models
{
    public class PlanCoverageEntity
    {
        public string plan_id { get; set; }
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; } // 조인된 테이블의 coverage_name
        public float guide_coverage_amount { get; set; } 
        public string is_selected_coverage { get; set; } // Y/N 
        public int coverage_seq { get; set; }
    }
}
