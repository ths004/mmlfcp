# MMLFCP — 보험료 비교 시스템

보험 컨설턴트가 다수 보험사의 보험료를 비교하고 PDF 리포트를 생성할 수 있는 웹 애플리케이션.

---

## 기술 스택

### Backend

| 구분 | 기술 |
|------|------|
| 런타임 | .NET 8.0 |
| 웹 프레임워크 | ASP.NET Core 8.0 |
| ORM | Dapper 2.1.66 |
| DB 드라이버 | Microsoft.Data.SqlClient 6.1.1 |
| 인증 | JWT 10.1.1 + Microsoft.AspNetCore.Authentication.JwtBearer 8.0.0 |
| 로깅 | Serilog 4.3.0 + Serilog.AspNetCore 9.0.0 + Serilog.Sinks.File 7.0.0 |
| API 문서 | Swashbuckle.AspNetCore (Swagger) 6.6.2 |
| PDF 생성 | ceTe.DynamicPDF.CoreSuite.NET 12.36.0 |

### Frontend

- Vanilla JavaScript (ES6 Modules) — 프레임워크 없음
- 컴포넌트 기반 구조 (수동 조립)
- 상태 관리: 커스텀 `mmlfcp_state` (localStorage 동기화)

### Database

- SQL Server (Dapper 직접 쿼리, 비동기 패턴)

---

## 프로젝트 구조

```
mmlfcp/
├── Program.cs                        # 서비스 등록 및 미들웨어 파이프라인
├── appsettings.json                  # DB 연결, 로그, PDF 템플릿 경로
├── appsettings.Development.json      # 개발 환경 오버라이드
├── mmlfcp.csproj                     # 패키지 의존성
│
├── Controllers/
│   └── MMLFCPController.cs           # 단일 컨트롤러 (전체 API 엔드포인트)
│
├── Models/
│   ├── ApiRequestModels.cs           # 요청 DTO (PrintProductsRequest 등)
│   ├── ApiResponseModels.cs          # 공통 응답 DTO (ApiResponse<T>)
│   ├── PlanEntity.cs                 # 보험 플랜 마스터
│   ├── PlanCoverageEntity.cs         # 플랜-담보 매핑
│   ├── CoveragePremiumEntity.cs      # 담보별 보험료
│   ├── InsurCDPremiumEntity.cs       # 보험종목별 보험료
│   ├── CoveragePremiumPaytermGroup.cs# 납입기간별 그룹
│   ├── RequiredInsurCDPremiumEntity.cs # 필수 담보 보험료 (생명 전용)
│   └── UserCoverageEntity.cs         # 사용자 저장 플랜
│
├── Repository/
│   └── MMLFCPRepository.cs           # Dapper 기반 데이터 접근 계층
│                                     # 3단계 인메모리 캐시 (플랜→담보→보험료)
│
├── Services/
│   └── ReportSevice.cs               # ceTe.DynamicPDF 기반 PDF 리포트 생성
│
├── Middleware/
│   ├── DapperContext.cs              # DB 연결 팩토리 (싱글톤)
│   └── ReportContext.cs             # PDF 템플릿 및 폰트 로더 (싱글톤)
│
├── Common/
│   └── Utility.cs                   # JWT 검증 유틸 (PC/BC/General), IP 추출
│
├── Logs/                            # 일별 롤링 로그 파일
├── template/                        # PDF 템플릿 파일 (.pdf)
├── fonts/                           # 한국어 폰트 (Noto Sans CJK, Nanum Barun Gothic)
│
└── wwwroot/                         # 정적 프론트엔드 자산
    ├── index.html                   # 메인 SPA 진입점
    ├── js/src/
    │   ├── main.js                  # 앱 부트스트랩 (토큰 인증 → 컨트롤러 초기화)
    │   ├── services/apiService.js   # API 클라이언트 (JWT Bearer 자동 주입)
    │   ├── components/
    │   │   ├── controller.js        # 핵심 UI 로직 (보험료 비교·선택)
    │   │   ├── detailcontroller.js  # 상세/비교 뷰
    │   │   ├── excelcontroller.js   # 엑셀 내보내기
    │   │   └── usercontroller.js    # 사용자 플랜 CRUD
    │   ├── core/state.js            # 반응형 상태 관리 (localStorage 동기화)
    │   ├── constants/constants.js   # API 기본 URL, 엔드포인트 상수
    │   └── utils/app.js             # URL 파라미터 파싱 유틸
    └── reportfiles/                 # 생성된 PDF 저장 경로
```

---

## API 엔드포인트

모든 엔드포인트는 `/api` 하위에 위치하며, Auth 엔드포인트를 제외한 나머지는 **JWT Bearer 토큰** 인증 필요.

| 메서드 | 경로 | 설명 | 주요 파라미터 |
|--------|------|------|--------------|
| GET | `/api/Auth` | 웹 인증 및 플랜 목록 조회 | `token`, `device` |
| GET | `/api/Mobile-Auth` | 모바일 앱 인증 | `token` |
| GET | `/api/ProductPremiums` | 플랜별 기본 보험료 조회 | `plan_id`, `insurance_type`, `age`, `gender` |
| GET | `/api/ProductPremiumsByAges` | 연령대별 보험료 조회 | `plan_id`, `insurance_type`, `age`, `gender` |
| GET | `/api/PaytermCoveragePremiums` | 납입기간별 담보 보험료 조회 | `plan_id`, `plan_type`, `insurance_type`, `plan_payterm_type`, `age`, `gender` |
| GET | `/api/PlanCoveragePremiumComparison` | 간편/무해지 보험료 비교 | 동일 |
| POST | `/api/PrintProducts` | PDF 리포트 생성 | `PrintProductsRequest` (플랜·담보·회사 선택 정보) |
| POST | `/api/AddUserCoverages` | 사용자 맞춤 플랜 저장 | `UserCoverage` |
| POST | `/api/UpdateUserCoverages` | 사용자 플랜 수정/삭제 | `UserCoverage` + `user_plan_id` |
| GET | `/api/ExportExcelEventLog` | 엑셀 내보내기 이벤트 로그 | `device` |

**공통 응답 형식:**

```json
{
  "is_success": true,
  "error_message": null,
  "data": { }
}
```

---

## 인증 구조

- **방식:** JWT (HMAC-SHA256, HS256)
- **전달 방법:** URL 쿼리 파라미터 (`?token=...`) → 서버에서 검증 후 Bearer 토큰 발급
- **검증기 종류:**
  - `PCJWTVerifying` — 웹 클라이언트
  - `BCJWTVerifying` — 비즈니스 클라이언트
  - `JWTVerifying` — 범용
- **클레임:** `consultant_id`, `client_id` (ga_id), `name`, `client_name`

---

## 캐싱 전략

`MMLFCPRepository`에서 3단계 인메모리 캐시 구현 (애플리케이션 수명 동안 유지, TTL 없음):

```
Plans Cache
  └── Coverage Cache (plan_id 기반)
        └── Premium Cache
              ├── PremiumCacheKey       (기본 보험료)
              ├── AgePremiumCacheKey    (연령대별)
              └── PaytermPremiumCacheKey (납입기간별)
```

- `SemaphoreSlim` 기반 스레드 안전 초기화 (이중 체크)
- 캐시 키: `plan_id + insurance_type + age + gender` 조합

---

## PDF 리포트 생성

- **라이브러리:** ceTe.DynamicPDF CoreSuite.NET
- **템플릿:** `template/` 디렉터리의 PDF 파일 기반 오버레이
- **폰트:** Noto Sans CJK Kr Light, Nanum Barun Gothic Bold (한국어 지원)
- **리포트 유형 4종:**
  1. 단일 페이지 — 기본 보험료 비교
  2. 납입기간별 — 납입기간 기준 그룹 출력
  3. 연령대별 — 연령대 기준 그룹 출력
  4. 플랜 유형별 — 플랜 타입 기준 그룹 출력
- **저장 경로:** `wwwroot/reportfiles/`

---

## 로깅

Serilog 구성:

```json
{
  "MinimumLevel": "Error",
  "WriteTo": [{
    "Name": "File",
    "Args": {
      "path": "Logs/mmlfcp-.txt",
      "rollingInterval": "Day",
      "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
    }
  }]
}
```

**이벤트 로그 (DB 저장):**

| 이벤트 코드 | 설명 |
|------------|------|
| `LOGINWEB` | 웹 로그인 |
| `LOGINAPP` | 모바일 앱 로그인 |
| `PRINT` | PDF 리포트 생성 (`print_gubun` 타입 포함) |
| `EXCEL` | 엑셀 내보내기 |

---

## 빌드 및 실행

**사전 요구사항:**
- .NET 8.0 SDK
- SQL Server 접근 권한 (연결 문자열 설정 필요)

**빌드:**

```bash
dotnet build mmlfcp/mmlfcp.csproj
```

**개발 서버 실행:**

```bash
cd mmlfcp
dotnet run
# Swagger UI: https://localhost:<port>/swagger
```

**프로덕션 배포:**

```bash
dotnet publish mmlfcp/mmlfcp.csproj -c Release -o ./publish
dotnet publish/mmlfcp.dll
```

**연결 문자열 설정 (`appsettings.json`):**

```json
{
  "ConnectionStrings": {
    "SqlConnection": "Data Source=<host>;Initial Catalog=mmlfcp;User Id=<user>;Password=<password>"
  }
}
```

---

## 보안 사항

- 특정 IP 차단 (하드코딩된 블랙리스트)
- 사용자 접근 제한 체크 (`IsUserRestricted` DB 조회)
- GA 단위 예외 보험사 필터링
- 정적 파일 캐시 정책: JS/CSS → no-cache, 이미지 → 1일

---

## 멀티 디바이스 지원

- URL 파라미터 `device` 값으로 분기 (`APP` / `WEB`)
- 모바일(`APP`)은 생명보험(`LF`) 상품 목록 제외
- 모바일 전용 정적 페이지: `wwwroot/mobile/`
