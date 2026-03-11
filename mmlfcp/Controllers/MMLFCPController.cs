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
                        ErrorCode = 2005,
                        ErrorMessage = "JWT  토큰 누락"
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
                    ErrorCode = 2009,
                    ErrorMessage = "JWT 토큰 검증 실패."
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
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "토큰 누락"
                    });
                }
                string remoteip = Utility.GetIPAddress(HttpContext);
                AuthEntity AuthEntity = Utility.JWTVerifying(token, remoteip);

                if (AuthEntity.ErrorCode != 0)
                {
                    return Unauthorized(new CommonErrorResponse
                    {
                        code = AuthEntity.ErrorCode.ToString(),
                        message = AuthEntity.ErrorMessage
                    });

                }
                if (String.IsNullOrEmpty(AuthEntity.ConsultantID) == true || String.IsNullOrEmpty(AuthEntity.AgencyCompanyCD) == true)
                {
                    return Unauthorized(new CommonErrorResponse
                    {
                        code = "2002",
                        message = "사용자 확인 불가."
                    });
                }

                //consultant_id, ga_id 추가
                response.consultant_id = AuthEntity.ConsultantID;
                response.ga_id = AuthEntity.AgencyCompanyCD;


                // 플랜 목록 조회
                var plans = await _repository.GetPlansAsync();
                response.plans = plans.ToList();

                await _repository.SaveEventlog(AuthEntity.AgencyCompanyCD, AuthEntity.ConsultantID, event_id);

                return Ok(response);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 인증 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "사용자 인증 중 오류 발생"
                });
            }
        }

        /// <summary>
        /// 플랜 기준 상품 보험료 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="age">나이</param>
        /// <param name="insurance_type">생손보 유형</param>
        /// <param name="gender">성별</param>
        /// <returns>플랜별 기준보장, 상품별 담보별, 필수보험료 정보</returns>
        [HttpGet]
        [Route("api/ProductPremiums")]
        public async Task<ActionResult<ProductPremiumsResponse>> GetProductPremiums([FromQuery] string plan_id, [FromQuery] string insurance_type, [FromQuery] int age, [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Unauthorized(new CommonErrorResponse
                    {
                        code = authResult.ErrorCode.ToString(),
                        message = authResult.ErrorMessage
                    });
                }

                _logger.LogInformation("상품 보험료 조회 요청 - PlanId: {plan_id}, Age: {age}, Gender: {gender}", plan_id, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터 누락"
                    });
                }
                string remoteip = Utility.GetIPAddress(HttpContext);


                //exception company
                var exceptionCompanyCodes = (await _repository.GetExcpCompanysAsync(authResult.AgencyCompanyCD)).Select(e => e.company_code).ToHashSet();
                // 데이터 조회
                var guideCoverages = await _repository.GetGuideCoveragesByPlanIdAsync(plan_id);  //플랜별기준보장 데이터 - 화면 왼쪽
                var coveragePremiums = await _repository.GetProductCoveragePremiumsAsync(plan_id, gender, age); //플랜  상품별 / 보장별 보험료
                var insurCDPremiums = await _repository.GetProductInsurCDPremiumsAsync(plan_id, gender, age); //플랜 상품별/ 담보별 보험료
                var requiredPremiums = insurance_type == "LF" ? await _repository.GetRequiredInsurCDPremiumsAsync(plan_id, gender, age) :  new List<RequiredInsurCDPremiumEntity>();//필수 보험료 조회

                //string plan_id, String ga_id, String consultant_id
                var userCoverages = await _repository.GetUserCoverageAsync(authResult.AgencyCompanyCD, authResult.ConsultantID); //사용자 플랜 조회


                await _repository.SaveAccesslog(
                    authResult.AgencyCompanyCD,
                    authResult.ConsultantID,
                    remoteip,
                    plan_id, gender, age);

                if (exceptionCompanyCodes.Count > 0)
                {

                    coveragePremiums = coveragePremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                   
                    insurCDPremiums = insurCDPremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();

                    // 데이터가 있을 때만 필터링 (LF가 아니면 빈 리스트라 에러 안 나요)
                    if (requiredPremiums != null && requiredPremiums.Any())
                    {
                        requiredPremiums = requiredPremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                    }
                }

                return Ok(new ProductPremiumsResponse
                {
                    is_success = true,
                    error_message = "",
                    plan_coverages = guideCoverages,
                    coverage_premiums = coveragePremiums,
                    product_insur_premiums = insurCDPremiums,
                    required_premiums = requiredPremiums,
                    user_coverages = userCoverages
                });

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "상품 보험료 조회 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "상품 보험료 조회 중 오류가 발생했습니다."
                });
            }
        }


        /// <summary>
        /// 플랜 연령별 보험료 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="insurance_type">생손보 유형</param>
        /// <param name="age">기준 나이</param>
        /// <param name="gender">성별</param>
        /// <returns>연령별 보장별 보험료 정보</returns>
        [HttpGet]
        [Route("api/ProductPremiumsByAges")]
        public async Task<ActionResult<ProductPremiumsByAgesResponse>> GetProductPremiumsByAges([FromQuery] string plan_id, [FromQuery] string insurance_type, [FromQuery] int age, [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Unauthorized(new CommonErrorResponse
                    {
                        code = authResult.ErrorCode.ToString(),
                        message = authResult.ErrorMessage
                    });
                }

                _logger.LogInformation("연령별 보험료 조회 요청 - PlanId: {PlanId}, Age: {Age}, Gender: {Gender}",
                    plan_id, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터 누락"
                    });
                }

                //exception company
                List<ExceptionCompanyEntity> exceptionCompanies = (await _repository.GetExcpCompanysAsync(authResult.AgencyCompanyCD)).ToList();


                var coveragePremiums = await _repository.GetCoveragePremiumsByAgesAsync(plan_id, gender, age);   // 연령별 대표 보험료 데이터 조회
                var coverage_required_premiums_by_ages = insurance_type == "LF" ? await _repository.GetRequiredInsurCDPremiumsByAgesAsync(plan_id, gender, age) : new List<RequiredInsurGrouped>(); ; //  연령별 필수 보험료 조회


                if (exceptionCompanies != null && exceptionCompanies.Any())
                {
                    var exceptionCompanyCodes = exceptionCompanies.Select(e => e.company_code).ToHashSet();

                    coveragePremiums = coveragePremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();

                    if (coverage_required_premiums_by_ages != null && coverage_required_premiums_by_ages.Any())
                    {
                        coverage_required_premiums_by_ages = coverage_required_premiums_by_ages.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                    }
                }


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
                _logger.LogError(ex, "만기별 보험료 조회 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "만기별 보험료 조회 중 오류가 발생했습니다."
                });
            }
        }



        /// <summary>
        /// 만기별 보험료 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="plan_type">상품 유형</param>
        /// <param name="insurance_type">생손보 유형</param>
        /// <param name="plan_payterm_type">만기 유형/param>
        /// <param name="age">기준 나이</param>
        /// <param name="gender">성별</param>
        /// <returns>만기별 보험료 정보</returns>
        [HttpGet]
        [Route("api/PaytermCoveragePremiums")]
        public async Task<ActionResult<ProductPaytermPremiumsByAgesResponse>> GetPaytermCoveragePremiums([FromQuery] string plan_id, [FromQuery] string plan_type, [FromQuery] string insurance_type, [FromQuery] string plan_payterm_type, [FromQuery] int age, [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Ok(new ProductPaytermPremiumsByAgesResponse
                    {
                        code = authResult.ErrorCode.ToString(),
                        message = authResult.ErrorMessage
                    });
                }
                _logger.LogInformation("만기별 보험료 조회 요청 - PlanId: {plan_id}, PlanType: {plan_type}, InsuranceType:{insurance_type}, PlanPaytermType:{plan_payterm_type},Age: {age}, Gender: {gender}", plan_id, plan_type, insurance_type,plan_payterm_type, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터가 누락되었습니다."
                    });
                }
                string remoteip = Utility.GetIPAddress(HttpContext);

                //exception company
                var exceptionCompanyCodes = (await _repository.GetExcpCompanysAsync(authResult.AgencyCompanyCD)).Select(e => e.company_code).ToHashSet();
                
                var paytermcoveragePremiums = await _repository.GetPaytermCoveragePremiums(plan_id, plan_type, plan_payterm_type, gender, age); //만기별 보험료 조회
                var paytermrequiredPremiums = insurance_type == "LF" ? await _repository.GetPaytermRequiredPremiums(plan_id, plan_type, plan_payterm_type, gender, age) : new List<RequiredInsurCDPremiumEntity>(); //만기별 필수보험료 조회
                
                await _repository.SaveAccesslog(authResult.AgencyCompanyCD,authResult.ConsultantID, remoteip, plan_id, gender, age);

                if (exceptionCompanyCodes.Count > 0)
                {
                    paytermcoveragePremiums = paytermcoveragePremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();

                    if(paytermrequiredPremiums != null && paytermrequiredPremiums.Any())
                    {
                        paytermrequiredPremiums = paytermrequiredPremiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                    }
                }
                
                return Ok(new ProductPaytermPremiumsByAgesResponse
                {
                    is_success = true,
                    error_message = "",
                    payterm_coverage_premiums = paytermcoveragePremiums,
                    payterm_required_coverage_premiums = paytermrequiredPremiums
                });
            }
            catch (Exception ex)
            {

                _logger.LogError(ex, "무해지 및 간편보험료 조회 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "무해지 및 간편보험료 조회 중 오류가 발생했습니다."
                });
            }
        }


        /// <summary>
        /// 무해지 및 간편보험료 비교 조회
        /// </summary>
        /// <param name="plan_id">플랜 ID</param>
        /// <param name="plan_type">상품 유형</param>
       /// <param name="insurance_type">생손보 유형</param>
        /// <param name="plan_payterm_type">만기 유형/param>
        /// <param name="age">기준 나이</param>
        /// <param name="gender">성별</param>
        /// <returns>무해지 및 간편보험료 정보</returns>

        //무해지 및 간편보험료 비교
        [HttpGet]
        [Route("api/PlanCoveragePremiumComparison")]
        public async Task<ActionResult<SimplifiedPremiumResponse>> GetPlanCoveragePremiumsComparison([FromQuery] string plan_id, [FromQuery] string plan_type, [FromQuery] string insurance_type,[FromQuery] string plan_payterm_type, [FromQuery] int age, [FromQuery] string gender)
        {
            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
<                    return Unauthorized(new CommonErrorResponse
                    {
                        code = "2002",
                        message = "사용자 확인 불가."
                    });
                }
                _logger.LogInformation("무해지 및 간편보험료 조회 요청 - PlanId: {plan_id}, PlanType: {plan_type}, InsuranceType:{insurance_type}, PlanPaytermType:{plan_payterm_type},Age: {age}, Gender: {gender}", plan_id, plan_type, insurance_type,plan_payterm_type, age, gender);

                // 입력값 검증
                if (string.IsNullOrEmpty(plan_id) || string.IsNullOrEmpty(gender))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터가 누락되었습니다."
                    });

                }
                string remoteip = Utility.GetIPAddress(HttpContext);

                //exception company
                var exceptionCompanyCodes = (await _repository.GetExcpCompanysAsync(authResult.AgencyCompanyCD)).Select(e => e.company_code).ToHashSet();

                var simplified_coverage_premiums = await _repository.GetSimplifiedCoveragePremiums(plan_id, plan_type, plan_payterm_type, gender, age); //무해지 및 간편보험료 조회
                var simplified_coverage_insur_premiums = await _repository.GetSimplifiedCoverageInsurPremiums(plan_id, plan_type, plan_payterm_type, gender, age);
                var simplified_required_coverage_premiums = insurance_type == "LF" ?  await _repository.GetSimplifiedRequiredPremiums(plan_id, plan_type, plan_payterm_type, gender, age) : new List<RequiredInsurCDPremiumEntity>(); ;//무해지 및 간편 필수보험료 조회

                await _repository.SaveAccesslog(authResult.AgencyCompanyCD, authResult.ConsultantID, remoteip, plan_id, gender, age);

                if (exceptionCompanyCodes.Count > 0)
                {
                    simplified_coverage_premiums = simplified_coverage_premiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                    simplified_coverage_insur_premiums = simplified_coverage_insur_premiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();

                    if(simplified_required_coverage_premiums != null && simplified_required_coverage_premiums.Any())
                    {
                        simplified_required_coverage_premiums = simplified_required_coverage_premiums.Where(premium => !exceptionCompanyCodes.Contains(premium.company_code)).ToList();
                    }
                }

                return Ok(new SimplifiedPremiumResponse
                {
                    is_success = true,
                    error_message = "",
                    simplified_coverage_premiums = simplified_coverage_premiums,
                    simplified_coverage_insur_premiums = simplified_coverage_insur_premiums,
                    simplified_required_coverage_premiums = simplified_required_coverage_premiums
                });
            }
            catch(Exception ex)
            {
                _logger.LogError(ex, "연령별 보험료 조회 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "연령별 보험료 조회 중 오류가 발생했습니다."
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
        public async Task<ActionResult<PrintProductsResponse>> PrintProducts([FromBody] PrintProductsRequest request)
        {
            PrintProductsResponse response = new PrintProductsResponse();
            response.is_success = false;
            string event_id = "PRINT";
            // JWT 토큰 검증
            var authResult = ValidateJwtToken();
            if (authResult.ErrorCode != 0) 
            {
                return Unauthorized(new CommonErrorResponse
                {
                    code = authResult.ErrorCode.ToString(),
                    message = authResult.ErrorMessage
                });
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
                return BadRequest(new CommonErrorResponse
                {
                    code = "1001",
                    message = "필수 파라미터가 누락되었습니다."
                });

            }

            try
            {
                List<PrintProductCoverage> coverage_list = new List<PrintProductCoverage>();


                //0. 한장 , 1.납입-만기별 , 2.연령별 ,3 상품유형별
                if (request.print_gubun == 0) //한장
                {
                    coverage_list = await _repository.GetPrintProductCoveragePremiumsAsync(request);
                }
                else if (request.print_gubun == 1) //납입-만기별
                {
                    coverage_list = await _repository.GetPrintProductCoveragePremiumsByPaymentsAsync(request);
                }
                else if (request.print_gubun == 2) //연령별
                {
                    coverage_list = await _repository.GetPrintProductCoveragePremiumsByAgeAsync(request);
                }
                else if (request.print_gubun == 3) //플랜(상품)유형별
                {
                    /*
                    01  생손보 건강(무해지),02  생손보 간편3.3.5(무해지),03 생손보 간편3.5.5(무해지),04 생손보 간편3.10.10(5)(무해지)
                    05  손보 종합(표준환급),06  손보 종합(무해지),07   손보 5.10.10(무해지),14  손보 간편3.2.5(무해지),15  손보 간편3.3.5(무해지),16  손보 간편3.5.5(무해지),17  손보 간편3.10.10(5)(무해지),
		            09  생보 건강(무해지),11   생보 간편3.3.5(무해지),12  생보 간편3.5.5(무해지),13  생보 간편3.10.5(무해지),
		            18  손보 어린이(표준환급),19 손보 어린이(무해지)
                    20  손보 청소년(표준환급),21 손보 청소년(무해지),22  손보 청소년5.10.10(무해지)
                    */
                    if ("01,02,03,04,05,06,07,14,15,16,17,09,11,12,13,18,19,20,21,22".Contains(request.plan_type_id) == false)
                    {
                        response.error_message = "상품(플랜)유형을 확인 해 주세요";
                        return Ok(response);
                    }
                    coverage_list = await _repository.GetPrintProductCoveragePremiumsByPlanTypeAsync(request);
                }
                else //오류
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1003",
                        message = "출력 구분(print_gubun)은 0~3 사이의 값이어야 합니다."
                    });
                }

                response.pdf_uri = _reportService.MakePDFReport(authResult.AgencyCompanyCD, authResult.ConsultantID, request, coverage_list);
                
                await _repository.SaveEventlog(authResult.AgencyCompanyCD, authResult.ConsultantID, event_id);

                response.is_success = true;
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "출력 중 오류 예외 발생");

                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "출력 중 오류가 발생하였습니다."
                });
            }

        }



        //사용자 플랜 등록
        [HttpPost]
        [Route("api/AddUserCoverages")]
        public async Task<ActionResult<UserCoverageResponse>> AddUserCoverages([FromBody] UserCoverage request)
        {
            UserCoverageResponse response = new UserCoverageResponse();
            response.is_success = false;

            try
            {
                // JWT 토큰 검증
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    return Unauthorized(new CommonErrorResponse
                    {
                        code = authResult.ErrorCode.ToString(),
                        message = authResult.ErrorMessage
                    });
                }

                _logger.LogInformation("사용자 플랜 등록 요청  - ga_id: {ga_id}, consultant_id: {consultant_id}, user_plan_name: {user_plan_name}", request.ga_id, request.consultant_id, request.user_plan_name);

                // 입력값 검증
                if (string.IsNullOrEmpty(request.ga_id) || string.IsNullOrEmpty(request.consultant_id) || string.IsNullOrEmpty(request.user_plan_name))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터가 누락되었습니다."
                    });

                }

                var userCoverage = await _repository.AddUserCoverageAsync(request.ga_id, request.consultant_id, request);
                return Ok(new UserCoverageResponse
                {
                    is_success = true,
                    error_message = "",
                    userCoverage = userCoverage
                });

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 플랜 등록 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "사용자 플랜 등록 중 오류가 발생했습니다."
                });
            }
        }

        //사용자 플랜 삭제
        [HttpPost]
        [Route("api/UpdateUserCoverages")]
        public async Task<ActionResult<UserCoverageResponse>> UpdateUserCoverages([FromBody] UserCoverage request)
        {
            UserCoverageResponse response = new UserCoverageResponse();
            response.is_success = false;

            try
            {
                var authResult = ValidateJwtToken();
                if (authResult.ErrorCode != 0)
                {
                    // JWT 파싱된 ID 주입
                    request.ga_id = authResult.AgencyCompanyCD;
                    request.consultant_id = authResult.ConsultantID;

                    return Unauthorized(new CommonErrorResponse
                    {
                        code = authResult.ErrorCode.ToString(),
                        message = authResult.ErrorMessage
                    });

                }

                _logger.LogInformation("사용자 플랜 삭제 요청  - ga_id: {ga_id}, consultant_id: {consultant_id}, user_plan_name: {user_plan_name}", request.ga_id, request.consultant_id, request.user_plan_name);

                // 입력값 검증
                if (string.IsNullOrEmpty(request.consultant_id) || string.IsNullOrEmpty(request.user_plan_id.ToString()))
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1001",
                        message = "필수 파라미터가 누락되었습니다."
                    });
                }

                if (authResult.ConsultantID.Equals(request.consultant_id) == false)
                {
                    return BadRequest(new CommonErrorResponse
                    {
                        code = "1003",
                        message = "사용자 정보가 일치하지 않습니다."
                    });
                }

                var userCoverage = await _repository.UpdateUserCoverageAsync(request.consultant_id, request.user_plan_id);
                return Ok(new UserCoverageResponse
                {
                    is_success = true,
                    error_message = "",
                    userCoverage = userCoverage
                });

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "사용자 플랜 삭제 중 오류 발생");
                return StatusCode(500, new CommonErrorResponse
                {
                    code = "9999",
                    message = "사용자 플랜 삭제 중 오류가 발생했습니다."
                });
            }
        }


    }
}