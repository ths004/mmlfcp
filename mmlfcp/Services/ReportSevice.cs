using ceTe.DynamicPDF;
using ceTe.DynamicPDF.Merger;
using ceTe.DynamicPDF.PageElements;
using ceTe.DynamicPDF.Text;
using mmlfcp.Controllers;
using mmlfcp.Middleware;
using mmlfcp.Models;
using mmlfcp.Repository;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Web;

namespace mmlfcp.Services
{
    public class ReportSevice
    {
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly ReportContext _context;
        private readonly ILogger<ReportSevice> _logger;
        private readonly string reportSavePath;
        
        private OpenTypeFont regularFont;
        private OpenTypeFont boldFont;
        private ImportedPageData templatePage1;
        private ImportedPageData templatePage2;

        
        public ReportSevice(IConfiguration config, IWebHostEnvironment env,ReportContext context, ILogger<ReportSevice> logger)
        {
            _config = config;
            _env = env;
            _context = context;
            _logger = logger;
            reportSavePath = _context.GetReportSavePath();
            regularFont = _context.GetRegularFont();
            boldFont = _context.GetBoldFont();
            templatePage1 = _context.GetTemplatePage1();
            templatePage2 = _context.GetTemplatePage2();
            ceTe.DynamicPDF.Document.AddLicense("DPS12NEDBNFDCGIwoxbVrBi4gV1uFz1NUjMLsQTpLwDKaWVCEf+t5VmbyoYlmir1dK5Pb51+HvfB4lUEIysGOKqUQy9gVSsfenFw");
        }

        public String MakePDFReport(String ga_cd, String consultant_id, PrintProductsRequest request, List<PrintProductCoverage> coverage_list)
        {
            String rtnString = "";

            //상령일자 
            DateTime insur_birth_date = new DateTime(int.Parse(request.birth_date.Substring(0, 4)), int.Parse(request.birth_date.Substring(4, 2)), int.Parse(request.birth_date.Substring(6, 2)));

            //합계보험료계산
            foreach (var coverage in coverage_list)
            {
                coverage.calculateTotalPremium();
            }


            if (request.is_required_coverage.Equals("Y") == true)
            {
                request.coverages.Insert(0, new PrintCoverage { coverage_cd = "aa00", coverage_name =  "필수담보", coverage_amount = 0 });
            }


            rtnString = MakePDFReportbyOnePage(request.cust_name, request.age, request.gender, insur_birth_date.ToString("yyyy.MM.dd"), request.plan_type_name, request.plan_payment_expiration_name, request.company_codes, request.coverages, coverage_list);

            return rtnString;
        }

        public String MakePDFReportbyOnePage(String cust_name, int age, String gender, String insur_birth_date, String plan_type_name, String plan_payment_expiration_name, List<string> company_codes,List<PrintCoverage> coverages,  List<PrintProductCoverage> coverage_list)
        {
            //문서 생성
            Document document = new Document();
            document.Creator = "마이매니저";
            document.Author = "마이매니저";
            document.Title = "한장으로보는 생손보 보험료비교";
            document.Sections.Begin();

            //최소 & 최대 보험료 회사            
            var (minCompany, maxCompany) = GetMinMaxPremiumCompanies(coverage_list);

            //한장 대표담보 비교
            string gender_name = gender == "M" ? "남성" : "여성";
            string title = String.Format("{0} (보험나이 {1}세,{2},생년월일 : {3})고객님의 {4} - {5} 보험료 비교입니다.", cust_name, age, gender_name, insur_birth_date, plan_type_name, plan_payment_expiration_name);
            int coverage_page_count = coverages.Count / 22;
            coverage_page_count = (coverages.Count % 22) > 0 ? coverage_page_count + 1 : coverage_page_count;

            int company_page_count = company_codes.Count / 11;
            company_page_count = (company_codes.Count % 11) > 0 ? company_page_count + 1 : company_page_count;


            for (int i = 0; i < company_page_count; i++)  //company  pgae
            {
                for (int j = 0; j < coverage_page_count; j++)  //coverage page
                {
                    document.Pages.Add(MakePage1((j * 22),(i * 11), title, minCompany, maxCompany, company_codes, coverages,  coverage_list));
                }
            }


            //보험료 비교 : 최저 & 최대
            if (coverage_list.Count > 2)
            {
                coverage_page_count = coverages.Count / 22;
                coverage_page_count = (coverages.Count % 22) > 0 ? coverage_page_count + 1 : coverage_page_count;
                for (int i = 0; i < coverage_page_count; i++)
                {
                    document.Pages.Add(MakePage2((i * 22), cust_name, plan_type_name, plan_payment_expiration_name, minCompany, maxCompany, coverages, coverage_list));
                }
            }



            String prt_fileNm = getFileName(String.Format("{0}님_한장비교", cust_name));
            string Prt_No = prt_fileNm.Substring(5, 16);
            string prt_fullFileNm = String.Format(@"{0}\{1}", reportSavePath, prt_fileNm);

            if (File.Exists(prt_fullFileNm)) { File.Delete(prt_fullFileNm); }
            document.Draw(prt_fullFileNm);

            return WebFullPathName(prt_fileNm);
        }

        private string getFileName(String Gubun)
        {
            return String.Format(@"{0}_{1}_{2}.pdf", Gubun, DateTime.Now.ToString("yyMMdd"), Guid.NewGuid().ToString().Substring(0, 10).ToUpper());
        }
        private string WebFullPathName(string fileName)
        {
            string virtualPath = _env.WebRootPath;
            if (virtualPath == "/") virtualPath = "";

            return $"{virtualPath}/reportfiles/{fileName}";
        }

        public Page MakePage1(int start_row_pos,int start_colum_pos, string title,string min_company_cd, string max_company_cd, List<string> company_codes, List<PrintCoverage> coverages, List<PrintProductCoverage> coverage_list)
        {
            Page page = new Page(PageSize.A4, PageOrientation.Landscape, 0F);
            page.Elements.Add(templatePage1);
            TextArea tempTA;

            Dictionary<string, PrintProductCoverage> coverage_dict = coverage_list.ToDictionary(x => x.company_code);


            float x = 0; float y = 0;
            float step_x = 56.36f;
            float step_y = 18.17f;
            String sTmp = "";

            //타이틀
            x = 20f; y = 30f; page.Elements.Add(new Label(title, x, y, 800, 14, boldFont, 13, TextAlign.Left));
            //회사 / 상품명 / 합계보험료
            x = 25f; y = 539; page.Elements.Add(new Label("합 계", x, y, 56, 14, boldFont, 9, TextAlign.Left));

            RgbColor rgbColor = RgbColor.Black;
            int cur_company_cnt = 0;
            for (int i = start_colum_pos; i < company_codes.Count; i++)
            {
                //회사명
                string company_cd = company_codes[i];
                if (coverage_dict.TryGetValue(company_cd, out var product) == false)
                {
                    continue;
                }
                x = 203f;
                y = 59f; page.Elements.Add(new Label(product.company_name.Replace("보험", ""), x + (cur_company_cnt * step_x), y, 56, 14, boldFont, 9, TextAlign.Center, RgbColor.White));
                //상품명(글자가 넘치면 보정 실시)
                sTmp = product.product_name;
                y = 77; tempTA = new TextArea(sTmp, x + (cur_company_cnt * step_x), y, 56, 40F, regularFont, 8, TextAlign.Center);
                page.Elements.Add(tempTA);

                //합계보험료
                if (product.company_code == max_company_cd) { rgbColor = RgbColor.Red; }
                else if (product.company_code == min_company_cd) { rgbColor = RgbColor.Blue; }
                else { rgbColor = RgbColor.Black; }

                x = 200; y = 539;
                page.Elements.Add(new Label(product.total_pemium.ToString("#,###"), x + (cur_company_cnt * step_x), y, 56, 14, boldFont, 9, TextAlign.Right, rgbColor));

                cur_company_cnt += 1;
                if (cur_company_cnt >= 11) { break; }
            }
            

            //대표담보
            int cur_bojang_cnt = 0;
            cur_company_cnt = 0;
            for (int i = start_row_pos ; i < coverages.Count; i++)
            {
                var (min_coverage_company, max_coverage_company, dic_coverage_premium) = getCoveragePremium(coverages[i].coverage_cd, coverage_list);

                y = 118f + (step_y * cur_bojang_cnt);

                //담보명 가입금액
                x = 25f;
                page.Elements.Add(new Label(coverages[i].coverage_name, x, y, 145, 18, regularFont, 9, TextAlign.Left)); //담보명
                x = 150f;
                page.Elements.Add(new Label(coverages[i].coverage_amount.ToString("#,###"), x, y, 50, 18, regularFont, 9, TextAlign.Right)); //가입금액

                //보험료
                cur_company_cnt = 0;
                for (int j = start_colum_pos; j < company_codes.Count; j++)
                {
                    x = 200f + (step_x * cur_company_cnt);
                    string company_cd = company_codes[j];
                    if (dic_coverage_premium.TryGetValue(company_cd, out var coverage_amount) == false)
                    {
                        continue;
                    }
                    if (company_cd == max_coverage_company) { rgbColor = RgbColor.Red; }
                    else if (company_cd == min_coverage_company) { rgbColor = RgbColor.Blue; }
                    else { rgbColor = RgbColor.Black; }
                    page.Elements.Add(new Label(coverage_amount == 0 ? "-" : coverage_amount.ToString("#,###"), x - 2, y, 56, 18, regularFont, 9, TextAlign.Right, rgbColor)); //보험료
                    cur_company_cnt += 1;
                    if (cur_company_cnt >= 11) { break; }
                }
                cur_bojang_cnt += 1;
                if (cur_bojang_cnt >= 22) { break; }
            }
            return page;
        }


        public Page MakePage2(int start_row_pos, String cust_name, String plan_type_name, String plan_payment_expiration_name, string minCompany, string maxCompany, List<PrintCoverage> coverages, List<PrintProductCoverage> coverage_list)
        {
            Page page = new Page(PageSize.A4, PageOrientation.Landscape, 0F);
            page.Elements.Add(templatePage2);
            TextArea tempTA;

            float x = 0; float y = 0;
            float step_x = 147.36f;
            float step_y = 18.17f;
            String sTmp = "";

            float  tmpPremium = 0;
            int PaymentPriod = 0;

            Dictionary<string, PrintProductCoverage> coverage_dict = coverage_list.ToDictionary(x => x.company_code);

            PrintProductCoverage minProduct = coverage_dict[minCompany];
            PrintProductCoverage maxProduct = coverage_dict[maxCompany];


            //고객명 / 납입 보험기간 / 상품군
            x = 112;
            y = 63; page.Elements.Add(new Label(cust_name, x, y, 150, 14, regularFont, 10, TextAlign.Left));
            y += 17.4f; page.Elements.Add(new Label(plan_type_name, x, y, 150, 14, regularFont, 10, TextAlign.Left));
            y += 17.4f; page.Elements.Add(new Label(plan_payment_expiration_name, x, y, 150, 14, regularFont, 10, TextAlign.Left));

            //최저 , 최대 보험사 , 상품명
            x = 80; y = 145f;
            sTmp = String.Format("최저보험료 상품 - {0}", minProduct.company_name.Replace("보험", ""));
            page.Elements.Add(new Label(sTmp, x, y, 155, 14, regularFont, 9, TextAlign.Left, new RgbColor(28, 99, 156)));
            page.Elements.Add(new Label(minProduct.product_name, x, y + 14, 200, 14, regularFont, 9, TextAlign.Left));

            y = 190f;
            sTmp = String.Format("최대보험료 상품 - {0}", maxProduct.company_name.Replace("보험", ""));
            page.Elements.Add(new Label(sTmp, x, y, 155, 14, regularFont, 9, TextAlign.Left, new RgbColor(237, 40, 145)));
            page.Elements.Add(new Label(maxProduct.product_name, x, y + 14, 200, 14, regularFont, 9, TextAlign.Left));

            //최저 , 최대 월보험료
            x = 110;
            y = 278; page.Elements.Add(new Label(minProduct.total_pemium.ToString("#,###") + " 원", x, y, 128, 12, regularFont, 16, TextAlign.Right));
            y += 42; page.Elements.Add(new Label(maxProduct.total_pemium.ToString("#,###") + " 원", x, y, 128, 12, regularFont, 16, TextAlign.Right));
            tmpPremium = maxProduct.total_pemium - minProduct.total_pemium;
            y += 42; page.Elements.Add(new Label(tmpPremium.ToString("#,###") + " 원", x, y - 5, 128, 20, regularFont, 20, TextAlign.Right, RgbColor.DeepPink));
            //합계 보험료 최저 , 최대 월보험료
            Regex rg = new Regex(@"\d+년");
            Match m = rg.Match(plan_payment_expiration_name);
            if (m.Success)
            {
                PaymentPriod = int.Parse(m.Value.Replace("년", ""));
            }
            else
            {
                PaymentPriod = 1;
            }

            //sTmp = String.Format("최저,최대 {0}년납 보험료비교", PaymentPriod);
            //x = 40; y = 403; page.Elements.Add(new Label(sTmp, x , y, 130, 14, regularFont, 12, TextAlign.Left,RgbColor.White));
            x = 110;
            y = 440; page.Elements.Add(new Label((minProduct.total_pemium * PaymentPriod * 12).ToString("#,###") + " 원", x, y, 128, 14, regularFont, 16, TextAlign.Right));
            y += 42; page.Elements.Add(new Label((maxProduct.total_pemium * PaymentPriod * 12).ToString("#,###") + " 원", x, y, 128, 14, regularFont, 16, TextAlign.Right));
            tmpPremium = (maxProduct.total_pemium - minProduct.total_pemium) * PaymentPriod * 12;
            y += 42; page.Elements.Add(new Label(tmpPremium.ToString("#,###") + " 원", x, y - 5, 128, 20, regularFont, 20, TextAlign.Right, RgbColor.DeepPink));

            //회사 / 상품명 / 합계보험료
            x = 515f;
            int pos = 0;

            //최저 보험료 상품
            y = 56f; page.Elements.Add(new Label(minProduct.company_name.Replace("보험", ""), x , y, 155, 14, regularFont, 9, TextAlign.Center));
            y = 80; sTmp = minProduct.product_name;
            tempTA = new TextArea(sTmp, x , y, 150, 40F, regularFont, 9, TextAlign.Center);
            tempTA.Y = (tempTA.HasOverflowText()) ? tempTA.Y - 5F : tempTA.Y;
            tempTA.FontSize = (tempTA.HasOverflowText()) ? tempTA.FontSize - 2F : tempTA.FontSize;
            page.Elements.Add(tempTA);
            y = 117; page.Elements.Add(new Label(minProduct.total_pemium.ToString("#,###"), x , y, 155, 14, regularFont, 9, TextAlign.Center));

            //최대 보험료 상품
            x = x + step_x;
            y = 56f; page.Elements.Add(new Label(maxProduct.company_name.Replace("보험", ""), x, y, 155, 14, regularFont, 9, TextAlign.Center));
            y = 80; sTmp = maxProduct.product_name;
            tempTA = new TextArea(sTmp, x, y, 150, 40F, regularFont, 9, TextAlign.Center);
            tempTA.Y = (tempTA.HasOverflowText()) ? tempTA.Y - 5F : tempTA.Y;
            tempTA.FontSize = (tempTA.HasOverflowText()) ? tempTA.FontSize - 2F : tempTA.FontSize;
            page.Elements.Add(tempTA);
            y = 117; page.Elements.Add(new Label(maxProduct.total_pemium.ToString("#,###"), x, y, 155, 14, regularFont, 9, TextAlign.Center));


            //대표담보
            int cur_bojang_cnt = 0;
            PrintCoveragePremium tmpCoverage;
            float tmpCoveragePremium = 0;
            RgbColor rgbColor = RgbColor.Black;
            for(int i = start_row_pos; i < coverages.Count; i++)
            {
                y = 157f + (step_y * cur_bojang_cnt);

                //담보명 가입금액
                x = 290f;
                page.Elements.Add(new Label(coverages[i].coverage_name, x, y, 160, 18, regularFont, 9, TextAlign.Left)); //담보명
                x = 450;
                page.Elements.Add(new Label(coverages[i].coverage_amount.ToString("#,###"), x, y, 60, 18, regularFont, 9, TextAlign.Right)); //가입금액


                //최저 보험료 상품
                tmpCoveragePremium = 0;
                if (minProduct.Coverages.TryGetValue(coverages[i].coverage_cd, out tmpCoverage) == true)
                {
                    tmpCoveragePremium = tmpCoverage.plan_coverage_premium;
                }
                x = 515f;
                page.Elements.Add(new Label(tmpCoveragePremium == 0 ? "-" : tmpCoveragePremium.ToString("#,###"), x, y, 95, 18, regularFont, 9, TextAlign.Right, rgbColor)); //보험료


                //최대 보험료 상품
                tmpCoveragePremium = 0;
                if (maxProduct.Coverages.TryGetValue(coverages[i].coverage_cd, out tmpCoverage) == true)
                {
                    tmpCoveragePremium = tmpCoverage.plan_coverage_premium;
                }
                x = 515f + step_x;
                page.Elements.Add(new Label(tmpCoveragePremium == 0 ? "-" : tmpCoveragePremium.ToString("#,###"), x, y, 95, 18, regularFont, 9, TextAlign.Right, rgbColor)); //보험료
              
                cur_bojang_cnt += 1;
                if (cur_bojang_cnt >= 22) { break; }
            }

            return page;
        }


        //보장별 보험료 최저 & 최대 회사코드 및 보험료
        private (string minCompanyCode,  string maxCompanyCode, Dictionary<String, float> coverages) getCoveragePremium(String coverage_cd, List<PrintProductCoverage> product_list)
        {
            float minPremium = float.MaxValue;
            float maxPremium = float.MinValue;
            string minCompanyCode = string.Empty;
            string maxCompanyCode = string.Empty;
            Dictionary<String, float> dic = new Dictionary<string, float>();

            bool foundValidPremium = false;

            foreach (var product in product_list)
            {
                float premium = 0;
                if (product.Coverages != null && product.Coverages.ContainsKey(coverage_cd))
                {
                    premium = product.Coverages[coverage_cd].plan_coverage_premium;

                    // 0 값은 제외
                    if (premium > 0)
                    {
                        foundValidPremium = true;

                        if (premium < minPremium)
                        {
                            minPremium = premium;
                            minCompanyCode = product.company_code;
                        }

                        if (premium > maxPremium)
                        {
                            maxPremium = premium;
                            maxCompanyCode = product.company_code;
                        }
                    }

                }
                dic[product.company_code] = premium; 
            }

            // 유효한 premium이 없을 경우
            if (!foundValidPremium)
            {
                return (string.Empty, string.Empty, dic);
            }
            return (minCompanyCode,  maxCompanyCode, dic);
        }

        //보험료 최저 & 최대 회사코드 
        private  (string minCompanyCode,  string maxCompanyCode)
            GetMinMaxPremiumCompanies(List<PrintProductCoverage> coverage_list)
        {
            if (coverage_list == null || coverage_list.Count == 0)
            {
                return (string.Empty,  string.Empty);
            }

            var first = coverage_list[0];
            float minPremium = first.total_pemium;
            float maxPremium = first.total_pemium;
            string minCompanyCode = first.company_code;
            string maxCompanyCode = first.company_code;

            for (int i = 1; i < coverage_list.Count; i++)
            {
                var current = coverage_list[i];
                if (current.total_pemium > 0)
                {
                    if (current.total_pemium < minPremium)
                    {
                        minPremium = current.total_pemium;
                        minCompanyCode = current.company_code;
                    }
                    if (current.total_pemium > maxPremium)
                    {
                        maxPremium = current.total_pemium;
                        maxCompanyCode = current.company_code;
                    }
                }
            }

            return (minCompanyCode,  maxCompanyCode);
        }
    }



}
