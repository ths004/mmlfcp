namespace mmlfcp.Models
{
    public class InsurCDPremiumEntity
    {
        public string company_code { get; set; } // a.compy_cd
        public string product_code { get; set; } // a.prdt_cd
        public string product_name { get; set; } // c.prdt_name
        public string product_detail_name { get; set; } // c.attr1
        public string product_conditions { get; set; } // c.mb_conditions
        public string pay_term { get; set; } // c.pay_term
        public string coverage_cd { get; set; } // e.coverage_cd (서브쿼리에서 옴)
        public string gender { get; set; } // a.sex
        public int age { get; set; } // a.age
        public string insur_cd { get; set; } // a.insur_cd
        public string insur_nm { get; set; } // d.insur_nm
        public string insur_bojang { get; set; } // d.insur_bojang

        public float guide_contract_amount { get; set; }
        public float guide_premium { get; set; }

        public float contract_amount { get; set; } // a.std_contract_amt
        public float premium { get; set; } // a.premium
    }


    public class InsurProductDto
    {
        public string company_code { get; set; }
        public string product_code { get; set; }
        public string product_name { get; set; }
        public string product_detail_name { get; set; }
        public string product_conditions { get; set; }
      
        public string gender { get; set; }
        public int age { get; set; }

        public List<InsurDetailDto> DetailList { get; set; }
    }

    public class InsurDetailDto
    {
        public string coverage_cd { get; set; }

        public string pay_term { get; set; }

        public string insur_cd { get; set; }
        public string insur_nm { get; set; }
        public string insur_bojang { get; set; }

        public float guide_contract_amount { get; set; }
        public float guide_premium { get; set; }
        public float contract_amount { get; set; }
        public float premium { get; set; }
    }
}
