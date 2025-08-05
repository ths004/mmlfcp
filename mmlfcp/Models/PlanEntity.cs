namespace mmlfcp.Models
{
    public class PlanEntity
    {
        public string plan_id { get; set; }
        public string plan_name { get; set; }
        public string plan_type { get; set; }
        public string plan_type_name { get; set; } // AS 별칭과 동일하게
        public string plan_payterm_type { get; set; }
        public string plan_payterm_type_name { get; set; } // AS 별칭과 동일하게
        public int plan_min_m_age { get; set; }
        public int plan_max_m_age { get; set; }
        public int plan_min_f_age { get; set; }
        public int plan_max_f_age { get; set; }
    }
}
