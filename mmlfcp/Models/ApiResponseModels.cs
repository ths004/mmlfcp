
using System.Data;

namespace mmlfcp.Models
{
    // 공통 응답 모델
    public class ApiRequest<T>
    {
        public T? data { get; set; }
    }


    // 플랜 연령별 보험료 조회 응답 모델
    public class PrintProductsRequest
    {

        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;
        public List<PlanCoverageEntity> plan_coverages { get; set; } = new List<PlanCoverageEntity>();

        public List<CoveragePremiumEntity> coverage_premiums { get; set; } = new List<CoveragePremiumEntity>();

        public List<InsurCDPremiumEntity> product_insur_premiums { get; set; } = new List<InsurCDPremiumEntity>();
        public List<RequiredInsurCDPremiumEntity> required_premiums { get; set; } = new List<RequiredInsurCDPremiumEntity>();

        public String cust_name { get; set; }

        public int   age { get; set; }

        public String gender { get; set; }

        public String birth_date { get; set; }

        public String plan_id { get; set; }

        public String plan_type_id { get; set; }

        public String plan_type_name { get; set; }

        public String plan_payment_expiration_cd { get; set; }

        public String plan_payment_expiration_name { get; set; }

        public string is_required_coverage { get; set; }

        public List<String>? company_codes { get; set; }  //선택된 회사

        public List<PrintCoverage>? coverages { get; set; }      //선택된 보장


        public DataTable CoverageToDataTable()
        {
            DataTable table = new DataTable();
            table.Columns.Add("coverage_cd", typeof(string));
            table.Columns.Add("coverage_amount", typeof(int));

            if (this.coverages != null)
            {
                foreach (PrintCoverage detail in this.coverages)
                {
                    table.Rows.Add(detail.coverage_cd, detail.coverage_amount);
                }
            }

            return table;
        }

        public DataTable CompanyToDataTable()
        {
            int seq = 0;
            DataTable table = new DataTable();
            table.Columns.Add("company_code", typeof(string));
            table.Columns.Add("seq", typeof(int));
            if (this.company_codes != null)
            {
                foreach (String detail in this.company_codes)
                {
                    table.Rows.Add(detail, seq);
                    seq = seq + 1;
                }
            }
            return table;
        }

    }

    public class PrintCoverage
    {
        public string coverage_cd { get; set; }
        public string coverage_name { get; set; }

        public float coverage_amount { get; set; }
    }


}