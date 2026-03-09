namespace mmlfcp.Models
{

    public class CoverageProductDto
    {
        public string company_code { get; set; }
        public string company_name { get; set; }
        public string product_code { get; set; }
        public string product_name { get; set; }
        public string product_detail_name { get; set; }
        public string product_conditions { get; set; }
        public string gender { get; set; }
        public int age { get; set; }
        public List<CoverageDetailDto> DetailList { get; set; }
    }

    public class CoverageProductByAgeDto
    {
        public string company_code { get; set; }
        public string company_name { get; set; }
        public string product_code { get; set; }
        public string product_name { get; set; }
        public string product_detail_name { get; set; }
        public string product_conditions { get; set; }
        public string gender { get; set; }
        public List<CoverageProductDto> AgeList { get; set; }
    }


    public class CoverageDetailDto
    {
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }
        public string is_selected_coverage { get; set; }
        public int coverage_seq { get; set; }

        public float guide_coverage_amount { get; set; }
        public float guide_coverage_premium { get; set; }
        public float coverage_amount { get; set; }
        public float premium { get; set; }
        public float coverage_amount_ratio { get; set; }
     
    }

   


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

    public class ProductCoverage
    {
        public string company_code { get; set; }
        public string company_name { get; set; } // e.CD_NM
        public string product_code { get; set; }
        public string product_name { get; set; }

        public List<CoveragePremium> Coverages { get; set; }
    }

    public class CoveragePremium
    {
        public string coverage_cd { get; set; }

        public string is_required_coverage { get; set; }    //필수담보여부 Y,N

        public float guide_coverage_amount { get; set; }
        public float guide_coverage_premium { get; set; }
        public float coverage_amount { get; set; } // a.coverage_amount
        public float premium { get; set; } // a.premium
    }

    public class ExceptionCompanyEntity
    {
        public string ga_id { get; set; }
        public string company_code { get; set; } 

    }

    public class PrintProductCoverage
    {
        public string plan_type { get; set; }
        public string plan_type_name { get; set; }
        public string plan_payterm_type { get; set; }
        public string plan_payterm_type_name { get; set; }

        public string company_code { get; set; }
        public string company_name { get; set; } // e.CD_NM
        public string product_code { get; set; }
        public string product_name { get; set; }

        public float total_premium { get; set; } = 0;// 합계보험료

        public Dictionary<string,PrintCoveragePremium>? Coverages  { get; set; }  //key coverage_cd


        public List<PrintProductByInAge> printProductByInAges { get; set; } = new List<PrintProductByInAge>();


        public void calculateTotalPremium()
        {
            this.total_premium = 0;
            if (Coverages != null)
            {
                foreach (var coverage in Coverages.Values)
                {
                    total_premium +=(float)Math.Round(coverage.plan_coverage_premium);
                }
            }
        }
    }

    public class PrintCoveragePremium
    {
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }
        public int coverage_seq { get; set; }
 
        public float plan_coverage_amount { get; set; }
        public float plan_coverage_premium { get; set; }
        public float coverage_amount { get; set; } // a.coverage_amount
        public float premium { get; set; } // a.premium
    }

    public class PrintProductByInAge
    {
        public String company_code { get; set; }
        public String product_code { get; set; }
        public String product_name { get; set; }
        public int insu_age { get; set; }
        public long premium { get; set; }
    }

    public class PrintRawCoverageData
    {
        public string plan_type { get; set; }
        public string plan_type_name { get; set; }
        public string plan_payterm_type { get; set; }
        public string plan_payterm_type_name { get; set; }

        public string company_code { get; set; }
        public string company_name { get; set; }
        public string product_code { get; set; }
        public string product_name { get; set; }
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }
        public string coverage_seq { get; set; }
        public float plan_coverage_amount { get; set; }
        public float plan_coverage_premium { get; set; }
        public float coverage_amount { get; set; }
        public float premium { get; set; }
    }

}
