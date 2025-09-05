using Azure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using mmlfcp.Common;
using mmlfcp.Models;
using mmlfcp.Repository;
using mmlfcp.Services;

namespace mmlfcp.Controllers
{
    [ApiController]
    public class MMLFCPController : ControllerBase
    {
        private readonly IMMLFCPRepository _repository;
        private readonly ILogger<MMLFCPController> _logger;
        private readonly ReportSevice _reportService; // Inject



        public MMLFCPController(IMMLFCPRepository repository, ReportSevice Ssrvice,ILogger<MMLFCPController> logger)
        {
            _repository = repository;
            _logger = logger;
            _reportService = Ssrvice;
        }

        /// <summary>
        /// JWT 토큰 검증 헬퍼 메서드
        /// </summary>
        /// <returns>인증 결과 AuthEntity 객체</returns>
        private AuthEntity ValidateJwtToken()
        {
            try
            {
                var authHeader = Request.Headers["Authorization"].FirstOrDefault();
                if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
                {
                    return new AuthEntity
                    {
                        ErrorCode = 100,
                        ErrorMessage = "Authorization 헤더가 없거나 형식이 잘못되었습니다."
                    };
                }

                var token = authHeader.Substring("Bearer ".Length).Trim();
                var clientIP = ""; // Utility.GetIPAddress(HttpContext);
                
                // Utility 클래스의 JWT 검증 메서드 사용
                var authResult = Utility.JWTVerifying(token, clientIP);
                
                if (authResult.ErrorCode == 0)
                {
                    _logger.LogInformation("JWT 토큰 검증 성공 - 사용자: {ConsultantName}", authResult.ConsultantName);
                }
                else
                {
                    _logger.LogWarning("JWT 토큰 검증 실패 - 오류코드: {ErrorCode}, 메시지: {ErrorMessage}", 
                        authResult.ErrorCode, authResult.ErrorMessage);
                }

                return authResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JWT 토큰 검증 중 예외 발생");
                return new AuthEntity
                {
                    ErrorCode = 100,
                    ErrorMessage = "토큰 검증 중 서버 오류가 발생했습니다."
                };
            }
        }

        /// <summary>
        /// 사용자 인증 및 플랜 목록 조회
        /// </summary>
        /// <param name="token">인증 토큰</param>
        /// <returns>인증 결과 및 플랜 목록</returns>
        [HttpGet]
        [Route("api/Auth")]
        public async Task<ActionResult<AuthResponse>> AuthenticateUser(
            [FromQuery] string token)
        {
            AuthResponse response = new AuthResponse();
            string event_id = "LOGINWEB"; //접근경로
            try
            {
                _logger.LogInformation($"사용자 인증 요청 - AccessPath:{event_id}");

                response.is_success = true;
                response.error_message = "";
                response.plans = new List<PlanEntity>();

                // TODO: 실제 토큰 검증 로직 구현 필요
                // 현재는 임시로 토큰이 존재하면 인증 성공으로 처리
                if (string.IsNullOrEmpty(token))
                {
                    response.is_success = false;
                    response.error_message = "토큰이 필요합니다.";
                    return Ok(response);
                }
                string remoteip = Utility.GetIPAddress(HttpContext);
                AuthEntity AuthEntity = Utility.JWTVerifying(token, remoteip);

                if (AuthEntity.ErrorCode != 0)
                {
                    response.is_success = false;
                    response.error_message = AuthEntity.ErrorMessage;
                    return Ok(response);
                }
                if (String.IsNullOrEmpty(AuthEntity.ConsultantID) == true || String.IsNullOrEmpty(AuthEntity.AgencyCompanyCD) == true)
                {
                    response.is_success = false;
                    response.error_message = "인증 중 오류가 발생하였습니다.(앱을 종료후 다시 실행하세요)";
                    return Ok(response);
                }

                // 플랜 목록 조회
                var plans = await _repository.GetPlansAsync();
                response.plans = plans.ToList();

                await _repository.SaveEventlog(AuthEntity.AgencyCompanyCD, AuthEntity.ConsultantID, event_id);

                return Ok(response);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 인증 중 오류 발생");
                response.is_success = false;
                response.error_message = "인증 중 오류가 발생하였습니다.";
                return Ok(response);
            }
        }

        /// <summary>
        /// 플랜 기준 상품 보험료 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="age">나이</param>
        /// <param name="gender">성별</param>
        /// <returns>플랜별 기준보장, 상품별 담보별, 필수보험료 정보</returns>
        [HttpGet]
        [Route("api/ProductPremiums")]
        public async Task<ActionResult<ProductPremiumsResponse>> GetProductPremiums(
            [FromQuery] string plan_id,
            [FromQuery] int age,
            [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Ok(new ProductPremiumsResponse
                    {
                        is_success = false,
                        error_message = authResult.ErrorMessage
                    });
                }

                _logger.LogInformation("상품 보험료 조회 요청 - PlanId: {PlanId}, Age: {Age}, Gender: {Gender}", 
                    plan_id, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return Ok(new ProductPremiumsResponse
                    {
                        is_success = false,
                        error_message = "필수 파라미터가 누락되었습니다."
                    });
                }
                string remoteip = Utility.GetIPAddress(HttpContext);

                // 데이터 조회
                var guideCoverages = await _repository.GetGuideCoveragesByPlanIdAsync(plan_id);  //플랜별기준보장 데이터 - 화면 왼쪽
                var coveragePremiums = await _repository.GetProductCoveragePremiumsAsync(plan_id, gender, age); //플랜  상품별 / 보장별 보험료
                var insurCDPremiums = await _repository.GetProductInsurCDPremiumsAsync(plan_id, gender, age); //플랜 상품별/ 담보별 보험료
                var requiredPremiums = await _repository.GetRequiredInsurCDPremiumsAsync(plan_id, gender, age);//필수 보험료 조회
                
                await _repository.SaveAccesslog(
                    authResult.AgencyCompanyCD,
                    authResult.ConsultantID,
                    remoteip,
                    plan_id, gender, age);


                return Ok(new ProductPremiumsResponse
                {
                    is_success = true,
                    error_message = "",
                    plan_coverages = guideCoverages.ToList(),
                    coverage_premiums = coveragePremiums.ToList(),
                    product_insur_premiums = insurCDPremiums.ToList(),
                    required_premiums = requiredPremiums.ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "상품 보험료 조회 중 오류 발생");
                return Ok(new ProductPremiumsResponse
                {
                    is_success = false,
                    error_message = "상품 보험료 조회 중 오류가 발생했습니다."
                });
            }
        }

        /// <summary>
        /// 플랜 연령별 보험료 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="age">기준 나이</param>
        /// <param name="gender">성별</param>
        /// <returns>연령별 보장별 보험료 정보</returns>
        [HttpGet]
        [Route("api/ProductPremiumsByAges")]
        public async Task<ActionResult<ProductPremiumsByAgesResponse>> GetProductPremiumsByAges(
            [FromQuery] string plan_id,
            [FromQuery] int age,
            [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Ok(new ProductPremiumsByAgesResponse
                    {
                        is_success = false,
                        error_message = authResult.ErrorMessage
                    });
                }

                _logger.LogInformation("연령별 보험료 조회 요청 - PlanId: {PlanId}, Age: {Age}, Gender: {Gender}", 
                    plan_id, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return Ok(new ProductPremiumsByAgesResponse
                    {
                        is_success = false,
                        error_message = "필수 파라미터가 누락되었습니다."
                    });
                }

                // 연령별 보험료 데이터 조회
                var coveragePremiums = await _repository.GetCoveragePremiumsByAgesAsync(plan_id, gender, age);
                var coverage_required_premiums_by_ages = await _repository.GetRequiredInsurCDPremiumsByAgesAsync(plan_id, gender, age);

                //GetRequiredInsurCDPremiumsAsync

                return Ok(new ProductPremiumsByAgesResponse
                {
                    is_success = true,
                    error_message = "",
                    coverage_premiums_by_ages = coveragePremiums.ToList(),
                    coverage_required_premiums_by_ages = coverage_required_premiums_by_ages.ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "연령별 보험료 조회 중 오류 발생");
                return Ok(new ProductPremiumsByAgesResponse
                {
                    is_success = false,
                    error_message = "연령별 보험료 조회 중 오류가 발생했습니다."
                });
            }
        }

        /// <summary>
        /// 플랜 기준 상품 보험료 조회
        /// </summary>
        /// <param name="request">플랜 ID</param>
        /// <returns>플랜별 기준보장, 상품별 담보별, 필수보험료 정보</returns>
        [HttpPost]
        [Route("api/PrintProducts")]
        public async Task<ActionResult<PrintProductsResponse>> PrintProducts(
            [FromBody] PrintProductsRequest request)
        {
            PrintProductsResponse response = new PrintProductsResponse();
            response.is_success = false;
            string event_id = "PRINT";
            // JWT 토큰 검증
            var authResult = ValidateJwtToken();
            if (authResult.ErrorCode != 0)
            {
                response.error_message = authResult.ErrorMessage;

                return Ok(response);
            }

            _logger.LogInformation("출력 - PlanId: {PlanId}, Age: {Age}, Gender: {Gender}",
                request.plan_id, request.age, request.gender);

            // 입력값 검증
            if (string.IsNullOrEmpty(request.plan_id) ||
                string.IsNullOrEmpty(request.gender) ||
                string.IsNullOrEmpty(request.is_required_coverage) ||
                request.company_codes?.Count <= 0 ||
                request.coverages?.Count <= 0)
            {
                response.error_message = "필수 파라미터가 누락되었습니다.";

                return Ok(response);

            }
            List<PrintProductCoverage> coverage_list = await _repository.GetPrintProductCoveragePremiumsAsync(request);


            response.pdf_uri = _reportService.MakePDFReport(authResult.AgencyCompanyCD, authResult.ConsultantID, request, coverage_list);

            await _repository.SaveEventlog(authResult.AgencyCompanyCD, authResult.ConsultantID, event_id);

            response.is_success = true;
            return Ok(response);
        }
    }
}