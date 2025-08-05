using Dapper;
using Microsoft.Data.SqlClient;
using mmlfcp.Middleware;
using mmlfcp.Models;
using System.Data;

namespace mmlfcp.Repository
{
    public interface IMMLFCPRepository
    {
        //플랜조회
        public Task<IEnumerable<PlanEntity>> GetPlansAsync();

        //플랜별기준보장 데이터 - 화면 왼쪽
        public Task<IEnumerable<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId);

        //플랜 상품별보장별 보험료
        public Task<IEnumerable<CoveragePremiumEntity>> GetProductCoveragePremiumsAsync(
               string planId, string gender, int age);
        //플랜 상품별담보별 보험료 
        public Task<IEnumerable<InsurCDPremiumEntity>> GetProductInsurCDPremiumsAsync(
               string planId, string gender, int age);
        //플랜 연령별 보장별 보험료
        public Task<IEnumerable<CoveragePremiumEntity>> GetCoveragePremiumsByAgesAsync(
                    string planId, string gender, int baseAge
            );
        //필수 보험료 조회
        public Task<IEnumerable<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(
                       string planId, string gender, int age);
    }

    public class MMLFCPRepository : IMMLFCPRepository
    {
        private IConfiguration _config;
        private readonly DapperContext _context;
        private readonly ILogger<MMLFCPRepository> _logger;

        public MMLFCPRepository(DapperContext context, ILogger<MMLFCPRepository> logger)
        {

            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<PlanEntity>> GetPlansAsync()
        {
            // SQL 쿼리 (제공해주신 쿼리)
            string sql = @"
            select a.plan_id,a.plan_name,a.plan_type,
                   (select cd_nm from TB_COMM_CD where cd_id = a.plan_type and upp_cd_id = 'MMLFCP_A') as plan_type_name,
                   a.plan_payterm_type,
                   (select cd_nm from TB_COMM_CD where cd_id = a.plan_payterm_type and upp_cd_id = 'MMLFCP_B') as plan_payterm_type_name,
                   a.plan_min_m_age,a.plan_max_m_age,a.plan_min_f_age,a.plan_max_f_age
            from TB_MMLFCP_PLAN a
            where use_yn = 'Y'";

            using (var connection = _context.CreateConnection())
            {
                // Dapper의 QueryAsync를 사용하여 비동기적으로 데이터 조회
                var plans = await connection.QueryAsync<PlanEntity>(sql);
                return plans;
            }
        }

        public async Task<IEnumerable<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId)
        {
            // SQL 쿼리
            string sql = @"
            select 
                a.plan_id, a.coverage_cd, b.coverage_name, a.guide_coverage_amount, a.is_selected_coverage, a.coverage_seq
            from TB_MMLFCP_PLAN_COVERAGE a
            join TB_MMLFCP_COVERAGE b
                on a.coverage_cd = b.coverage_cd
            where 
                a.plan_id = @plan_id
            order by a.coverage_seq";

            using (var connection = _context.CreateConnection())
            {
                // Dapper의 QueryAsync를 사용하여 비동기적으로 데이터 조회
                // @plan_id 파라미터를 사용하기 위해 익명 객체로 전달합니다.
                var coverages = await connection.QueryAsync<PlanCoverageEntity>(sql, new { plan_id = planId });
                return coverages;
            }
        }

        public async Task<IEnumerable<CoveragePremiumEntity>> GetProductCoveragePremiumsAsync(
               string planId, string gender, int age)
        {
            // SQL 쿼리
            string sql = @"
            select a.company_code,e.CD_NM as company_name,
                    a.product_code,d.prdt_name as product_name,d.attr1 as product_detail_name,d.mb_conditions as product_conditions,
	                a.coverage_cd,f.coverage_name,c.is_selected_coverage,c.coverage_seq,
	                a.gender,a.age,
	                c.guide_coverage_amount,
	                case when a.coverage_amount > 0 then 
		            (c.guide_coverage_amount * a.premium) / a.coverage_amount 
	                else 0  end  as guide_coverage_premium,
	                a.coverage_amount,a.premium,
                    isnull((select top 1 coverage_amount_ratio from TB_MMLFCP_AMOUNT_RATIO where a.company_code = company_code and a.product_code = product_code and c.coverage_cd = coverage_cd),1)  as coverage_amount_ratio
            from 
	            TB_MMLFCP_COVERAGE_PRICE a
	            join TB_MMLFCP_PLAN_PRODUCT b
		            on a.company_code = b.company_code
		            and a.product_code = b.product_code
		            and b.plan_id = @plan_id
	            join TB_MMLFCP_PLAN_COVERAGE c
		            on 	a.coverage_cd = c.coverage_cd
		            and c.plan_id = @plan_id
		            and c.use_yn = 'Y'
                join TB_TIC_PRDT  d
	                on a.company_code = d.compy_cd
		            and a.product_code = d.prdt_cd
	            join TB_COMM_CD e
		            on a.company_code = e.CD_ID
		            and e.UPP_CD_ID = 'COMPY'
	            join TB_MMLFCP_COVERAGE f
	                on a.coverage_cd = f.coverage_cd
            where 
	            a.gender = @gender
	            and a.age = @age
            order by e.attr01 desc,a.company_code,c.coverage_seq";

            using (var connection = _context.CreateConnection())
            {
                var premiums = await connection.QueryAsync<CoveragePremiumEntity>(
                    sql,
                    new { plan_id = planId, gender = gender, age = age }
                );
                return premiums;
            }
        }


        public async Task<IEnumerable<InsurCDPremiumEntity>> GetProductInsurCDPremiumsAsync(
               string planId, string gender, int age)
        {
            // SQL 쿼리
            string sql = @"
            select a.compy_cd as company_code,
                   a.prdt_cd as product_code,c.prdt_name as product_name,c.attr1 as product_detail_name,c.mb_conditions as product_conditions,c.pay_term,
                   e.coverage_cd,
                   a.sex as gender,a.age,
                   a.insur_cd,d.insur_nm,d.insur_bojang,
                   a.std_contract_amt as contract_amount,
                   a.premium
            from 
                TB_TIC_PRDT_PRICE a
                join TB_MMLFCP_PLAN_PRODUCT b
                    on a.compy_cd = b.company_code
                    and a.prdt_cd = b.product_code
                    and b.plan_id = @plan_id
                join TB_TIC_PRDT c
                    on a.compy_cd = c.compy_cd
                    and a.prdt_cd = c.prdt_cd
                join TB_TIC_PRDT_D d
                    on a.compy_cd = d.compy_cd
                    and a.prdt_cd = d.prdt_cd
                    and a.insur_cd = d.insur_cd
                join (
                    select a.coverage_cd, b.insur_cd
                    from TB_MMLFCP_PLAN_COVERAGE a
                    join TB_MMLFCP_COVERAGE_INSUR_MAPPING b
                        on a.coverage_cd = b.coverage_cd
                    where a.plan_id = @plan_id -- 서브쿼리에도 plan_id 파라미터 전달
                    and a.use_yn = 'Y'
                ) e
                on a.insur_cd = e.insur_cd
            where 
                a.sex = @gender
                and a.age = @age
            order by a.compy_cd, e.coverage_cd, a.insur_cd";

            using (var connection = _context.CreateConnection())
            {
                var premiums = await connection.QueryAsync<InsurCDPremiumEntity>(
                    sql,
                    new { plan_id = planId, gender = gender, age = age }
                );
                return premiums;
            }
        }

        public async Task<IEnumerable<CoveragePremiumEntity>> GetCoveragePremiumsByAgesAsync(
            string planId, string gender, int baseAge)
        {
            // SQL 쿼리
            // IN 절에 파라미터를 동적으로 바인딩하기 위해 Dapper의 Multi-parameter IN을 활용합니다.
            // @ages_in_clause 라는 플레이스홀더를 사용하고 실제 값은 컬렉션으로 전달합니다.
            string sql = @"
            select a.company_code,e.CD_NM as company_name,
                   a.product_code,d.prdt_name as product_name,d.attr1 as product_detail_name,d.mb_conditions as product_conditions,
                   a.coverage_cd,f.coverage_name,c.is_selected_coverage,c.coverage_seq,
                   a.gender,a.age,
                   c.guide_coverage_amount,
                   case when a.coverage_amount > 0 then 
                   (c.guide_coverage_amount * a.premium) / a.coverage_amount
                   else 0 end as guide_coverage_premium,
                   a.coverage_amount,a.premium,
                   isnull((select top 1 coverage_amount_ratio from TB_MMLFCP_AMOUNT_RATIO where a.company_code = company_code and a.product_code = product_code and c.coverage_cd = coverage_cd),1) as coverage_amount_ratio
            from 
                TB_MMLFCP_COVERAGE_PRICE a
                join TB_MMLFCP_PLAN_PRODUCT b
                    on a.company_code = b.company_code
                    and a.product_code = b.product_code
                    and b.plan_id = @plan_id
                join TB_MMLFCP_PLAN_COVERAGE c
                    on  a.coverage_cd = c.coverage_cd
                    and c.plan_id = @plan_id
                    and c.use_yn = 'Y'
                join TB_TIC_PRDT d
                    on a.company_code = d.compy_cd
                    and a.product_code = d.prdt_cd
                join TB_COMM_CD e
                    on a.company_code = e.CD_ID
                    and e.UPP_CD_ID = 'COMPY'
                join TB_MMLFCP_COVERAGE f
                    on a.coverage_cd = f.coverage_cd
            where 1=1
                and a.age in @ages_in_clause -- Dapper가 컬렉션을 IN 절로 자동 확장
                and a.gender = @gender
            order by a.company_code,a.product_code,a.age,c.coverage_seq";

            using (var connection = _context.CreateConnection())
            {
                // IN 절에 사용할 연령 리스트 생성
                var agesToQuery = new List<int>
                {
                    baseAge,
                    baseAge + 1,
                    baseAge + 2,
                    baseAge + 5,
                    baseAge + 10
                };

                // Dapper의 QueryAsync를 사용하여 비동기적으로 데이터 조회
                // 파라미터를 익명 객체로 전달합니다. @ages_in_clause는 agesToQuery 리스트로 매핑됩니다.
                var premiums = await connection.QueryAsync<CoveragePremiumEntity>(
                    sql,
                    new { plan_id = planId, gender = gender, ages_in_clause = agesToQuery }
                );
                return premiums;
            }
        }

        public async Task<IEnumerable<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(
               string planId, string gender, int age)
        {
            // SQL query as provided
            string sql = @"
            select a.compy_cd as company_code,
                   a.prdt_cd as product_code,c.prdt_name as product_name,c.attr1 as product_detail_name,c.mb_conditions as product_conditions,c.pay_term,
                   a.sex as gender,a.age,
                   a.insur_cd,d.insur_nm,d.insur_bojang,
                   e.min_insur_amount,
                   case when a.std_contract_amt > 0 then 
                   (e.min_insur_amount * a.premium) / a.std_contract_amt
                   else 0 end as min_premium,
                   a.std_contract_amt as contract_amount,
                   a.premium
            from 
                TB_TIC_PRDT_PRICE a
                join TB_MMLFCP_PLAN_PRODUCT b
                    on a.compy_cd = b.company_code
                    and a.prdt_cd = b.product_code
                    and b.plan_id = @plan_id
                join TB_TIC_PRDT c
                    on a.compy_cd = c.compy_cd
                    and a.prdt_cd = c.prdt_cd
                join TB_TIC_PRDT_D d
                    on a.compy_cd = d.compy_cd
                    and a.prdt_cd = d.prdt_cd
                    and a.insur_cd = d.insur_cd
                join TB_MMLFCP_PRODUCT_REQUIRED_RULES e
                    on a.compy_cd = e.company_code
                    and a.prdt_cd = e.product_code
                    and a.insur_cd = e.insur_cd
            where 
                a.sex = @gender
                and a.age = @age
            order by a.compy_cd,a.prdt_cd,a.insur_cd";

            using (var connection = _context.CreateConnection())
            {
                // Execute the query asynchronously with parameters
                var premiums = await connection.QueryAsync<RequiredInsurCDPremiumEntity>(
                    sql,
                    new { plan_id = planId, gender = gender, age = age }
                );
                return premiums;
            }
        }
    }

}
