namespace mmlfcp.Models
{
    public class CoveragePremiumEntity
    {
        public string company_code { get; set; }
        public string company_name { get; set; } // e.CD_NM
        public string product_code { get; set; }
        public string product_name { get; set; } 
        public string product_detail_name { get; set; } // d.attr1
        public string product_conditions { get; set; } // d.mb_conditions
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; } // f.coverage_name
        public string is_selected_coverage { get; set; } //Y/N
        public int coverage_seq { get; set; } // c.coverage_seq
        public string gender { get; set; }
        public int age { get; set; }
        public float guide_coverage_amount { get; set; } 
        public float guide_coverage_premium { get; set; } 
        public float coverage_amount { get; set; } // a.coverage_amount
        public float premium { get; set; } // a.premium
        public float coverage_amount_ratio { get; set; }
    }
}
