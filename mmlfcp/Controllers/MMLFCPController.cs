using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using mmlfcp.Models;
using mmlfcp.Repository;
using mmlfcp.Common;

namespace mmlfcp.Controllers
{
    [ApiController]
    public class MMLFCPController : ControllerBase
    {
        private readonly IMMLFCPRepository _repository;
        private readonly ILogger<MMLFCPController> _logger;

        public MMLFCPController(IMMLFCPRepository repository, ILogger<MMLFCPController> logger)
        {
            _repository = repository;
            _logger = logger;
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
                var clientIP = Utility.GetIPAddress(HttpContext);
                
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
        /// <param name="access_path">접근 경로</param>
        /// <returns>인증 결과 및 플랜 목록</returns>
        [HttpGet]
        [Route("api/Auth")]
        public async Task<ActionResult<AuthResponse>> AuthenticateUser(
            [FromQuery] string token, 
            [FromQuery] string access_path)
        {
            try
            {
                _logger.LogInformation("사용자 인증 요청 - Token: {Token}, AccessPath: {AccessPath}", 
                    token, access_path);

                // TODO: 실제 토큰 검증 로직 구현 필요
                // 현재는 임시로 토큰이 존재하면 인증 성공으로 처리
                if (string.IsNullOrEmpty(token))
                {
                    return Ok(new AuthResponse
                    {
                        is_success = false,
                        error_message = "토큰이 필요합니다.",
                        plans = new List<PlanEntity>()
                    });
                }

                // 플랜 목록 조회
                var plans = await _repository.GetPlansAsync();

                return Ok(new AuthResponse
                {
                    is_success = true,
                    error_message = "",
                    plans = plans.ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 인증 중 오류 발생");
                return Ok(new AuthResponse
                {
                    is_success = false,
                    error_message = "인증 처리 중 오류가 발생했습니다.",
                    plans = new List<PlanEntity>()
                });
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

                // 데이터 조회
                var guideCoverages = await _repository.GetGuideCoveragesByPlanIdAsync(plan_id);
                var insurCDPremiums = await _repository.GetProductInsurCDPremiumsAsync(plan_id, gender, age);
                var requiredPremiums = await _repository.GetRequiredInsurCDPremiumsAsync(plan_id, gender, age);

                return Ok(new ProductPremiumsResponse
                {
                    is_success = true,
                    error_message = "",
                    plan_coverages = guideCoverages.ToList(),
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

                return Ok(new ProductPremiumsByAgesResponse
                {
                    is_success = true,
                    error_message = "",
                    coverage_premiums_by_ages = coveragePremiums.ToList()
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
    }
}