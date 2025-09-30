using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using mmlfcp.Middleware;
using mmlfcp.Models;
using System.Data;

namespace mmlfcp.Repository
{
    public interface IMMLFCPRepository
    {

        
        public Task<IEnumerable<ExceptionCompanyEntity>> GetExcpCompanysAsync(string ga_id);

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

        //플랜 연령별 필수 보험료 조회
        //GetRequiredInsurCDPremiumsByAgesAsync
        public Task<IEnumerable<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsByAgesAsync(
                   string planId, string gender, int age
           );


        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsAsync(
               PrintProductsRequest request);

        public  Task<Boolean> SaveAccesslog(String agency_company_cd, String consultant_id, string ipaddr, string plan_id, string gender, int age);

        public  Task<Boolean> SaveEventlog(String agency_company_cd, String consultant_id, string event_id);
    }

    public class MMLFCPRepository : IMMLFCPRepository
    {
        private readonly DapperContext _context;
        private readonly ILogger<MMLFCPRepository> _logger;

        // 캐시 필드
        private IEnumerable<PlanEntity>? _cachedPlans;
        private Dictionary<string, IEnumerable<PlanCoverageEntity>>? _cachedCoverages;
        private Dictionary<string, IEnumerable<ExceptionCompanyEntity>>? _cachedExpCompanys;

        // 복합 키로 캐싱
        private Dictionary<PremiumCacheKey, IEnumerable<CoveragePremiumEntity>>? _cachedProductCoveragePremiums;
        private Dictionary<PremiumCacheKey, IEnumerable<InsurCDPremiumEntity>>? _cachedProductInsurCDPremiums;
        private Dictionary<PremiumCacheKey, IEnumerable<RequiredInsurCDPremiumEntity>>? _cachedRequiredInsurCDPremiums;
        private Dictionary<AgePremiumCacheKey, IEnumerable<CoveragePremiumEntity>>? _cachedCoveragePremiumsByAges;
        private Dictionary<AgePremiumCacheKey, IEnumerable<RequiredInsurCDPremiumEntity>>? _cachedRequiredInsurCDPremiumsByAges;

        // 락 객체
        private readonly SemaphoreSlim _planLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _excpCompanyLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _coverageLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _productCoveragePremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _productInsurCDPremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _requiredInsurCDPremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _coveragePremiumsByAgesLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _requiredInsurCDPremiumsByAgesLock = new SemaphoreSlim(1, 1);



        public MMLFCPRepository(DapperContext context, ILogger<MMLFCPRepository> logger)
        {
            _context = context;
            _logger = logger;

            // Dictionary 초기화
            _cachedProductCoveragePremiums = new Dictionary<PremiumCacheKey, IEnumerable<CoveragePremiumEntity>>();
            _cachedProductInsurCDPremiums = new Dictionary<PremiumCacheKey, IEnumerable<InsurCDPremiumEntity>>();
            _cachedRequiredInsurCDPremiums = new Dictionary<PremiumCacheKey, IEnumerable<RequiredInsurCDPremiumEntity>>();
            _cachedCoveragePremiumsByAges = new Dictionary<AgePremiumCacheKey, IEnumerable<CoveragePremiumEntity>>();
            _cachedRequiredInsurCDPremiumsByAges = new Dictionary<AgePremiumCacheKey, IEnumerable<RequiredInsurCDPremiumEntity>>();

        }

        // 캐시 키 클래스
        private class PremiumCacheKey : IEquatable<PremiumCacheKey>
        {
            public string PlanId { get; }
            public string Gender { get; }
            public int Age { get; }

            public PremiumCacheKey(string planId, string gender, int age)
            {
                PlanId = planId;
                Gender = gender;
                Age = age;
            }

            public bool Equals(PremiumCacheKey? other)
            {
                if (other is null) return false;
                return PlanId == other.PlanId && Gender == other.Gender && Age == other.Age;
            }

            public override bool Equals(object? obj)
            {
                return Equals(obj as PremiumCacheKey);
            }

            public override int GetHashCode()
            {
                return HashCode.Combine(PlanId, Gender, Age);
            }
        }

        private class AgePremiumCacheKey : IEquatable<AgePremiumCacheKey>
        {
            public string PlanId { get; }
            public string Gender { get; }
            public int BaseAge { get; }

            public AgePremiumCacheKey(string planId, string gender, int baseAge)
            {
                PlanId = planId;
                Gender = gender;
                BaseAge = baseAge;
            }

            public bool Equals(AgePremiumCacheKey? other)
            {
                if (other is null) return false;
                return PlanId == other.PlanId && Gender == other.Gender && BaseAge == other.BaseAge;
            }

            public override bool Equals(object? obj)
            {
                return Equals(obj as AgePremiumCacheKey);
            }

            public override int GetHashCode()
            {
                return HashCode.Combine(PlanId, Gender, BaseAge);
            }
        }

        public async Task<IEnumerable<PlanEntity>> GetPlansAsync()
        {
            if (_cachedPlans != null)
            {
                return _cachedPlans;
            }

            await _planLock.WaitAsync();
            try
            {
                if (_cachedPlans != null)
                {
                    return _cachedPlans;
                }

                string sql = @"
                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                SET NOCOUNT ON;
                select a.plan_id,a.plan_name,a.plan_type,
                       (select cd_nm from TB_COMM_CD where cd_id = a.plan_type and upp_cd_id = 'MMLFCP_A') as plan_type_name,
                       a.plan_payterm_type,
                       (select cd_nm from TB_COMM_CD where cd_id = a.plan_payterm_type and upp_cd_id = 'MMLFCP_B') as plan_payterm_type_name,
                       a.plan_min_m_age,a.plan_max_m_age,a.plan_min_f_age,a.plan_max_f_age
                from TB_MMLFCP_PLAN a
                where use_yn = 'Y'
                order by a.plan_type";

                using (var connection = _context.CreateConnection())
                {
                    _cachedPlans = (await connection.QueryAsync<PlanEntity>(sql)).ToList();
                    _logger.LogInformation("Plans loaded and cached: {Count} plans", _cachedPlans.Count());
                    return _cachedPlans;
                }
            }
            finally
            {
                _planLock.Release();
            }


            // SQL 쿼리 (제공해주신 쿼리)
            //string sql = @"
            //SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            //SET NOCOUNT ON;
            //select a.plan_id,a.plan_name,a.plan_type,
            //       (select cd_nm from TB_COMM_CD where cd_id = a.plan_type and upp_cd_id = 'MMLFCP_A') as plan_type_name,
            //       a.plan_payterm_type,
            //       (select cd_nm from TB_COMM_CD where cd_id = a.plan_payterm_type and upp_cd_id = 'MMLFCP_B') as plan_payterm_type_name,
            //       a.plan_min_m_age,a.plan_max_m_age,a.plan_min_f_age,a.plan_max_f_age
            //from TB_MMLFCP_PLAN a
            //where use_yn = 'Y'
            //order by a.plan_type";

            //using (var connection = _context.CreateConnection())
            //{
            //    // Dapper의 QueryAsync를 사용하여 비동기적으로 데이터 조회
            //    var plans = await connection.QueryAsync<PlanEntity>(sql);
            //    return plans;
            //}
        }

        public async Task<IEnumerable<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId)
        {
            if (_cachedCoverages == null)
            {
                await _coverageLock.WaitAsync();
                try
                {
                    if (_cachedCoverages == null)
                    {
                        await LoadAllCoveragesAsync();
                    }
                }
                finally
                {
                    _coverageLock.Release();
                }
            }

            return _cachedCoverages.TryGetValue(planId, out var coverages)
                ? coverages
                : Enumerable.Empty<PlanCoverageEntity>();

            // SQL 쿼리
            //string sql = @"
            //SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            //SET NOCOUNT ON;
            //select 
            //    a.plan_id, a.coverage_cd, b.coverage_name, a.guide_coverage_amount, a.is_selected_coverage, a.coverage_seq
            //from TB_MMLFCP_PLAN_COVERAGE a
            //join TB_MMLFCP_COVERAGE b
            //    on a.coverage_cd = b.coverage_cd
            //where 
            //    a.plan_id = @plan_id
            //    and a.use_yn='Y'
            //order by  a.coverage_seq";

            //using (var connection = _context.CreateConnection())
            //{
            //    // Dapper의 QueryAsync를 사용하여 비동기적으로 데이터 조회
            //    // @plan_id 파라미터를 사용하기 위해 익명 객체로 전달합니다.
            //    var coverages = await connection.QueryAsync<PlanCoverageEntity>(sql, new { plan_id = planId });
            //    return coverages;
            //}
        }
        private async Task LoadAllCoveragesAsync()
        {
            string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select 
                a.plan_id, a.coverage_cd, b.coverage_name, a.guide_coverage_amount, 
                a.is_selected_coverage, a.coverage_seq
            from TB_MMLFCP_PLAN_COVERAGE a
            join TB_MMLFCP_COVERAGE b
                on a.coverage_cd = b.coverage_cd
            where a.use_yn='Y'
            order by a.plan_id, a.coverage_seq";

            using (var connection = _context.CreateConnection())
            {
                var allCoverages = await connection.QueryAsync<PlanCoverageEntity>(sql);

                _cachedCoverages = allCoverages
                    .GroupBy(c => c.plan_id)
                    .ToDictionary(g => g.Key, g => g.AsEnumerable());

                _logger.LogInformation("Coverages loaded and cached: {Count} plans", _cachedCoverages.Count);
            }
        }


        public async Task<IEnumerable<ExceptionCompanyEntity>> GetExcpCompanysAsync(string ga_id)
        {
            if (_cachedExpCompanys == null)
            {
                await _excpCompanyLock.WaitAsync();
                try
                {
                    if (_cachedExpCompanys == null)
                    {
                        await LoadAllExpCompanysAsync();
                    }
                }
                finally
                {
                    _excpCompanyLock.Release();
                }
            }

            return _cachedExpCompanys.TryGetValue(ga_id, out var companys)
                ? companys
                : Enumerable.Empty<ExceptionCompanyEntity>();
   
        }
        private async Task LoadAllExpCompanysAsync()
        {
            string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select ga_id,company_code from tb_mmlfcp_excp_compy";

            using (var connection = _context.CreateConnection())
            {
                var allExpCompanys = await connection.QueryAsync<ExceptionCompanyEntity>(sql);

                _cachedExpCompanys = allExpCompanys
                    .GroupBy(c => c.ga_id)
                    .ToDictionary(g => g.Key, g => g.AsEnumerable());

                _logger.LogInformation("Exception Companys loaded and cached: {Count} companys", _cachedExpCompanys.Count);
            }
        }


        public async Task<IEnumerable<CoveragePremiumEntity>> GetProductCoveragePremiumsAsync(
               string planId, string gender, int age)
        {

            var cacheKey = new PremiumCacheKey(planId, gender, age);

            if (_cachedProductCoveragePremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }
            await _productCoveragePremiumLock.WaitAsync();
            try
            {
                // Double-check
                if (_cachedProductCoveragePremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @"
                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                SET NOCOUNT ON;
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
                order by a.company_code,c.coverage_seq ";

                using (var connection = _context.CreateConnection())
                {
                    var premiums = (await connection.QueryAsync<CoveragePremiumEntity>(
                        sql,
                        new { plan_id = planId, gender = gender, age = age }
                    )).ToList();

                    _cachedProductCoveragePremiums[cacheKey] = premiums;
                    _logger.LogInformation("ProductCoveragePremiums cached for planId={PlanId}, gender={Gender}, age={Age}",
                        planId, gender, age);

                    return premiums;
                }
            }
            finally
            {
                _productCoveragePremiumLock.Release();
            }
        }


        public async Task<IEnumerable<InsurCDPremiumEntity>> GetProductInsurCDPremiumsAsync(
               string planId, string gender, int age)
        {

            var cacheKey = new PremiumCacheKey(planId, gender, age);

            if (_cachedProductInsurCDPremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }
            await _productInsurCDPremiumLock.WaitAsync();
            try
            {
                if (_cachedProductInsurCDPremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                // SQL 쿼리
                string sql = @"
                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                SET NOCOUNT ON;
                select a.compy_cd as company_code,
                       a.prdt_cd as product_code,
                       c.prdt_name as product_name,
                       c.attr1 as product_detail_name,
                       c.mb_conditions as product_conditions,
                       d.pay_term,
                       e.coverage_cd,
                       a.sex as gender,
                       a.age,
                       a.insur_cd,
                       d.insur_nm,d.
                       insur_bojang,
                       e.contract_amount as guide_contract_amount,
                       case when a.std_contract_amt <= 0 then 0 else (e.contract_amount * a.premium) / a.std_contract_amt end as guide_premium,
                       e.contract_amount,
                      case when a.std_contract_amt <= 0 then 0 else (e.contract_amount * a.premium) / a.std_contract_amt end as premium
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
                        select a.coverage_cd, b.insur_cd, b.guide_insur_amount as contract_amount
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
                    var premiums = (await connection.QueryAsync<InsurCDPremiumEntity>(
                        sql,
                        new { plan_id = planId, gender = gender, age = age }
                    )).ToList();

                    _cachedProductInsurCDPremiums[cacheKey] = premiums;
                    _logger.LogInformation("ProductInsurCDPremiums cached for planId={PlanId}, gender={Gender}, age={Age}",
                        planId, gender, age);

                    return premiums;
                }
            }
            finally
            {
                _productInsurCDPremiumLock.Release();
            }

        }

        public async Task<IEnumerable<CoveragePremiumEntity>> GetCoveragePremiumsByAgesAsync(
            string planId, string gender, int baseAge)
        {
            var cacheKey = new AgePremiumCacheKey(planId, gender, baseAge);

            if (_cachedCoveragePremiumsByAges!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }


            await _coveragePremiumsByAgesLock.WaitAsync();
            try
            {
                if (_cachedCoveragePremiumsByAges.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
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
                    var agesToQuery = new List<int>
                {
                    baseAge,
                    baseAge + 1,
                    baseAge + 2,
                    baseAge + 5,
                    baseAge + 10
                };

                    var premiums = (await connection.QueryAsync<CoveragePremiumEntity>(
                        sql,
                        new { plan_id = planId, gender = gender, ages_in_clause = agesToQuery }
                    )).ToList();

                    _cachedCoveragePremiumsByAges[cacheKey] = premiums;
                    _logger.LogInformation("CoveragePremiumsByAges cached for planId={PlanId}, gender={Gender}, baseAge={BaseAge}",
                        planId, gender, baseAge);

                    return premiums;
                }
            }
            finally
            {
                _coveragePremiumsByAgesLock.Release();
            }
        }

        public async Task<IEnumerable<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(
               string planId, string gender, int age)
        {
            var cacheKey = new PremiumCacheKey(planId, gender, age);

            if (_cachedRequiredInsurCDPremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }
            await _requiredInsurCDPremiumLock.WaitAsync();
            try
            {
                if (_cachedRequiredInsurCDPremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }
                string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select a.compy_cd as company_code,
                   f.CD_NM as company_name,
                   a.prdt_cd as product_code,
                   c.prdt_name as product_name,
                   c.attr1 as product_detail_name,
                   c.mb_conditions as product_conditions,
                   d.pay_term,
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
                join TB_COMM_CD f
                on a.compy_cd = f.CD_ID
                and f.UPP_CD_ID = 'COMPY'
            
                where 
                a.sex = @gender
                and a.age = @age
                and a.use_yn='Y'
            order by a.compy_cd,a.prdt_cd,a.insur_cd";
                using (var connection = _context.CreateConnection())
                {
                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(
                        sql,
                        new { plan_id = planId, gender = gender, age = age }
                    )).ToList();

                    _cachedRequiredInsurCDPremiums[cacheKey] = premiums;
                    _logger.LogInformation("RequiredInsurCDPremiums cached for planId={PlanId}, gender={Gender}, age={Age}",
                        planId, gender, age);

                    return premiums;
                }
            }
            finally
            {
                _requiredInsurCDPremiumLock.Release();
            }

        }

        //연령별 필수 보험료 조회
        public async Task<IEnumerable<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsByAgesAsync(
                string planId, string gender, int age)
        {
            var cacheKey = new AgePremiumCacheKey(planId, gender, age);

            if (_cachedRequiredInsurCDPremiumsByAges!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }

            await _requiredInsurCDPremiumsByAgesLock.WaitAsync();
            try
            {
                if (_cachedRequiredInsurCDPremiumsByAges.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select a.compy_cd as company_code,
                    f.CD_NM as company_name,
                    a.prdt_cd as product_code,
                    c.prdt_name as product_name,
                    c.attr1 as product_detail_name,
                    c.mb_conditions as product_conditions,
                    c.pay_term,
                    a.sex as gender,a.age,
                    a.insur_cd,d.insur_nm,d.insur_bojang,
                    e.min_insur_amount,
                    case when a.std_contract_amt <= 0 then 0 else  (e.min_insur_amount * a.premium) / a.std_contract_amt end as min_premium,
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
                join TB_COMM_CD f
                on a.compy_cd = f.CD_ID
                and f.UPP_CD_ID = 'COMPY'
            
                where 
                a.sex = @gender
                and a.age in @ages_in_clause -- Dapper가 컬렉션을 IN 절로 자동 확장
                and a.use_yn='Y'
            order by a.compy_cd,a.prdt_cd,a.age,a.insur_cd";

                using (var connection = _context.CreateConnection())
                {
                    var agesToQuery = new List<int>
                {
                    age,
                    age + 1,
                    age + 2,
                    age + 5,
                    age + 10
                };

                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(
                        sql,
                        new { plan_id = planId, gender = gender, ages_in_clause = agesToQuery }
                    )).ToList();

                    _cachedRequiredInsurCDPremiumsByAges[cacheKey] = premiums;
                    _logger.LogInformation("RequiredInsurCDPremiumsByAges cached for planId={PlanId}, gender={Gender}, age={Age}",
                        planId, gender, age);

                    return premiums;
                }
            }
            finally
            {
                _requiredInsurCDPremiumsByAgesLock.Release();
            }
        }

        public async Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsAsync(
               PrintProductsRequest request)
        {
            // DataTable 생성
            var coverageDataTable = request.CoverageToDataTable();
            var companyDataTable = request.CompanyToDataTable();

            using (var connection = _context.CreateConnection())
            {
                var rawResults = await connection.QueryAsync<PrintRawCoverageData>(
                    "mmlfcp_get_printdata",
                    new
                    {
                        plan_id = request.plan_id,
                        gender = request.gender,
                        age = request.age,
                        is_required_coverage = request.is_required_coverage,
                        required_coverage_cd = "aa00",
                        required_coverage_name = "필수담보",
                        coverage_table = coverageDataTable,
                        company_table = companyDataTable
                    }
                );

                var groupedResults = rawResults
                        .GroupBy(r => new { r.company_code, r.company_name, r.product_code, r.product_name })
                        .Select(g => new PrintProductCoverage
                        {
                            company_code = g.Key.company_code,
                            company_name = g.Key.company_name,
                            product_code = g.Key.product_code,
                            product_name = g.Key.product_name,
                            Coverages = g.ToDictionary(
                                item => item.coverage_cd,
                                item => new PrintCoveragePremium
                                {
                                    coverage_cd = item.coverage_cd,
                                    coverage_name = item.coverage_name,
                                    coverage_seq = int.TryParse(item.coverage_seq, out int seq) ? seq : 0,
                                    plan_coverage_amount = item.plan_coverage_amount,
                                    plan_coverage_premium = (float)item.plan_coverage_premium,
                                    coverage_amount = item.coverage_amount,
                                    premium = (float)item.premium
                                }
                            )
                        })
                        .ToList();

                return groupedResults;
            }
        }

        public async Task<Boolean> SaveEventlog(String agency_company_cd, String consultant_id, string event_id)
        {
            try
            {
                String qry = @"
                     SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED
                     SET NOCOUNT ON
                        insert into tb_mmlfcp_event_log(consultant_id,ga_id,event_id)   
                                       values (@consultant_id,@ga_id,@event_id) 
                ";
                using (var connection = _context.CreateConnection())
                {
                    await connection.ExecuteAsync(qry,
                            new
                            {
                                consultant_id = consultant_id,
                                ga_id = agency_company_cd,
                                event_id = event_id
                            });
                }


            }
            catch //(Exception e)
            {
                return false;
                //throw new BoKetDataException("3011", "DB 등록 및 수정 중 오류(sm_cust)", "고객 등록 중 오류가 발생하였습니다.");
            }

            return true;
        }

        public async Task<Boolean> SaveAccesslog(String agency_company_cd, String consultant_id, string ipaddr, string plan_id, string gender, int age)
        {
            try
            {
                String qry = @"
                     SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED
                     SET NOCOUNT ON
                        insert into tb_mmlfcp_accesslog(ga_id,consultant_id,ipaddr,plan_id,gender,age)   
                                       values (@ga_id,@consultant_id,@ipaddr,@plan_id,@gender,@age) 
                ";
                using (var connection = _context.CreateConnection())
                {
                    await connection.ExecuteAsync(qry,
                            new
                            {
                                ga_id = agency_company_cd,
                                consultant_id = consultant_id,
                                ipaddr = ipaddr,
                                plan_id = plan_id,
                                gender = gender,
                                age = age
                            });
                }


            }
            catch //(Exception e)
            {
                return false;
                //throw new BoKetDataException("3011", "DB 등록 및 수정 중 오류(sm_cust)", "고객 등록 중 오류가 발생하였습니다.");
            }

            return true;
        }

    }



}
