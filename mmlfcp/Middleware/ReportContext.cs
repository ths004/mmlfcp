using ceTe.DynamicPDF.Merger;
using ceTe.DynamicPDF.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using mmlfcp.Controllers;
using Serilog.Core;
using System.IO;

namespace mmlfcp.Middleware
{
    public class ReportContext
    {
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ReportContext> _logger;

        private OpenTypeFont _regularFont;
        private OpenTypeFont _boldFont;
        private ImportedPageData _templatePage1;     //1
        private ImportedPageData _templatePage2;     //4


        private ImportedPageData _templateAgesPage;      //5
        private ImportedPageData _templatePaytermsPage;  //2

        private ImportedPageData _templatePlantypsPage;

        private string _reportSavePath;

        public ReportContext(IConfiguration config, IWebHostEnvironment env, ILogger<ReportContext> logger)
        {
            _logger = logger;
            _config = config;
            _env = env;
            InitializeResources();
        }

        private void InitializeResources()
        {
            _logger.LogInformation("Initializing ReportContext resources...");
            _logger.LogInformation("regularFont :" + _config.GetSection("Fonts")["regularFont"]);
            _logger.LogInformation("boldFont :" + _config.GetSection("Fonts")["boldFont"]);
            _logger.LogInformation("ReportSavePath :" + _config.GetValue<string>("ReportSavePath"));
            _logger.LogInformation("ReportTemplate :" + _config.GetValue<string>("ReportTemplate"));
            _logger.LogInformation("ReportPlantypeTemplate :" + _config.GetValue<string>("ReportPlantypeTemplate"));

            // 폰트 파일 로드
            var regularFontPath = GetPhysicalPath(_config.GetSection("Fonts")["regularFont"]);
            var boldFontPath = GetPhysicalPath(_config.GetSection("Fonts")["boldFont"]);

            _regularFont = new OpenTypeFont(regularFontPath);
            _boldFont = new OpenTypeFont(boldFontPath);

            _reportSavePath = GetPhysicalPath(_config.GetValue<string>("ReportSavePath"));

            // 템플릿 파일 로드
            var Reporttemplate = GetPhysicalPath(_config.GetValue<string>("ReportTemplate"));
            _templatePage1 = new ImportedPageData(Reporttemplate, 1);  //한장보험료
            _templatePage2 = new ImportedPageData(Reporttemplate, 4);  //최저최대
            _templatePaytermsPage = new ImportedPageData(Reporttemplate, 2);
            _templateAgesPage = new ImportedPageData(Reporttemplate, 5);  

            var ReportPlantypeTemplate = GetPhysicalPath(_config.GetValue<string>("ReportPlantypeTemplate"));
            _templatePlantypsPage = new ImportedPageData(ReportPlantypeTemplate, 1);

        }

        private string GetPhysicalPath(string relativePath)
        {
            // ~/로 시작하는 경우 처리
            if (relativePath.StartsWith("~/"))
            {
                relativePath = relativePath.Substring(2); // ~/ 제거
            }

            // 웹 루트 기준으로 물리적 경로 생성
            return Path.Combine(_env.ContentRootPath, relativePath);
        }


        public OpenTypeFont GetRegularFont() => _regularFont;
        public OpenTypeFont GetBoldFont() => _boldFont;
        public ImportedPageData GetTemplatePage1() => _templatePage1;
        public ImportedPageData GetTemplatePage2() => _templatePage2;
        public ImportedPageData GetTemplateAgesPage() => _templateAgesPage;
        public ImportedPageData GetTemplatePaytermsPage() => _templatePaytermsPage;

        public ImportedPageData GetTemplatePlantypsPage() => _templatePlantypsPage;


        public string GetReportSavePath() => _reportSavePath;

    }
}
