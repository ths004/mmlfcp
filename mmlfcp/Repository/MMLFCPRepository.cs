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


        public Task<List<ExceptionCompanyEntity>> GetExcpCompanysAsync(string ga_id);

        //플랜조회
        public Task<List<PlanEntity>> GetPlansAsync();

        //플랜별기준보장 데이터 - 화면 왼쪽
        public Task<List<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId);

        //플랜 상품별보장별 보험료
        public Task<List<CoverageProductDto>> GetProductCoveragePremiumsAsync(string planId, string gender, int age);
        
        //플랜 상품별담보별 보험료 
        public Task<List<InsurProductDto>> GetProductInsurCDPremiumsAsync(string planId, string gender, int age);

        //플랜 연령별 보장별 보험료
        public Task<List<CoverageProductDto>> GetCoveragePremiumsByAgesAsync(string planId, string gender, int baseAge);
        //필수 보험료 조회
        public Task<List<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(string planId, string gender, int age);

        //플랜 연령별 필수 보험료 조회
        public Task<List<RequiredInsurGrouped>> GetRequiredInsurCDPremiumsByAgesAsync(string plan_id, string gender, int age);

        //플랜 만기별 보험료 조회
        public Task<List<PaytermCoveragePremiumGroup>> GetPaytermCoveragePremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);

        //플랜 만기별 필수 보험료 조회
        public Task<List<RequiredInsurCDPremiumEntity>> GetPaytermRequiredPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);


        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsAsync(
               PrintProductsRequest request);

        //사용자 플랜 등록
        public Task<UserCoverage> AddUserCoverageAsync(string ga_id, string consultant_id, UserCoverage user_bojang);

        //사용자 플랜 수정
        public Task<UserCoverage> UpdateUserCoverageAsync(string consultant_id, string user_plan_id);

        //사용자 플랜 조회
        public Task<List<UserCoverage>> GetUserCoverageAsync(String ga_id, String consultant_id);


        public Task<Boolean> SaveAccesslog(String agency_company_cd, String consultant_id, string ipaddr, string plan_id, string gender, int age);


        public Task<Boolean> SaveEventlog(String agency_company_cd, String consultant_id, string event_id);
    }

    public class MMLFCPRepository : IMMLFCPRepository
    {
        private readonly DapperContext _context;
        private readonly ILogger<MMLFCPRepository> _logger;

        // 캐시 필드
        private List<PlanEntity>? _cachedPlans;
        private Dictionary<string, List<PlanCoverageEntity>>? _cachedCoverages;
        private Dictionary<string, List<ExceptionCompanyEntity>>? _cachedExpCompanys;

        // 복합 키로 캐싱
        private Dictionary<PremiumCacheKey, List<CoverageProductDto>>? _cachedProductCoveragePremiums;
        private Dictionary<PremiumCacheKey, List<InsurProductDto>>? _cachedProductInsurCDPremiums;
        private Dictionary<PremiumCacheKey, List<RequiredInsurCDPremiumEntity>>? _cachedRequiredInsurCDPremiums;
        private Dictionary<AgePremiumCacheKey, List<CoverageProductDto>>? _cachedCoveragePremiumsByAges;

        private Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>? _cachedPaytermCoveragePremiums; //  만기 보험료 조회
        private Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>? _cachedPaytermRequiredPremiums; //  만기 필수 보험료 조회


        private Dictionary<AgePremiumCacheKey, List<RequiredInsurGrouped>>? _cachedRequiredInsurCDPremiumsByAges;

        // 락 객체
        private readonly SemaphoreSlim _planLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _excpCompanyLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _coverageLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _productCoveragePremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _productInsurCDPremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _requiredInsurCDPremiumLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _coveragePremiumsByAgesLock = new SemaphoreSlim(1, 1);

        private readonly SemaphoreSlim _paytermCoveragePremiumsLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _paytermRequiredPremiumsLock = new SemaphoreSlim(1, 1);


        private readonly SemaphoreSlim _requiredInsurCDPremiumsByAgesLock = new SemaphoreSlim(1, 1);



        public MMLFCPRepository(DapperContext context, ILogger<MMLFCPRepository> logger)
        {
            _context = context;
            _logger = logger;

            // Dictionary 초기화
            _cachedProductCoveragePremiums = new Dictionary<PremiumCacheKey, List<CoverageProductDto>>();
            _cachedProductInsurCDPremiums = new Dictionary<PremiumCacheKey, List<InsurProductDto>>();
            _cachedRequiredInsurCDPremiums = new Dictionary<PremiumCacheKey, List<RequiredInsurCDPremiumEntity>>();
            _cachedCoveragePremiumsByAges = new Dictionary<AgePremiumCacheKey, List<CoverageProductDto>>();
            _cachedPaytermCoveragePremiums = new Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>();
            _cachedPaytermRequiredPremiums = new Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>();
            _cachedRequiredInsurCDPremiumsByAges = new Dictionary<AgePremiumCacheKey, List<RequiredInsurGrouped>>();

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

        private class PaytermPremiumCacheKey : IEquatable<PaytermPremiumCacheKey>
        {
            public string PlanId { get; set; }
            public string PlanType { get; set; }
            public string PlanPaytermType { get; set; }

            public string Gender { get; set; }

            public int Age { get; set; }


            public PaytermPremiumCacheKey(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
            {
                PlanId = plan_id;
                PlanType = plan_type;
                PlanPaytermType = plan_payterm_type;
                Gender = gender;
                Age = age;
            }

            public bool Equals(PaytermPremiumCacheKey? other)
            {
                if (other is null) return false;
                return PlanId == other.PlanId && PlanType == other.PlanType && PlanPaytermType == other.PlanPaytermType &&  Gender == other.Gender && Age == other.Age;
            }

            public override bool Equals(object? obj)
            {
                return Equals(obj as PaytermPremiumCacheKey);
            }

            public override int GetHashCode()
            {
                return HashCode.Combine(PlanId, PlanType, Gender, Age);
            }

        }



        public async Task<List<PlanEntity>> GetPlansAsync()
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
                       a.plan_min_m_age,a.plan_max_m_age,a.plan_min_f_age,a.plan_max_f_age,
                       a.insu_compy_type as insurance_type
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

        public async Task<List<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId)
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
                : new List<PlanCoverageEntity>();

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
                    .ToDictionary(g => g.Key, g => g.ToList());

                _logger.LogInformation("Coverages loaded and cached: {Count} plans", _cachedCoverages.Count);
            }
        }


        public async Task<List<ExceptionCompanyEntity>> GetExcpCompanysAsync(string ga_id)
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
                : new List<ExceptionCompanyEntity>();

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
                    .ToDictionary(g => g.Key, g => g.ToList());

                _logger.LogInformation("Exception Companys loaded and cached: {Count} companys", _cachedExpCompanys.Count);
            }
        }


        public async Task<List<CoverageProductDto>> GetProductCoveragePremiumsAsync(string planId, string gender, int age)
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
                select     a.company_code,
                            e.CD_NM as company_name,
                            a.product_code,
                            d.prdt_name as product_name,
                            d.attr1 as product_detail_name,
                            d.mb_conditions as product_conditions,
                            a.coverage_cd,
                            f.coverage_name,
                            c.is_selected_coverage,
                            c.coverage_seq,
	                        a.gender,
                            a.age,
	                        c.guide_coverage_amount,
	                        case when a.coverage_amount > 0 then  (c.guide_coverage_amount * a.premium) / a.coverage_amount  else 0  end  as guide_coverage_premium,
	                        a.coverage_amount,
                            a.premium,
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
                    // 1️. DB Flat 데이터 가져오기
                    var raw = (await connection.QueryAsync<CoveragePremiumEntity>( sql,new { plan_id = planId, gender = gender, age = age } )).ToList();

                    // 2️⃣ 상품 기준 그룹핑 → DetailList 생성
                    var grouped =
                        raw.GroupBy(x => new
                        {
                            x.company_code,
                            x.company_name,
                            x.product_code,
                            x.product_name,
                            x.product_detail_name,
                            x.product_conditions,
                            x.gender,
                            x.age
                        })
                        .Select(g => new CoverageProductDto
                        {
                            company_code = g.Key.company_code,
                            company_name = g.Key.company_name,
                            product_code = g.Key.product_code,
                            product_name = g.Key.product_name,
                            product_detail_name = g.Key.product_detail_name,
                            product_conditions = g.Key.product_conditions,
                            gender = g.Key.gender,
                            age = g.Key.age,

                            DetailList = g
                                .OrderBy(x => x.coverage_seq)
                                .Select(x => new CoverageDetailDto
                                {
                                    coverage_cd = x.coverage_cd,
                                    coverage_name = x.coverage_name,
                                    is_selected_coverage = x.is_selected_coverage,
                                    coverage_seq = x.coverage_seq,
                                    guide_coverage_amount = x.guide_coverage_amount,
                                    guide_coverage_premium = x.guide_coverage_premium,
                                    coverage_amount = x.coverage_amount,
                                    premium = x.premium,
                                    coverage_amount_ratio = x.coverage_amount_ratio
                                }) .ToList()
                        })
                        .ToList();


                    // 3️⃣ 캐싱
                    _cachedProductCoveragePremiums[cacheKey] = grouped;

                    _logger.LogInformation("ProductCoveragePremiums cached for planId={PlanId}, gender={Gender}, age={Age}", planId, gender, age);
                    // 4️. 반환
                    return grouped;
                }
            }
            finally
            {
                _productCoveragePremiumLock.Release();
            }
        }


        public async Task<List<InsurProductDto>> GetProductInsurCDPremiumsAsync(string planId, string gender, int age)
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
                       d.insur_nm,
                       d.insur_bojang,
                       e.contract_amount as guide_contract_amount,
                       case when a.std_contract_amt > 0 then (e.contract_amount * a.premium) / a.std_contract_amt else 0 end as guide_premium,
                       e.contract_amount,
                       case when a.std_contract_amt > 0 then (e.contract_amount * a.premium) / a.std_contract_amt else 0 end as premium
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
                    var raw = (await connection.QueryAsync<InsurCDPremiumEntity>( sql,  new { plan_id = planId, gender = gender, age = age })).ToList();

                    var grouped = raw
                    .GroupBy(x => new
                    {
                        x.company_code,
                        x.product_code,
                        x.product_name,
                        x.product_detail_name,
                        x.product_conditions,
                        x.gender,
                        x.age
                    })
                    
                    .Select(g => new InsurProductDto
                    {
                        company_code = g.Key.company_code,
                        product_code = g.Key.product_code,
                        product_name = g.Key.product_name,
                        product_detail_name = g.Key.product_detail_name,
                        product_conditions = g.Key.product_conditions,
                        gender = g.Key.gender,
                        age = g.Key.age,

                    DetailList = g
                        .OrderBy(x => x.coverage_cd)
                        .ThenBy(x => x.insur_cd)
                        .Select(x => new InsurDetailDto
                        {
                            coverage_cd = x.coverage_cd,   // ⭐ 여기 들어감
                            insur_cd = x.insur_cd,
                            insur_nm = x.insur_nm,
                            insur_bojang = x.insur_bojang,
                            pay_term = x.pay_term,      // ⭐ 추가
                            guide_contract_amount = x.guide_contract_amount,
                            guide_premium = x.guide_premium,
                            contract_amount = x.contract_amount,
                            premium = x.premium
                       }) .ToList()
                    }).OrderBy(x => x.company_code).ToList();

                    _cachedProductInsurCDPremiums[cacheKey] = grouped;
                    return grouped;
                }
            }
            finally
            {
                _productInsurCDPremiumLock.Release();
            }

        }
        // 연령별 대표 보험료 데이터 조회
        public async Task<List<CoverageProductDto>> GetCoveragePremiumsByAgesAsync(
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
            select a.company_code,
                   e.CD_NM as company_name,
                   a.product_code,
                   d.prdt_name as product_name,
                   d.attr1 as product_detail_name,
                   d.mb_conditions as product_conditions,
                   a.coverage_cd,
                   f.coverage_name,
                   c.is_selected_coverage,
                   c.coverage_seq,
                   a.gender,
                   a.age,
                   c.guide_coverage_amount,
                   case when a.coverage_amount > 0 then  (c.guide_coverage_amount * a.premium) / a.coverage_amount else 0 end as guide_coverage_premium,
                   a.coverage_amount,
                   a.premium,
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
                    var agesToQuery = new List<int> { baseAge, baseAge + 1,  baseAge + 2, baseAge + 5, baseAge + 10 };
                    var raw = (await connection.QueryAsync<CoveragePremiumEntity>(sql,new { plan_id = planId, gender = gender, ages_in_clause = agesToQuery })).ToList();

                    var grouped = raw
                                            .GroupBy(x => new
                                            {
                                                x.company_code,
                                                x.company_name,
                                                x.product_code,
                                                x.product_name,
                                                x.product_detail_name,
                                                x.product_conditions,
                                                x.gender,
                                                x.age       // ⭐ age 기준 그룹
                                            })
                                            .Select(g => new CoverageProductDto
                                            {
                                                company_code = g.Key.company_code,
                                                company_name = g.Key.company_name,
                                                product_code = g.Key.product_code,
                                                product_name = g.Key.product_name,
                                                product_detail_name = g.Key.product_detail_name,
                                                product_conditions = g.Key.product_conditions,
                                                gender = g.Key.gender,
                                                age = g.Key.age,

                                            DetailList = g
                                                .OrderBy(x => x.coverage_seq)
                                                .Select(x => new CoverageDetailDto
                                                {
                                                    coverage_cd = x.coverage_cd,
                                                    coverage_name = x.coverage_name,
                                                    is_selected_coverage = x.is_selected_coverage,
                                                    coverage_seq = x.coverage_seq,
                                                    guide_coverage_amount = x.guide_coverage_amount,
                                                    guide_coverage_premium = x.guide_coverage_premium,
                                                    coverage_amount = x.coverage_amount,
                                                    premium = x.premium,
                                                    coverage_amount_ratio = x.coverage_amount_ratio
                                                })
                                                .ToList()
                                        })
                                            .OrderBy(x => x.company_code)
                                            .ThenBy(x => x.product_code)
                                            .ThenBy(x => x.age)
                                            .ToList();

                    _cachedCoveragePremiumsByAges[cacheKey] = grouped;
                    _logger.LogInformation("CoveragePremiumsByAges cached for planId={PlanId}, gender={Gender}, baseAge={BaseAge}", planId, gender, baseAge);
                    return grouped;
                }
            }
            finally
            {
                _coveragePremiumsByAgesLock.Release();
            }
        }

        //플랜 만기별 보험료 조회
        public async Task<List<PaytermCoveragePremiumGroup>> GetPaytermCoveragePremiums(string planId, string planType, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(planId, planType, plan_payterm_type, gender, age);

            if (_cachedPaytermCoveragePremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }
                

            await _paytermCoveragePremiumsLock.WaitAsync();

            try
            {
                if (_cachedPaytermCoveragePremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @" 
                                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                                SET NOCOUNT ON;

                                -- 1. 납입기간 속성 조회
                               declare @payterm_type nvarchar(5);
                               select @payterm_type = ATTR01 from TB_COMM_CD  where UPP_CD_ID = 'MMLFCP_B' and cd_id = @plan_payterm_type  and ATTR01 <> '전기납';

                               -- 2. 메인 조회
                               select
                                a.company_code,
                                comm1.CD_NM as company_name,
                                a.product_code,
                                f.prdt_name as product_name,
                                f.attr1 as product_detail_name,
                                f.mb_conditions as product_conditions,
                                comm2.cd_nm as plan_payterm_type_name,
                                c.coverage_cd,
                                e.coverage_name,
                                c.is_selected_coverage,
                                c.coverage_seq,
                                d.gender,
                                d.age,
                                c.guide_coverage_amount,
                                -- 보험료 계산 수식
                                case when d.coverage_amount > 0 then (c.guide_coverage_amount * d.premium) / d.coverage_amount else 0 end as guide_coverage_premium,
                                d.coverage_amount,
                                d.premium,
                                -- 정렬용 시퀀스 (입력받은 납입타입을 0순위로)
                                case when b.plan_payterm_type = @plan_payterm_type then 0 else comm2.ORDER_SEQ end as plan_payterm_type_seq
                           from TB_MMLFCP_PLAN_PRODUCT a

                        join TB_MMLFCP_PLAN b 
                            on a.plan_id = b.plan_id

                        join TB_MMLFCP_PLAN_COVERAGE c 
                            on a.plan_id = c.plan_id 
                            and c.use_yn = 'Y'

                        join TB_MMLFCP_COVERAGE_PRICE d 
                            on a.company_code = d.company_code 
                            and a.product_code = d.product_code 
                            and c.coverage_cd = d.coverage_cd
                            and d.gender = @gender 
                            and d.age = @age

                       join TB_MMLFCP_COVERAGE e 
                            on c.coverage_cd = e.coverage_cd 
                            and e.use_yn = 'Y'

                      join TB_TIC_PRDT f 
                        on a.company_code = f.compy_cd 
                        and a.product_code = f.prdt_cd 
                        and f.use_yn = 'Y'

                     join TB_COMM_CD comm1 
                        on comm1.UPP_CD_ID = 'COMPY' 
                        and comm1.CD_ID = a.company_code 
                        and comm1.USE_YN = 'Y'

                     join TB_COMM_CD comm2 
                        on comm2.UPP_CD_ID = 'MMLFCP_B' 
                        and comm2.CD_ID = b.plan_payterm_type 
                        and comm2.USE_YN = 'Y'

                    where a.use_yn = 'Y'
                        and a.company_code IN (select company_code from TB_MMLFCP_PLAN_PRODUCT where plan_id = @plan_id and use_yn='Y')
                        and b.plan_type=@plan_type
                        and b.plan_payterm_type IN (select cd_id from TB_COMM_CD where UPP_CD_ID = 'MMLFCP_B' and ATTR01 =@payterm_type)

                    order by 
                        a.company_code, 
                        plan_payterm_type_seq, 
                        a.plan_id, 
                        c.coverage_seq; ";
                
                using var connection = _context.CreateConnection();
                var rows = (await connection.QueryAsync<PaytermCoveragePremiumRow>(sql,new { plan_id = planId, plan_type = planType, plan_payterm_type, gender, age })).ToList();

                var result = BuildGroups(rows);

                _cachedPaytermCoveragePremiums[cacheKey] = result;
                _logger.LogInformation("GetPaytermCoveragePremiums cached for plan_id={planId}, plan_type={planType}, plan_payterm_type={plan_payterm_type},gender={gender}, age={baseAge}", planId, planType, plan_payterm_type,gender, age);
                return result;

            }
            finally
            {
                _paytermCoveragePremiumsLock.Release();
            }
        }

      
        private static List<PaytermCoveragePremiumGroup> BuildGroups(List<PaytermCoveragePremiumRow> rows)
        {
            return rows
                .GroupBy(r => (r.company_code, r.product_code, r.plan_payterm_type_name))
                .Select(g =>
                {
                    var first = g.First();

                    return new PaytermCoveragePremiumGroup
                    {
                        company_code = first.company_code,
                        company_name = first.company_name,
                        product_code = first.product_code,
                        product_name = first.product_name,
                        product_detail_name = first.product_detail_name,
                        product_conditions = first.product_conditions,
                        plan_payterm_type_name = first.plan_payterm_type_name,
                        gender = first.gender,
                        age = first.age,

                        DetailList = g.Select(d => new PaytermCoveragePremiumDetail
                        {
                            coverage_cd = d.coverage_cd,
                            coverage_name = d.coverage_name,
                            is_selected_coverage = d.is_selected_coverage,
                            coverage_seq = d.coverage_seq,
                            guide_coverage_amount = d.guide_coverage_amount,
                            guide_coverage_premium = d.guide_coverage_premium,
                            coverage_amount = d.coverage_amount,
                            premium = d.premium,
                            plan_payterm_type_seq = d.plan_payterm_type_seq
                        }).ToList()
                    };
                })
                .ToList();
        }


        //플랜 만기별 필수 보험료 조회
        public async Task<List<RequiredInsurCDPremiumEntity>> GetPaytermRequiredPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(plan_id, plan_type, plan_payterm_type, gender, age);

            if (_cachedPaytermRequiredPremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }

            await _paytermRequiredPremiumsLock.WaitAsync();

            try
            {
                string sql = @"
                                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                                SET NOCOUNT ON;

                                -- 1. 납입기간 속성 조회
                                declare @payterm_type nvarchar(5)
                                select @payterm_type = ATTR01 from TB_COMM_CD  where UPP_CD_ID = 'MMLFCP_B' and cd_id = @plan_payterm_type  and ATTR01 <> '전기납';

                                --  CTE
                                ;with PaytermSet as (
                                    select cd_id
                                    from TB_COMM_CD
                                    where UPP_CD_ID = 'MMLFCP_B'
                                        and ATTR01 = @payterm_type
                                )


                                -- 2. 메인 쿼리 조회
                                select 
                                    a.company_code,
                                    comm1.CD_NM  as company_name,
                                    a.product_code,
                                    d.prdt_name  as product_name,
                                    d.attr1 as product_detail_name,
                                    d.mb_conditions as product_conditions,
                                    comm2.cd_nm as pay_term,
                                    c.sex as gender,
                                    c.age,
                                    c.insur_cd,
                                    e.insur_nm,
                                    e.insur_bojang,
                                    f.min_insur_amount,
                                    -- 가입 금액 대비 보험료 계산 (0 나누기 방지)
                                    case when c.std_contract_amt > 0 then (f.min_insur_amount * c.premium) / c.std_contract_amt else 0 end as min_premium,
                                    c.std_contract_amt   as contract_amount,
                                    c.premium

                                from TB_MMLFCP_PLAN_PRODUCT a

                                join TB_MMLFCP_PLAN b
                                    on a.plan_id = b.plan_id
                                and b.use_yn = 'Y'
                                and b.plan_type = @plan_type

                                join PaytermSet ps
                                    on ps.cd_id = b.plan_payterm_type

                                --2. 해당 상품의 가격 정보 가져오기 (성별/나이 필터 적용)
                                join TB_TIC_PRDT_PRICE c
                                on a.company_code = c.compy_cd
                                and a.product_code = c.prdt_cd
                                and c.sex = @gender
                                and c.age = @age
                                and c.use_yn = 'Y'

                                -- 4. 상품 상세 정보
                                join TB_TIC_PRDT d
                                    on c.compy_cd = d.compy_cd
                                    and c.prdt_cd = d.prdt_cd
                                    and d.use_yn='Y'

                                -- 5. 담보 상세 정보
                                join TB_TIC_PRDT_D e
                                    on c.compy_cd = e.compy_cd
                                    and c.prdt_cd = e.prdt_cd
                                    and c.insur_cd = e.insur_cd

                                -- 6. 최소 가입 금액 규칙
                                join TB_MMLFCP_PRODUCT_REQUIRED_RULES f
                                    on c.compy_cd = f.company_code
                                    and c.prdt_cd = f.product_code
                                    and c.insur_cd = f.insur_cd

                                -- 7. 회사 이름
                                join TB_COMM_CD comm1
                                    on comm1.UPP_CD_ID = 'COMPY' 
                                    and comm1.CD_ID = a.company_code 
                                    and comm1.USE_YN = 'Y'

                                join TB_COMM_CD comm2 
                                    on comm2.UPP_CD_ID = 'MMLFCP_B' 
                                    and comm2.CD_ID = b.plan_payterm_type 
                                    and comm2.USE_YN = 'Y'

                                where
                                    a.use_yn = 'Y'
                                    --and a.plan_id = @plan_id

                                order by
                                    a.company_code,
                                    b.plan_payterm_type,
                                    c.insur_cd;";


                using (var connection = _context.CreateConnection())
                {
                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(sql, new { plan_id = plan_id, plan_type = plan_type, plan_payterm_type= plan_payterm_type, gender = gender, age = age })).ToList();
                    _cachedPaytermRequiredPremiums[cacheKey] = premiums;
                    _logger.LogInformation("GetPaytermRequiredPremiums cached for plan_id={plan_id}, plan_type={plan_type}, plan_payterm_type={plan_payterm_type}, gender={gender}, age={baseAge}", plan_id, plan_type, plan_payterm_type,gender, age);
                    return premiums;
                }

            }
            finally
            {
                _paytermRequiredPremiumsLock.Release();
            }


        }


        public async Task<List<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(
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
                   a.sex as gender,
                   a.age,
                   a.insur_cd,
                   d.insur_nm,
                   d.insur_bojang,
                   e.min_insur_amount,
                   case when a.std_contract_amt > 0 then (e.min_insur_amount * a.premium) / a.std_contract_amt else 0 end as min_premium,
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
        public async Task<List<RequiredInsurGrouped>> GetRequiredInsurCDPremiumsByAgesAsync(string planId, string gender, int age)
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
                                case when a.std_contract_amt > 0 then  (e.min_insur_amount * a.premium) / a.std_contract_amt else 0 end as min_premium,
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
                                    var agesToQuery = new List<int> { age, age + 1, age + 2, age + 5, age + 10 };

                                    // ✅ 1) 먼저 flat list 조회 (premiums 생성)
                                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(sql,  new{plan_id = planId,gender = gender,ages_in_clause = agesToQuery }
                                    )).ToList();

                                    // ✅ 2) 그 다음 grouping 해서 결과 만들기
                                    var grouped = premiums
                                        .GroupBy(x => new
                                        {
                                            x.company_code,
                                            x.company_name,
                                            x.product_code,
                                            x.product_name,
                                            x.product_detail_name,
                                            x.product_conditions,
                                            x.pay_term
                                        })
                                        .Select(g => new RequiredInsurGrouped
                                        {
                                            company_code = g.Key.company_code,
                                            company_name = g.Key.company_name,
                                            product_code = g.Key.product_code,
                                            product_name = g.Key.product_name,
                                            product_detail_name = g.Key.product_detail_name,
                                            product_conditions = g.Key.product_conditions,
                                            pay_term = g.Key.pay_term,
                                            DetailList = g
                                                .Select(d => new RequiredInsurDetail
                                                {
                                                    gender = d.gender,
                                                    age = d.age,
                                                    insur_cd = d.insur_cd,
                                                    insur_nm = d.insur_nm,
                                                    insur_bojang = d.insur_bojang,
                                                    min_insur_amount = d.min_insur_amount,
                                                    min_premium = d.min_premium,
                                                    contract_amount = d.contract_amount,
                                                    premium = d.premium
                                                })
                                                .OrderBy(x => x.age)
                                                .ThenBy(x => x.insur_cd)
                                                .ToList()
                                        })
                                        .ToList();

                                    // ✅ 3) 캐시에는 grouped 저장 (타입 맞추기)
                                    _cachedRequiredInsurCDPremiumsByAges[cacheKey] = grouped;
                                    _logger.LogInformation("RequiredInsurCDPremiumsByAges cached for planId={PlanId}, gender={Gender}, age={Age}", planId, gender, age);
                                    return grouped;
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

        //사용자 플랜 등록
        public async Task<UserCoverage> AddUserCoverageAsync(string ga_id, string consultant_id, UserCoverage userCoverage)
        {
            //1) DataTable 생성
            var usercoverageDetails = new DataTable();
            usercoverageDetails.Columns.Add("coverage_cd", typeof(string));
            usercoverageDetails.Columns.Add("coverage_amount", typeof(float));

            foreach (var detail in userCoverage.details)
            {
                usercoverageDetails.Rows.Add(detail.coverage_cd, detail.coverage_amount);
            }

            using (var connection = _context.CreateConnection())
            {
                //2) 프로시저 호출
                var parameters = new DynamicParameters();
                parameters.Add("@user_plan_id", userCoverage.user_plan_id == "" ? Guid.NewGuid().ToString() : userCoverage.user_plan_id);
                parameters.Add("@user_plan_name", userCoverage.user_plan_name);
                parameters.Add("@plan_type", userCoverage.plan_type);
                parameters.Add("@ga_id", ga_id);
                parameters.Add("@consultant_id", consultant_id);
                parameters.Add("@user_plan_detail", usercoverageDetails.AsTableValuedParameter("t_mmlfcp_user_plan_detail"));

                // 3) proc 실행 → 결과 매핑
                var result = await connection.QueryFirstOrDefaultAsync<dynamic>("proc_add_user_plan", parameters, commandType: CommandType.StoredProcedure);

                if (result != null)
                {
                    userCoverage.user_plan_id = result.cur_user_plan_id.ToString();
                    userCoverage.in_date = result.in_date;
                    userCoverage.up_date = result.up_date;
                }
            }
            return userCoverage;
        }

        //사용자 플랜 수정
        public async Task<UserCoverage> UpdateUserCoverageAsync(string consultant_id, string user_plan_id)
        {
            //1) 쿼리
            string qry = @"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                             SET NOCOUNT ON; 
        
                            DELETE FROM TB_MMLFCP_USER_PLAN
                                WHERE user_plan_id = @user_plan_id
                                    AND consultant_id = @consultant_id;

                            DELETE FROM TB_MMLFCP_USER_PLAN_DETAIL
                                    WHERE user_plan_id = @user_plan_id;
                            ";
            try
            {
                using (var connection = _context.CreateConnection())
                {
                    var parameters = new DynamicParameters();
                    parameters.Add("@consultant_id", consultant_id);
                    parameters.Add("@user_plan_id", user_plan_id);
                    await connection.ExecuteAsync(qry, parameters, commandType: CommandType.Text);
                }
                _logger.LogInformation("사용자 플랜 삭제 완료 - consultant_id: {consultant_id}, user_plan_id: {user_plan_id}", consultant_id, user_plan_id);

                // 반환용 객체 구성 (삭제 후 확인용)
                return new UserCoverage
                {
                    consultant_id = consultant_id,
                    user_plan_id = user_plan_id,
                    user_plan_name = string.Empty,
                    in_date = DateTime.Now,
                    up_date = DateTime.Now,
                    details = new List<UserCoverageDetail>()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 플랜 삭제 중 오류 발생 - consultant_id: {consultant_id}, user_plan_id: {user_plan_id}", consultant_id, user_plan_id);
                throw new Exception("사용자 플랜 삭제 중 오류가 발생했습니다. " + ex.Message);
            }
        }

        //사용자 플랜 리스트 조회
        public async Task<List<UserCoverage>> GetUserCoverageAsync(String ga_id, String consultant_id)
        {
            try
            {
                //1) 쿼리
                string sql = @"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                             SET NOCOUNT ON; 
                            SELECT 
                            CONVERT(varchar(36), a.user_plan_id) AS user_plan_id,
                            a.user_plan_name,
                            a.plan_type,
                            a.ga_id,
                            a.consultant_id,
                            a.in_date,
                            a.up_date,
                            b.coverage_cd,
                            b.coverage_amount
                           
                            FROM TB_MMLFCP_USER_PLAN a
                            JOIN TB_MMLFCP_USER_PLAN_DETAIL b 
                                ON a.user_plan_id = b.user_plan_id
                                AND a.ga_id = @ga_id
                                AND a.consultant_id = @consultant_id
                            ORDER BY a.in_date desc, b.coverage_cd
                            ";
                using (var connection = _context.CreateConnection())
                {
                    var lookup = new Dictionary<String, UserCoverage>();

                    // 2️) Dapper의 multi-mapping 활용
                    var list = await connection.QueryAsync<UserCoverage, UserCoverageDetail, UserCoverage>(
                        sql,
                        (parent, detail) =>
                        {
                            if (!lookup.TryGetValue(parent.user_plan_id, out var userCoverage))
                            {
                                userCoverage = parent;
                                userCoverage.details = new List<UserCoverageDetail>();
                                lookup.Add(userCoverage.user_plan_id, userCoverage);
                            }

                            if (detail != null)
                            {
                                userCoverage.details.Add(detail);
                            }
                            return userCoverage;
                        },
                        new { ga_id, consultant_id },
                        splitOn: "coverage_cd" // coverage_cd 기준으로 detail 구분
                    );
                    var result = lookup.Values.ToList();
                    _logger.LogInformation("userCoverage cached for ga_id={ga_id}, consultant_id={consultant_id}", ga_id, consultant_id);
                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 플랜 조회 중 오류 발생 - ga_id: {ga_id}, consultant_id:{consultant_id}", ga_id, consultant_id);
                throw new Exception("사용자 플랜 조회 중 오류가 발생했습니다. " + ex.Message);
            }
        }
    }
}
