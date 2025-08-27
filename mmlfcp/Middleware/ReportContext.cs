using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System.IO;
using ceTe.DynamicPDF.Merger;
using ceTe.DynamicPDF.Text;

namespace mmlfcp.Middleware
{
    public class ReportContext
    {
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;


        private OpenTypeFont _regularFont;
        private OpenTypeFont _boldFont;
        private ImportedPageData _templatePage1;
        private ImportedPageData _templatePage2;
        private string _reportSavePath;

        public ReportContext(IConfiguration config, IWebHostEnvironment env)
        {
            _config = config;
            _env = env;
            InitializeResources();
        }

        private void InitializeResources()
        {
            // 폰트 파일 로드
            var regularFontPath = GetPhysicalPath(_config.GetSection("Fonts")["regularFont"]);
            var boldFontPath = GetPhysicalPath(_config.GetSection("Fonts")["boldFont"]);

            _regularFont = new OpenTypeFont(regularFontPath);
            _boldFont = new OpenTypeFont(boldFontPath);

            // 템플릿 파일 로드
            var templatePath = GetPhysicalPath(_config.GetValue<string>("ReportTemplatePath"));
            _templatePage1 = new ImportedPageData(templatePath, 1);
            _templatePage2 = new ImportedPageData(templatePath, 4);
            _reportSavePath = GetPhysicalPath(_config.GetValue<string>("ReportSavePath"));
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

        public string GetReportSavePath() => _reportSavePath;

    }
}
