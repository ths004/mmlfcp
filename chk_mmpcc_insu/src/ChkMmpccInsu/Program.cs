using ChkMmpccInsu.Models;
using ChkMmpccInsu.Services;
using Microsoft.Extensions.Configuration;

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .Build();

var connectionString = config.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default 설정이 없습니다.");
var outputFolder = config["OutputFolder"] ?? "output";

Console.WriteLine("TB_TIC_PRDT_D.insur_cd 검증을 시작합니다...");

var repository = new DataRepository(connectionString);
var rows = await repository.GetPrdtRuleRowsAsync();

var results = rows
    .Select(x => InsurCdValidator.Validate(x.Row, x.Rule))
    .ToList();

var fileName = $"InsurCdCheck_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
var filePath = Path.Combine(outputFolder, fileName);
ExcelReportWriter.Write(filePath, results);

var passCount = results.Count(r => r.Status == ValidationStatus.Pass);
var failCount = results.Count(r => r.Status == ValidationStatus.Fail);
var noRuleCount = results.Count(r => r.Status == ValidationStatus.NoRule);

Console.WriteLine($"총 건수   : {results.Count}");
Console.WriteLine($"정상      : {passCount}");
Console.WriteLine($"오류      : {failCount}");
Console.WriteLine($"룰 없음   : {noRuleCount}");
Console.WriteLine($"결과 파일 : {Path.GetFullPath(filePath)}");
