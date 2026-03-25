using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using mmlfcp.Middleware;
using mmlfcp.Models;
using System.Data;
using System.Numerics;

namespace mmlfcp.Repository
{
    public interface IMMLFCPRepository
    {


        public Task<List<ExceptionCompanyEntity>> GetExcpCompanysAsync(string ga_id);

        //플랜조회
        public Task<List<PlanEntity>> GetPlansAsync();

        //업데이트 날짜 조회
        public Task<UploadDateEntity> GetUploadDateAsync();


        //플랜별기준보장 데이터 - 화면 왼쪽
        public Task<List<PlanCoverageEntity>> GetGuideCoveragesByPlanIdAsync(string planId);

        //플랜별 보장 보험료
        public Task<List<CoverageProductDto>> GetProductCoveragePremiumsAsync(string planId, string gender, int age);
        
        //플랜별 보장 상세 보험료 
        public Task<List<InsurProductDto>> GetProductInsurCDPremiumsAsync(string planId, string gender, int age);

        //플랜별 필수 보험료 조회
        public Task<List<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(string planId, string gender, int age);

        //플랜별 연령별 보장별 보험료
        public Task<List<CoverageProductDto>> GetCoveragePremiumsByAgesAsync(string planId, string gender, int baseAge);

        //플랜별 연령 필수 보험료 조회
        public Task<List<RequiredInsurGrouped>> GetRequiredInsurCDPremiumsByAgesAsync(string plan_id, string gender, int age);

        //플랜별 만기 보험료 조회
        public Task<List<PaytermCoveragePremiumGroup>> GetPaytermCoveragePremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);

        //플랜별  만기 필수 보험료 조회
        public Task<List<RequiredInsurCDPremiumEntity>> GetPaytermRequiredPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);

        //무해지 및 간편보험료 조회
        public Task<List<PaytermCoveragePremiumGroup>> GetSimplifiedCoveragePremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);

        //무해지 및 간편 상세보험료 조회
        public Task<List<InsurProductDto>> GetSimplifiedCoverageInsurPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);


        //무해지 및 간편 필수보험료 조회
        public Task<List<RequiredInsurCDPremiumEntity>> GetSimplifiedRequiredPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age);


        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByPaymentsAsync(PrintProductsRequest request);

        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByAgeAsync(PrintProductsRequest request);

        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByPlanTypeAsync(PrintProductsRequest request);
        
        //사용자 플랜 등록
        public Task<UserCoverage> AddUserCoverageAsync(string ga_id, string consultant_id, UserCoverage user_bojang);

        //사용자 플랜 수정
        public Task<UserCoverage> UpdateUserCoverageAsync(string consultant_id, string user_plan_id);

        //사용자 플랜 조회
        public Task<List<UserCoverage>> GetUserCoverageAsync(String ga_id, String consultant_id);


        //출력에서 사용
        public Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsAsync(PrintProductsRequest request);


        public Task<Boolean> SaveAccesslog(String agency_company_cd, String consultant_id, string ipaddr, string plan_id, string gender, int age);


        public Task<Boolean> SaveEventlog(String agency_company_cd, String consultant_id, string event_id);

        public Task<Boolean> IsUserRestricted(string ga_id, String consultant_id, String app_id);
    }

    public class MMLFCPRepository : IMMLFCPRepository
    {
        private readonly DapperContext _context;
        private readonly ILogger<MMLFCPRepository> _logger;

        // 캐시 필드
        private List<PlanEntity>? _cachedPlans;
        private UploadDateEntity? _cachedUploadDate;


        private Dictionary<string, List<PlanCoverageEntity>>? _cachedCoverages;
        private Dictionary<string, List<ExceptionCompanyEntity>>? _cachedExpCompanys;

        // 복합 키로 캐싱
        private Dictionary<PremiumCacheKey, List<CoverageProductDto>>? _cachedProductCoveragePremiums;
        private Dictionary<PremiumCacheKey, List<InsurProductDto>>? _cachedProductInsurCDPremiums;
        private Dictionary<PremiumCacheKey, List<RequiredInsurCDPremiumEntity>>? _cachedRequiredInsurCDPremiums;
        private Dictionary<AgePremiumCacheKey, List<CoverageProductDto>>? _cachedCoveragePremiumsByAges;

        private Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>? _cachedPaytermCoveragePremiums; //  만기 보험료 조회
        private Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>? _cachedPaytermRequiredPremiums; //  만기 필수 보험료 조회


        private Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>? _cachedSimplifiedCoveragePremiums; //무해지 및 간편보험료 조회
        private Dictionary<PaytermPremiumCacheKey, List<InsurProductDto>>? _cachedSimplifiedInsurCoveragePremiums; //무해지 및 간편 상세보험료 조회
        private Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>? _cachedSimplifiedRequiredPremiums; //무해지 및 간편 필수보험료 조회

        private Dictionary<AgePremiumCacheKey, List<RequiredInsurGrouped>>? _cachedRequiredInsurCDPremiumsByAges;

        // 락 객체
        private readonly SemaphoreSlim _planLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _uploadDateLock = new SemaphoreSlim(1, 1);

        private readonly SemaphoreSlim _excpCompanyLock = new SemaphoreSlim(1, 1);
        
        private readonly SemaphoreSlim _coverageLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _productCoveragePremiumLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _productInsurCDPremiumLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _requiredInsurCDPremiumLock = new SemaphoreSlim(10, 10);
        
        
        private readonly SemaphoreSlim _coveragePremiumsByAgesLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _requiredInsurCDPremiumsByAgesLock = new SemaphoreSlim(10, 10);


        private readonly SemaphoreSlim _paytermCoveragePremiumsLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _paytermRequiredPremiumsLock = new SemaphoreSlim(10, 10);

        private readonly SemaphoreSlim _simplifiedCoveragePremiumsLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _simplifiedCoverageInsurPremiumsLock = new SemaphoreSlim(10, 10);
        private readonly SemaphoreSlim _simplifiedRequiredPremiumsLock = new SemaphoreSlim(10, 10);


        public MMLFCPRepository(DapperContext context, ILogger<MMLFCPRepository> logger)
        {
            _context = context;
            _logger = logger;

            // Dictionary 초기화
            
            _cachedProductCoveragePremiums = new Dictionary<PremiumCacheKey, List<CoverageProductDto>>();
            
            _cachedProductInsurCDPremiums = new Dictionary<PremiumCacheKey, List<InsurProductDto>>();
            _cachedRequiredInsurCDPremiums = new Dictionary<PremiumCacheKey, List<RequiredInsurCDPremiumEntity>>();
            
            _cachedCoveragePremiumsByAges = new Dictionary<AgePremiumCacheKey, List<CoverageProductDto>>();
            _cachedRequiredInsurCDPremiumsByAges = new Dictionary<AgePremiumCacheKey, List<RequiredInsurGrouped>>();
            
            _cachedPaytermCoveragePremiums = new Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>();
            _cachedPaytermRequiredPremiums = new Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>();

            _cachedSimplifiedCoveragePremiums = new Dictionary<PaytermPremiumCacheKey, List<PaytermCoveragePremiumGroup>>();
            _cachedSimplifiedInsurCoveragePremiums = new Dictionary<PaytermPremiumCacheKey, List<InsurProductDto>>();
            _cachedSimplifiedRequiredPremiums = new Dictionary<PaytermPremiumCacheKey, List<RequiredInsurCDPremiumEntity>>();

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
                a.plan_id, a.coverage_cd,b.life_fire_coverage_name as coverage_name, a.guide_coverage_amount, 
                a.is_selected_coverage, a.coverage_seq
            from TB_MMLFCP_PLAN_COVERAGE a
            join TB_MMLFCP_COVERAGE b
                on a.coverage_cd = b.coverage_cd
			join TB_MMLFCP_PLAN c
				on a.plan_id = c.plan_id
				and c.insu_compy_type = 'LF'
            where a.use_yn='Y'
			union
            select 
                a.plan_id, a.coverage_cd,b.fire_coverage_name as coverage_name, a.guide_coverage_amount, 
                a.is_selected_coverage, a.coverage_seq
            from TB_MMLFCP_PLAN_COVERAGE a
            join TB_MMLFCP_COVERAGE b
                on a.coverage_cd = b.coverage_cd
			join TB_MMLFCP_PLAN c
				on a.plan_id = c.plan_id
				and c.insu_compy_type = 'F'
            where a.use_yn='Y'
			union
            select 
                a.plan_id, a.coverage_cd,b.life_coverage_name as coverage_name, a.guide_coverage_amount, 
                a.is_selected_coverage, a.coverage_seq
            from TB_MMLFCP_PLAN_COVERAGE a
            join TB_MMLFCP_COVERAGE b
                on a.coverage_cd = b.coverage_cd
			join TB_MMLFCP_PLAN c
				on a.plan_id = c.plan_id
				and c.insu_compy_type = 'L'
            where a.use_yn='Y'
          order by a.plan_id,a.coverage_seq
            ";

            using (var connection = _context.CreateConnection())
            {
                var allCoverages = await connection.QueryAsync<PlanCoverageEntity>(sql);

                _cachedCoverages = allCoverages
                    .GroupBy(c => c.plan_id)
                    .ToDictionary(g => g.Key, g => g.ToList());

                _logger.LogInformation("Coverages loaded and cached: {Count} plans", _cachedCoverages.Count);
            }
        }


        private async Task LoadUploadDateAsync()
        {
            string sql = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select top 1 
                        replace(convert(nvarchar,life_upload_date,111),'/','-') as life_upload_date, 
                        replace(convert(nvarchar,fire_upload_date,111),'/','-') as  fire_upload_date 
            from 
                TB_TIC_UPLOAD order by in_date desc
            ";

            using (var connection = _context.CreateConnection())
            {
                var uploadDates = await connection.QueryAsync<UploadDateEntity>(sql);


                _cachedUploadDate = uploadDates.FirstOrDefault();

                _logger.LogInformation("upload date loaded and cached: {Count} ", uploadDates.Count());
            }
        }

        public async Task<UploadDateEntity> GetUploadDateAsync()
        {
            if (_cachedUploadDate == null)
            {
                await _uploadDateLock.WaitAsync();
                try
                {
                    if (_cachedUploadDate == null)
                    {
                        await LoadUploadDateAsync();
                    }
                }
                finally
                {
                    _uploadDateLock.Release();
                }
            }

            return _cachedUploadDate != null 
                ? _cachedUploadDate
                : new UploadDateEntity();

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
	                        case when a.coverage_amount > 0 then  FLOOR((c.guide_coverage_amount * a.premium) / a.coverage_amount)  else 0  end  as guide_coverage_premium,
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
		                on a.coverage_cd = c.coverage_cd
		                and c.plan_id = @plan_id
		                and c.use_yn = 'Y'
                    join TB_TIC_PRDT  d
	                    on a.company_code = d.compy_cd
		                and a.product_code = d.prdt_cd
                        and d.use_yn='Y'
	                join TB_COMM_CD e
		                on a.company_code = e.CD_ID
		                and e.UPP_CD_ID = 'COMPY'
                        and e.USE_YN='Y'
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

        //상세 보험료 조회
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
                       case when a.std_contract_amt > 0 then FLOOR((e.contract_amount * a.premium) / a.std_contract_amt) else 0 end as guide_premium,
                       e.contract_amount,
                       case when a.std_contract_amt > 0 then FLOOR((e.contract_amount * a.premium) / a.std_contract_amt) else 0 end as premium
                from 
                    TB_TIC_PRDT_PRICE a
                    join TB_MMLFCP_PLAN_PRODUCT b
                        on a.compy_cd = b.company_code
                        and a.prdt_cd = b.product_code
                        and b.plan_id = @plan_id
                    join TB_TIC_PRDT c
                        on a.compy_cd = c.compy_cd
                        and a.prdt_cd = c.prdt_cd
                        and c.use_yn='Y'
                    join TB_TIC_PRDT_D d
                        on a.compy_cd = d.compy_cd
                        and a.prdt_cd = d.prdt_cd
                        and a.insur_cd = d.insur_cd
                        and d.use_yn='Y'
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
                order by a.compy_cd, e.coverage_cd, a.insur_cd ";

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

        //필수 보험료 조회
        public async Task<List<RequiredInsurCDPremiumEntity>> GetRequiredInsurCDPremiumsAsync(string planId, string gender, int age)
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
                   case when a.std_contract_amt > 0 then FLOOR((e.min_insur_amount * a.premium) / a.std_contract_amt) else 0 end as min_premium,
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
                    and c.use_yn='Y'
                join TB_TIC_PRDT_D d
                    on a.compy_cd = d.compy_cd
                    and a.prdt_cd = d.prdt_cd
                    and a.insur_cd = d.insur_cd
                    and d.use_yn='Y'
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


        // 연령별 보장 보험료 데이터 조회
        public async Task<List<CoverageProductDto>> GetCoveragePremiumsByAgesAsync(string planId, string gender, int baseAge)
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
                    select
                        b.company_code,
                        b.product_code,
                        d.prdt_name as product_name,
                        d.attr1 as product_detail_name,
                        d.mb_conditions as product_conditions,
                        b.coverage_cd,
                        c.coverage_name,
                        b.is_selected_coverage,
                        b.coverage_seq,
                        a.gender,
                        a.age,
                        b.guide_coverage_amount,
                        case when ISNULL(a.coverage_amount,0) > 0 then  FLOOR((b.guide_coverage_amount * a.premium) / a.coverage_amount) else 0 end as guide_coverage_premium,
                        a.coverage_amount,
                        a.premium,
                        isnull((select top 1 coverage_amount_ratio from TB_MMLFCP_AMOUNT_RATIO where a.company_code = company_code and a.product_code = product_code and c.coverage_cd = coverage_cd),1) as coverage_amount_ratio

                    from 
                        TB_MMLFCP_COVERAGE_PRICE a
                    
                    join (
                    select 
                        b.company_code,
                        b.product_code,
                        c.coverage_cd,
                        c.is_selected_coverage,
                        c.coverage_seq,
                        c.guide_coverage_amount
                    
                    from TB_MMLFCP_PLAN a
		
                    join TB_MMLFCP_PLAN_PRODUCT b
                        on a.plan_id = b.plan_id
		
                    join TB_MMLFCP_PLAN_COVERAGE c
                        on a.plan_id = c.plan_id
                        and c.use_yn = 'Y'
		
                    where b.use_yn = 'Y'
                        and a.plan_id = @plan_id
                    ) b
                    on a.company_code = b.company_code
                    and a.product_code = b.product_code
                    and a.coverage_cd = b.coverage_cd
		
                    join TB_MMLFCP_COVERAGE c
                        on a.coverage_cd = c.coverage_cd
	
                    join TB_TIC_PRDT d
                        on a.company_code = d.compy_cd
                        and a.product_code = d.prdt_cd		
                        and d.use_yn='Y'
	
                    join TB_COMM_CD g
                        on a.company_code = g.CD_ID
                        and g.UPP_CD_ID = 'COMPY' 
                        and g.USE_YN='Y'
	
                    where 
                        a.age in @ages_in_clause
                        and a.gender = @gender
                    
                order by 
                    b.company_code, 
                    b.product_code, 
                    a.age, 
                    b.coverage_seq
 ";

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
                                case when a.std_contract_amt > 0 then  FLOOR((e.min_insur_amount * a.premium) / a.std_contract_amt) else 0 end as min_premium,
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
                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(sql, new { plan_id = planId, gender = gender, ages_in_clause = agesToQuery }
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


        //플랜별  만기 보험료 조회
        public async Task<List<PaytermCoveragePremiumGroup>> GetPaytermCoveragePremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(plan_id, plan_type, plan_payterm_type, gender, age);

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

                                -- 1. 납입타입 대상 CTE 추출
                                with CTE_PAYTERM as (
                                select @plan_payterm_type as plan_payterm_type, 0 as seq
                                union all
                                select TOP 2 
                                    plan_payterm_type, 
                                    ROW_NUMBER() OVER (order by plan_id) as seq
                                from TB_MMLFCP_PLAN
                                where plan_type = @plan_type
                                    and pay_term = (select pay_term from TB_MMLFCP_PLAN where plan_id = @plan_id)
                                    and plan_payterm_type NOT IN ('02', @plan_payterm_type)
                               )

                               -- 2. 메인 데이터 조회
                                select
                                b.company_code,
                                e.CD_NM as company_name,
                                b.product_code,
                                d.prdt_name as product_name,
                                d.attr1 as product_detail_name,
                                d.mb_conditions as product_conditions,
                                b.plan_payterm_type_name,
                                b.coverage_cd,
                                c.coverage_name,
                                b.is_selected_coverage,
                                b.coverage_seq,
                                a.gender,
                                a.age,
                                b.guide_coverage_amount,
                                -- 보험료 계산 로직
                                case when ISNULL(a.coverage_amount, 0) > 0 then FLOOR((b.guide_coverage_amount * a.premium) / a.coverage_amount) else 0 end as guide_coverage_premium,
                                a.coverage_amount,
                                a.premium,
                                -- 정렬용 시퀀스 (입력값 최우선)
                                case when b.plan_payterm_type = @plan_payterm_type then 0 else b.ORDER_SEQ end as plan_payterm_type_seq

                                from TB_MMLFCP_COVERAGE_PRICE a
                                join (
                                /* 서브쿼리 b: 플랜 및 기준 마스터 정보 */
                                select
                                    p.plan_id,
                                    pp.company_code,
                                    pp.product_code,
                                    p.plan_payterm_type,
                                    c2.CD_NM as plan_payterm_type_name,
                                    pc.coverage_cd,
                                    pc.is_selected_coverage,
                                    pc.coverage_seq,
                                    pc.guide_coverage_amount,
                                    c2.ORDER_SEQ
                                from TB_MMLFCP_PLAN p
   
                                join TB_MMLFCP_PLAN_PRODUCT pp 
                                    on p.plan_id = pp.plan_id 
                                    and pp.use_yn = 'Y'
                                
                                join CTE_PAYTERM pt           
                                    on p.plan_payterm_type = pt.plan_payterm_type
                                
                                join TB_MMLFCP_PLAN_COVERAGE pc 
                                    on p.plan_id = pc.plan_id 
                                    and pc.use_yn = 'Y'
    
                                -- 공통코드: 상품유형
                                join TB_COMM_CD c1 
                                    on p.plan_type = c1.CD_ID 
                                    and c1.UPP_CD_ID = 'MMLFCP_A' 
                                    and c1.USE_YN = 'Y'
    
                                -- 공통코드: 납입타입 (p.plan_payterm_type과 직접 연결)
                                join TB_COMM_CD c2 
                                    on p.plan_payterm_type = c2.CD_ID 
                                    and c2.UPP_CD_ID = 'MMLFCP_B' 
                                    and c2.USE_YN = 'Y'
                                    where p.plan_type = @plan_type
                                ) b 
                                on a.company_code = b.company_code
                                and a.product_code = b.product_code
                                and a.coverage_cd = b.coverage_cd

                                join TB_MMLFCP_COVERAGE c 
                                    on a.coverage_cd = c.coverage_cd 
                                    and c.use_yn = 'Y'

                                join TB_TIC_PRDT d       
                                    on a.company_code = d.compy_cd 
                                    and a.product_code = d.prdt_cd 
                                    and d.use_yn = 'Y'

                                join TB_COMM_CD e        
                                    on a.company_code = e.CD_ID 
                                    and e.UPP_CD_ID = 'COMPY' 
                                    and e.USE_YN = 'Y'

                                where a.age = @age
                                    and a.gender = @gender

                                order by 
                                    a.company_code,
                                    plan_payterm_type_seq,
                                    b.plan_id,
                                    b.coverage_seq ";
                
                using var connection = _context.CreateConnection();
                var rows = (await connection.QueryAsync<PaytermCoveragePremiumRow>(sql,new { plan_id = plan_id, plan_type = plan_type, plan_payterm_type, gender, age })).ToList();

                var result = BuildGroups(rows);

                _cachedPaytermCoveragePremiums[cacheKey] = result;
                _logger.LogInformation("GetPaytermCoveragePremiums cached for plan_id={plan_id}, plan_type={plan_type}, plan_payterm_type={plan_payterm_type},gender={gender}, age={baseAge}", plan_id, plan_type, plan_payterm_type,gender, age);
                return result;

            }
            finally
            {
                _paytermCoveragePremiumsLock.Release();
            }
        }

        //플랜별  만기 필수 보험료 조회
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

                                -- 1. 납입/만기 그룹화를 위한 CTE 구성
                                with CTE_PAYTERM as (
                                    select @plan_payterm_type as plan_payterm_type, 0 as seq
                                    union all
                                    select TOP 2 
                                        plan_payterm_type, 
                                        ROW_NUMBER() OVER (order by plan_id) as seq
                                    from TB_MMLFCP_PLAN
                                    where plan_type = @plan_type
                                        and pay_term = (select pay_term from TB_MMLFCP_PLAN where plan_id = @plan_id)
                                        and plan_payterm_type NOT IN ('02', @plan_payterm_type)
                                )

                                -- 2. 메인 쿼리 조회
                                    select
                                        a.company_code,
                                        g.CD_NM as company_name,
                                        a.product_code,
                                        d.prdt_name as product_name,
                                        d.attr1 as product_detail_name,
                                        d.mb_conditions as product_conditions,
                                        h.CD_NM  as pay_term,
                                        c.sex as gender,
                                        c.age,
                                        c.insur_cd,
                                        e.insur_nm,
                                        e.insur_bojang,
                                        f.min_insur_amount,
                                        -- 가입 금액 대비 필수 보험료 비례 계산 (0 나누기 방지)
                                        case when ISNULL(c.std_contract_amt, 0) > 0 then FLOOR((f.min_insur_amount * c.premium) / c.std_contract_amt) else 0 end as min_premium,
                                        c.std_contract_amt as contract_amount,
                                        c.premium

                                    from TB_MMLFCP_PLAN_PRODUCT a

                                    join TB_MMLFCP_PLAN b 
                                        on a.plan_id = b.plan_id
                                        and b.use_yn = 'Y'
                                        and b.plan_type = @plan_type

                                    join CTE_PAYTERM pt 
                                        on b.plan_payterm_type = pt.plan_payterm_type

                                    -- 가격 정보 (성별/나이 필터)
                                    join TB_TIC_PRDT_PRICE c 
                                        on a.company_code = c.compy_cd
                                        and a.product_code = c.prdt_cd
                                        and c.sex = @gender
                                        and c.age = @age
                                        and c.use_yn = 'Y'

                                    -- 상품 상세 마스터
                                    join TB_TIC_PRDT d 
                                        on c.compy_cd = d.compy_cd
                                        and c.prdt_cd = d.prdt_cd
                                        and d.use_yn = 'Y'

                                    -- 담보 상세 내역
                                    join TB_TIC_PRDT_D e 
                                        on c.compy_cd = e.compy_cd
                                        and c.prdt_cd = e.prdt_cd
                                        and c.insur_cd = e.insur_cd
                                        and e.use_yn='Y'

                                    -- 필수 가입 금액 규칙
                                    join TB_MMLFCP_PRODUCT_REQUIRED_RULES f 
                                        on c.compy_cd = f.company_code
                                        and c.prdt_cd = f.product_code
                                        and c.insur_cd = f.insur_cd

                                    -- 회사명 공통코드
                                    join TB_COMM_CD g 
                                        on a.company_code = g.CD_ID
                                        and g.UPP_CD_ID = 'COMPY'
                                        and g.USE_YN = 'Y'

                                    -- 납입타입 명칭 공통코드
                                    join TB_COMM_CD h 
                                        on b.plan_payterm_type = h.CD_ID
                                        and h.UPP_CD_ID = 'MMLFCP_B'
                                        and h.USE_YN = 'Y'

                                    where a.use_yn = 'Y'
                                    order by
                                        a.company_code,
                                        b.plan_payterm_type,
                                        c.insur_cd ";


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

        
        //무해지 및 간편보험료 조회
        public async Task<List<PaytermCoveragePremiumGroup>> GetSimplifiedCoveragePremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(plan_id, plan_type, plan_payterm_type, gender, age);

            if (_cachedSimplifiedCoveragePremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }

            // 1. plan_type에 따른 필터 그룹 결정
            var planTypeFilter = GetPlanTypeGroup(plan_type);

            await _simplifiedCoveragePremiumsLock.WaitAsync();

            try
            {
                if (_cachedSimplifiedCoveragePremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @"
                                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                                SET NOCOUNT ON;
                                
                                select
                                    b.company_code,
                                    e.CD_NM as company_name,
                                    b.plan_type,
                                    b.plan_name,
                                    b.product_code,
                                    d.prdt_name as product_name,
                                    d.attr1 as product_detail_name,
                                    d.mb_conditions as product_conditions,
                                    b.plan_payterm_type_name,
                                    b.coverage_cd,
                                    c.coverage_name,
                                    b.is_selected_coverage,
                                    b.coverage_seq,
                                    a.gender,
                                    a.age,
                                    b.guide_coverage_amount,
                                    -- 보험료 계산 (가이드 금액 대비 비례 계산)
                                    case when ISNULL(a.coverage_amount, 0) > 0 then FLOOR((b.guide_coverage_amount * a.premium) / a.coverage_amount) else 0 end as guide_coverage_premium,
                                    a.coverage_amount,
                                    a.premium,
                                    -- 만기 타입 정렬용 시퀀스
                                    case when b.plan_payterm_type = @plan_payterm_type then 0 else b.ORDER_SEQ end as plan_payterm_type_seq

                                from TB_MMLFCP_COVERAGE_PRICE a
                                join (
                                /* 서브쿼리 b: 플랜 및 기준 데이터 */
                                select
                                    p.plan_type,
                                    p.plan_name,
                                    pp.company_code,
                                    pp.product_code,
                                    p.plan_payterm_type,
                                    cd2.CD_NM as plan_payterm_type_name,
                                    pc.coverage_cd,
                                    pc.is_selected_coverage,
                                    pc.coverage_seq,
                                    pc.guide_coverage_amount,
                                    cd2.ORDER_SEQ
                               
                                from TB_MMLFCP_PLAN p
    
                                join TB_MMLFCP_PLAN_PRODUCT pp 
                                    on p.plan_id = pp.plan_id
    
                                join TB_MMLFCP_PLAN_COVERAGE pc 
                                    on p.plan_id = pc.plan_id 
                                    and pc.use_yn = 'Y'
    
                                -- 공통코드: 상품유형
                                join TB_COMM_CD cd1 
                                    on p.plan_type = cd1.CD_ID 
                                    and cd1.UPP_CD_ID = 'MMLFCP_A' 
                                    and cd1.USE_YN = 'Y'
    
                                -- 공통코드: 납입/만기타입
                                join TB_COMM_CD cd2 
                                    on p.plan_payterm_type = cd2.CD_ID 
                                    and cd2.UPP_CD_ID = 'MMLFCP_B' 
                                    and cd2.USE_YN = 'Y'
                                    where pp.use_yn = 'Y'
                                     and p.plan_payterm_type = @plan_payterm_type
                                ) b 
                                on a.company_code = b.company_code
                                and a.product_code = b.product_code
                                and a.coverage_cd = b.coverage_cd

                                join TB_MMLFCP_COVERAGE c 
                                    on a.coverage_cd = c.coverage_cd 
                                    and c.use_yn = 'Y'

                                join TB_TIC_PRDT d       
                                    on a.company_code = d.compy_cd  
                                    and a.product_code = d.prdt_cd  
                                    and d.use_yn = 'Y'

                                join TB_COMM_CD e        
                                    on a.company_code = e.CD_ID   
                                    and e.UPP_CD_ID = 'COMPY'  
                                    and e.USE_YN = 'Y'

                                where a.age = @age
                                    and a.gender = @gender
                                    and b.plan_type in @planTypeFilter

                                order by 
                                    case when b.plan_type = @plan_type then 0 else 1 end,
                                    b.company_code,
                                    b.plan_type,
                                    b.coverage_seq ";

                    using var connection = _context.CreateConnection();
                    var rows = (await connection.QueryAsync<PaytermCoveragePremiumRow>(sql, new { plan_id,plan_type, plan_payterm_type,gender,age, planTypeFilter })).ToList(); // 리스트 전달

                // 2. ⭐ 죠르디러버님이 찾던 그 '쭈루루룩' 정렬!
                var sortedRows = rows
                    .OrderBy(r => r.company_code)             // 1순위: 회사코드별로 뭉치기 (DB끼리, HA끼리...)
                    .ThenBy(r => r.plan_type == plan_type ? 0 : 1) // 2순위: 그 회사 안에서 내가 선택한 타입 먼저!
                    .ThenBy(r => r.plan_type)                // 3순위: 그다음 나머지 타입 번호순
                    .ToList();

                var result = BuildGroups(sortedRows);
                _cachedSimplifiedCoveragePremiums[cacheKey] = result;
                _logger.LogInformation("GetSimplifiedCoveragePremiums cached for plan_id={plan_id}, plan_type={plan_type}, plan_payterm_type={plan_payterm_type},gender={gender}, age={baseAge}", plan_id, plan_type, plan_payterm_type, gender, age);
                return result;
            }
            finally
            {
                _simplifiedCoveragePremiumsLock.Release();
            }
        }

        //무해지 및 간편 상세보험료 조회
        public async Task<List<InsurProductDto>> GetSimplifiedCoverageInsurPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(plan_id, plan_type, plan_payterm_type, gender, age);

            if (_cachedSimplifiedInsurCoveragePremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }

            // 1. plan_type에 따른 필터 그룹 결정
            var planTypeFilter = GetPlanTypeGroup(plan_type);

            await _simplifiedCoverageInsurPremiumsLock.WaitAsync();

            try
            {
                if (_cachedSimplifiedInsurCoveragePremiums.TryGetValue(cacheKey, out cachedData))
                {
                    return cachedData;
                }

                string sql = @" SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                                    SET NOCOUNT ON;

                                    with BaseCoverage as (
                                    -- 기준 플랜의 담보 구성을 먼저 추출 (cte 별칭은 의미 전달을 위해 유지하거나 내부 별칭만 변경)
                                    select a.coverage_cd, b.insur_cd, b.guide_insur_amount as contract_amount
                                    from TB_MMLFCP_PLAN_COVERAGE a
	                                    join TB_MMLFCP_COVERAGE_INSUR_MAPPING b 
	                                    on a.coverage_cd = b.coverage_cd
                                    where a.plan_id = @plan_id
	                                    and a.use_yn = 'Y'
                                    )
                                    select 
                                    d.compy_cd as company_code,
                                    d.prdt_cd as product_code,
                                    e.prdt_name as product_name,
                                    e.attr1 as product_detail_name,
                                    e.mb_conditions as product_conditions,
                                    c.coverage_cd,
                                    f.pay_term,
                                    d.sex as gender,
                                    d.age,
                                    d.insur_cd,
                                    f.insur_nm,
                                    f.insur_bojang,
                                    c.contract_amount as guide_contract_amount,
                                    case when ISNULL(d.std_contract_amt,0) > 0  then FLOOR((c.contract_amount * d.premium) / d.std_contract_amt)  else 0  end as guide_premium,
                                    -- 보험료 계산 (나누기 0 방지)
                                    c.contract_amount as contract_amount,
                                    case when ISNULL(d.std_contract_amt,0) > 0  then FLOOR((c.contract_amount * d.premium) / d.std_contract_amt)  else 0  end as premium

                                    from TB_MMLFCP_PLAN a

                                    -- 1. 플랜 정보 (a)
                                    join TB_MMLFCP_PLAN_PRODUCT b 
                                        on a.plan_id = b.plan_id

                                    -- 2. 기준 담보 정보 (c)
                                    join BaseCoverage c 
                                        on 1 = 1

                                    -- 3. 대형 가격 테이블 (d)
                                    join TB_TIC_PRDT_PRICE d 
                                        on b.company_code = d.compy_cd 
                                        and b.product_code = d.prdt_cd 
                                        and c.insur_cd = d.insur_cd
                                        and d.sex = @gender 
                                        and d.age = @age
                                        and d.use_yn = 'Y'

                                    -- 4. 마스터 테이블들 (e, f, g, h)
                                    join TB_TIC_PRDT e 
                                        on d.compy_cd = e.compy_cd 
                                        and d.prdt_cd = e.prdt_cd
                                        and e.use_yn='Y'

                                    join TB_TIC_PRDT_D f 
                                        on d.compy_cd = f.compy_cd 
                                        and d.prdt_cd = f.prdt_cd 
                                        and d.insur_cd = f.insur_cd
                                        and f.use_yn='Y'

                                    join TB_COMM_CD g 
                                        on g.upp_cd_id = 'MMLFCP_B' 
                                        and g.cd_id = a.plan_payterm_type 
                                        and g.use_yn ='Y'

                                    where
                                            a.plan_type in @planTypeFilter
                                            and a.plan_payterm_type = @plan_payterm_type 
                                            and a.use_yn='Y'
                               
                                    order by 
                                        case when a.plan_type=@plan_type then 0 else 1 end,
                                        a.plan_type,
                                        d.compy_cd, 
                                        c.coverage_cd,
                                        d.insur_cd ";

                using (var connection = _context.CreateConnection())
                {
                    var raw = (await connection.QueryAsync<InsurCDPremiumEntity>(sql, new { plan_id, plan_type, plan_payterm_type, gender, age, planTypeFilter })).ToList(); //리스트 전달

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
                        }).ToList()
                    }).OrderBy(x => x.company_code).ToList();

                 _cachedSimplifiedInsurCoveragePremiums[cacheKey] = grouped;
                 _logger.LogInformation("GetSimplifiedCoverageInsurPremiums cached for plan_id={plan_id}, plan_type={plan_type}, plan_payterm_type={plan_payterm_type},gender={gender}, age={baseAge}", plan_id, plan_type, plan_payterm_type, gender, age);
                    return grouped;
                }
            }
            finally
            {
                _simplifiedCoverageInsurPremiumsLock.Release();
            }
        }


        //무해지 및 간편 필수보험료 조회
        public async Task<List<RequiredInsurCDPremiumEntity>> GetSimplifiedRequiredPremiums(string plan_id, string plan_type, string plan_payterm_type, string gender, int age)
        {
            var cacheKey = new PaytermPremiumCacheKey(plan_id, plan_type, plan_payterm_type, gender, age);

            if (_cachedSimplifiedRequiredPremiums!.TryGetValue(cacheKey, out var cachedData))
            {
                return cachedData;
            }

            // 1. plan_type에 따른 필터 그룹 결정
            var planTypeFilter = GetPlanTypeGroup(plan_type);

            await _simplifiedRequiredPremiumsLock.WaitAsync();

            try
            {
                string sql = @"
                                SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
                                SET NOCOUNT ON;
                                -- 1. 메인 쿼리 조회
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
                                    case when ISNULL(c.std_contract_amt,0) > 0 then FLOOR((f.min_insur_amount * c.premium) / c.std_contract_amt) else 0 end as min_premium,
                                    c.std_contract_amt  as contract_amount,
                                    c.premium

                                    from TB_MMLFCP_PLAN_PRODUCT a

                                    join TB_MMLFCP_PLAN b
                                        on a.plan_id = b.plan_id
                                        and b.use_yn = 'Y'

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
                                        and e.use_yn='Y'

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
                                        and a.company_code in (select a.company_code from TB_MMLFCP_PLAN_PRODUCT where plan_id = @plan_id and use_yn='Y')
                                        and b.plan_payterm_type = @plan_payterm_type
                                        and b.plan_type IN  @planTypeFilter
                                  order by
                                      --여기 추가
                                    case when b.plan_type=@plan_type then 0 else 1 end,
                                    a.company_code,
                                    a.product_code,
                                    b.plan_payterm_type,
                                    c.insur_cd
                ";

                using (var connection = _context.CreateConnection())
                {
                    var premiums = (await connection.QueryAsync<RequiredInsurCDPremiumEntity>(sql, new { plan_id = plan_id, plan_type = plan_type, plan_payterm_type = plan_payterm_type, gender = gender, age = age, planTypeFilter })).ToList();
                    _cachedSimplifiedRequiredPremiums[cacheKey] = premiums;
                    _logger.LogInformation("GetSimplifiedRequiredPremiums cached for plan_id={plan_id}, plan_type={plan_type}, plan_payterm_type={plan_payterm_type}, gender={gender}, age={baseAge}", plan_id, plan_type, plan_payterm_type, gender, age);
                    return premiums;
                }

            }
            finally
            {
                _simplifiedRequiredPremiumsLock.Release();
            }
        }

        //출력 한장보험료조회
        public async Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsAsync(PrintProductsRequest request)
        {
            // DataTable 생성
            var coverageDataTable = request.CoveragesToDataTable();
            var companyDataTable = request.CompanysToDataTable();

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
                        .GroupBy(r => new { r.company_code, r.product_code, r.plan_type, r.plan_payterm_type })
                        .Select(g => new PrintProductCoverage
                        {
                            company_code = g.Key.company_code,
                            company_name = g.First().company_name,
                            product_code = g.Key.product_code,
                            product_name = g.First().product_name,
                            plan_type = g.Key.plan_type,
                            plan_type_name = g.First().plan_type_name,
                            plan_payterm_type = g.Key.plan_payterm_type,
                            plan_payterm_type_name = g.First().plan_payterm_type_name,

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

        //출력 만기별 보험료 조회
        public async Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByPaymentsAsync(
               PrintProductsRequest request)
        {
            // DataTable 생성
            var coverageDataTable = request.CoveragesToDataTable();
            var companyDataTable = request.CompanysToDataTable();
            //var planPaymentExpirationTable = request.PlanPaymentExpirationsToDataTable();
            
            using (var connection = _context.CreateConnection())
            {
                var rawResults = await connection.QueryAsync<PrintRawCoverageData>(
                    "mmlfcp_get_printdata_detail",
                    new
                    {
                        plan_id = request.plan_id,
                        gender = request.gender,
                        age = request.age,
                        coverage_table = coverageDataTable,
                        company_table = companyDataTable
                     //   payterm_type_table = planPaymentExpirationTable,
                    }
                );

                var groupedResults = rawResults
                        .GroupBy(r => new { r.company_code,  r.product_code, r.plan_type,r.plan_payterm_type })
                        .Select(g => new PrintProductCoverage
                        {
                            company_code = g.Key.company_code,
                            company_name = g.First().company_name,
                            product_code = g.Key.product_code,
                            product_name = g.First().product_name,
                            plan_type = g.Key.plan_type,
                            plan_type_name = g.First().plan_type_name,
                            plan_payterm_type = g.Key.plan_payterm_type,
                            plan_payterm_type_name = g.First().plan_payterm_type_name,

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

        //출력 연령별 보험료 조회
        public async Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByAgeAsync(
       PrintProductsRequest request)
        {
            // DataTable 생성
            var coverageDataTable = request.CoveragesToDataTable();
            var companyDataTable = request.CompanysToDataTable();

            List<PrintProductCoverage> rtn = new List<PrintProductCoverage>();

            List<PrintRawCoverageData> printRawCoverageDatas = new List<PrintRawCoverageData>();
             List<PrintProductByInAge> printProductByInAges = new List<PrintProductByInAge>();  

            using (var connection = _context.CreateConnection())
            {

                using (var multi = await connection.QueryMultipleAsync(
                    "mmlfcp_get_printdata_detail_age",
                    new
                    {
                        plan_id = request.plan_id,
                        gender = request.gender,
                        age = request.age,
                        coverage_table = coverageDataTable,
                        company_table = companyDataTable
                    },
                    commandType: CommandType.StoredProcedure)) 
                {
                    //첫번째 결과셋
                    printRawCoverageDatas = multi.Read<PrintRawCoverageData>().ToList();
                    //두번째 결과셋
                    printProductByInAges = multi.Read<PrintProductByInAge>().ToList();

                    //나이별 보험료 데이터와 연동해서 최종 결과 생성
                   rtn =              printRawCoverageDatas
                                     .GroupBy(r => new { r.company_code, r.product_code, r.plan_type, r.plan_payterm_type })
                                     .Select(g => new PrintProductCoverage
                                     {
                                         company_code = g.Key.company_code,
                                         company_name = g.First().company_name,
                                         product_code = g.Key.product_code,
                                         product_name = g.First().product_name,
                                         plan_type = g.Key.plan_type,
                                         plan_type_name = g.First().plan_type_name,
                                         plan_payterm_type = g.Key.plan_payterm_type,
                                         plan_payterm_type_name = g.First().plan_payterm_type_name,

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
                                         ),

                                         printProductByInAges = printProductByInAges.Where(p => p.company_code == g.Key.company_code && p.product_code == g.Key.product_code)
                                                             .Select(p => new PrintProductByInAge
                                                             {
                                                                 company_code = p.company_code,
                                                                 product_code = p.product_code,
                                                                 product_name = p.product_name,
                                                                 insu_age = p.insu_age,
                                                                 premium = p.premium
                                                             })
                                                             .OrderBy(x => x.insu_age)
                                                             .ToList()
                                     })
                                     .ToList();

                }




                return rtn;
            }
        }

        //출력 플랜(상품)유형별 보험료 조회
        public async Task<List<PrintProductCoverage>> GetPrintProductCoveragePremiumsByPlanTypeAsync(
               PrintProductsRequest request)
        {
            // DataTable 생성
            var coverageDataTable = request.CoveragesToDataTable();
            var companyDataTable = request.CompanysToDataTable();
            var planPaymentExpirationTable = request.PlanPaymentExpirationsToDataTable();

            using (var connection = _context.CreateConnection())
            {
                var rawResults = await connection.QueryAsync<PrintRawCoverageData>(
                    "mmlfcp_get_printdata_detail_producttype",
                    new
                    {
                        plan_id = request.plan_id,
                        gender = request.gender,
                        age = request.age,
                        coverage_table = coverageDataTable,
                        company_table = companyDataTable
                    }
                );

                var groupedResults = rawResults
                        .GroupBy(r => new { r.company_code, r.product_code, r.plan_type, r.plan_payterm_type })
                        .Select(g => new PrintProductCoverage
                        {
                            company_code = g.Key.company_code,
                            company_name = g.First().company_name,
                            product_code = g.Key.product_code,
                            product_name = g.First().product_name,
                            plan_type = g.Key.plan_type,
                            plan_type_name = g.First().plan_type_name,
                            plan_payterm_type = g.Key.plan_payterm_type,
                            plan_payterm_type_name = g.First().plan_payterm_type_name,

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


        public async Task<Boolean> SaveEventlog(String agency_company_cd, String consultant_id, string event_id,string event_detail = "1")
        {
            try
            {
                String qry = @"
                     SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED
                     SET NOCOUNT ON
                        insert into tb_mmlfcp_event_log(consultant_id,ga_id,event_id,event_detail)   
                                       values (@consultant_id,@ga_id,@event_id,@event_detail) 
                ";
                using (var connection = _context.CreateConnection())
                {
                    await connection.ExecuteAsync(qry,
                            new
                            {
                                consultant_id = consultant_id,
                                ga_id = agency_company_cd,
                                event_id = event_id,
                                event_detail = event_detail
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

        public async Task<Boolean> IsUserRestricted(string ga_id, String consultant_id, String app_id)
        {

            bool rtn = false;

            String qry = @"
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET NOCOUNT ON;
            select ga_id,consultant_id,app_id,start_date  from TB_USER_RESTRICTIONS
            where 
	            ga_id = @ga_id and consultant_id = @consultant_id  and app_id = @app_Id
	            and end_date > getdate()
            ";

            using (var connection = _context.CreateConnection())
            {

                var db_retrun = await connection.QueryAsync<UserRestrictEntity>(qry,
                                                new
                                                {
                                                    ga_id = ga_id,
                                                    consultant_id = consultant_id,
                                                    app_id = app_id
                                                },
                                                commandType: CommandType.Text);

                if (db_retrun.ToList().Count > 0)
                {
                    rtn = true;
                }
            }

            return rtn;
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


        //plan_type 가져오는 함수
        private List<string> GetPlanTypeGroup(string plan_type)
        {
            return plan_type switch
            {
                "01" or "02" or "03" or "04" => new List<string> { "01", "02", "03", "04" },
                "05" or "06" or "07" or "14" or "15" or "16" or "17" => new List<string> { "05", "06", "07", "14", "15", "16", "17" },
                "09" or "11" or "12" or "13" => new List<string> { "09", "11", "12", "13" },
                "18" or "19" => new List<string> { "18", "19" },
                "20" or "21" or "22" => new List<string> { "20", "21", "22" },
                _ => new List<string> { plan_type } // 정의되지 않은 경우 자기 자신만 조회
            };
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
                        plan_type = first.plan_type,
                        plan_name = first.plan_name,
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
    }
}
