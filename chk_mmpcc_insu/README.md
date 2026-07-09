# ChkMmpccInsu

`TB_TIC_PRDT_D.insur_nm`이 `TB_INSUR_CD_RULES`에 정의된 포함/제외 문자열 규칙을 만족하는지
검증하고, 결과를 Excel 파일로 저장하는 .NET 8 콘솔 프로그램입니다.

## 폴더 구조

```
ChkMmpccInsu.slnx
src/ChkMmpccInsu/           - 콘솔 프로그램
  Program.cs                - 진입점 (조회 -> 검증 -> 엑셀 출력)
  appsettings.json          - DB 연결 문자열, 출력 폴더 설정
  Models/                   - TicPrdtD, InsurCdRule, ValidationResult
  Services/
    RuleParser.cs           - "A,B|C,D" 문자열 파싱 (| = OR, , = AND)
    InsurCdValidator.cs     - included/excluded 규칙 판정
    DataRepository.cs       - TB_TIC_PRDT_D LEFT JOIN TB_INSUR_CD_RULES 조회
    ExcelReportWriter.cs    - 정상/오류/룰없음 3개 시트로 xlsx 저장
tests/ChkMmpccInsu.Tests/   - RuleParser, InsurCdValidator 단위 테스트
```

## 사전 요구사항

- .NET 8 SDK
- SQL Server 접근 권한 (`TB_TIC_PRDT_D`, `TB_INSUR_CD_RULES` 조회 권한)

## 설정

`src/ChkMmpccInsu/appsettings.json`

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=...;Initial Catalog=...;user id=...;password=...;TrustServerCertificate=True"
  },
  "OutputFolder": "output"
}
```

- `ConnectionStrings:Default` : SQL Server 연결 문자열
- `OutputFolder` : 결과 xlsx 파일이 저장될 폴더 (상대 경로면 실행 파일 기준)

> 비밀번호가 평문으로 저장되므로 이 파일을 외부에 공유하거나 공개 저장소에 커밋하지 마세요.

## 빌드 / 실행

```bash
dotnet build
dotnet run --project src/ChkMmpccInsu
```

실행하면 `output/InsurCdCheck_yyyyMMdd_HHmmss.xlsx` 파일이 생성되고, 콘솔에 총 건수/정상/오류/룰없음 건수가 출력됩니다.

## 테스트

```bash
dotnet test
```

## 실행 파일(exe) 만들기

.NET 런타임 설치 없이 단독으로 실행 가능한 self-contained 단일 파일 exe(win-x64)를 만듭니다.

```bash
dotnet publish src/ChkMmpccInsu -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

`publish/` 폴더에 아래 파일이 생성됩니다.

```
publish/
  ChkMmpccInsu.exe                     - 실행 파일
  appsettings.json                     - DB 연결 문자열 (배포 전 실제 값으로 수정)
  Microsoft.Data.SqlClient.SNI.dll     - SQL Server native 종속 dll
```

이 3개 파일을 같은 폴더에 유지한 채로 배포/실행하면 됩니다 (`.pdb`는 디버그 심볼이라 배포 시 제외해도 무방).
`ChkMmpccInsu.exe`를 더블클릭하거나 커맨드라인에서 실행하면 됩니다.

대상 PC에 .NET 8 런타임이 이미 설치되어 있다면 `--self-contained false`로 훨씬 작은(수백KB) exe를 만들 수도 있습니다.

## 규칙 문법

`TB_INSUR_CD_RULES.included` / `excluded` 컬럼은 다음과 같이 해석합니다.

- `|` : OR (여러 조건 그룹 중 하나만 만족하면 됨)
- `,` : AND (한 그룹 내 모든 문자열이 포함되어야 함)

예: `included = "상해,장해|상해,장해,3,100"`
→ (`상해` AND `장해`) OR (`상해` AND `장해` AND `3` AND `100`) 이 `insur_nm`에 포함되어야 통과

예: `excluded = "사망|80,이상|20|50"`
→ `사망` 이나 (`80` AND `이상`) 이나 `20` 이나 `50` 중 하나라도 `insur_nm`에 포함되면 실패

## 판정 결과

- **정상 (Pass)** : included 조건 충족, excluded 조건 미해당
- **오류 (Fail)** : included 조건 불충족 또는 excluded 조건 해당 (사유 컬럼에 기록)
- **룰없음 (NoRule)** : `insur_cd`에 매칭되는 규칙이 `TB_INSUR_CD_RULES`에 없음
