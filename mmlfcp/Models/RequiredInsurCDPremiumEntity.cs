namespace mmlfcp.Models
{
    public class RequiredInsurCDPremiumEntity
    {
        public string company_code { get; set; } // a.compy_cd
        public string product_code { get; set; } // a.prdt_cd
        public string product_name { get; set; } // c.prdt_name
        public string product_detail_name { get; set; } // c.attr1
        public string product_conditions { get; set; } // c.mb_conditions
        public string pay_term { get; set; } // c.pay_term
        public string gender { get; set; } // a.sex
        public int age { get; set; } // a.age
        public string insur_cd { get; set; } // a.insur_cd
        public string insur_nm { get; set; } // d.insur_nm
        public string insur_bojang { get; set; } // d.insur_bojang
        public float min_insur_amount { get; set; } // e.min_insur_amount
        public float min_premium { get; set; } // Calculated field (CASE WHEN)
        public float contract_amount { get; set; } // a.std_contract_amt
        public float premium { get; set; } // a.premium
    }
}
