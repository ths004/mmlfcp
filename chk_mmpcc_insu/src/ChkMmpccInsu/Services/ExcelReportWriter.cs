using ChkMmpccInsu.Models;
using ClosedXML.Excel;

namespace ChkMmpccInsu.Services;

public static class ExcelReportWriter
{
    public static void Write(string filePath, List<ValidationResult> results)
    {
        using var workbook = new XLWorkbook();

        WriteSheet(workbook, "정상", results.Where(r => r.Status == ValidationStatus.Pass).ToList(), includeReason: false);
        WriteSheet(workbook, "오류", results.Where(r => r.Status == ValidationStatus.Fail).ToList(), includeReason: true);
        WriteSheet(workbook, "룰없음", results.Where(r => r.Status == ValidationStatus.NoRule).ToList(), includeReason: false);

        var directory = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        workbook.SaveAs(filePath);
    }

    private static void WriteSheet(XLWorkbook workbook, string sheetName, List<ValidationResult> rows, bool includeReason)
    {
        var sheet = workbook.Worksheets.Add(sheetName);

        var headers = new List<string> { "compy_cd", "prdt_cd", "insur_cd", "insur_nm" };
        if (includeReason)
        {
            headers.Add("사유");
        }

        for (var col = 0; col < headers.Count; col++)
        {
            sheet.Cell(1, col + 1).Value = headers[col];
        }
        sheet.Row(1).Style.Font.Bold = true;

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var excelRow = i + 2;
            sheet.Cell(excelRow, 1).Value = row.CompyCd;
            sheet.Cell(excelRow, 2).Value = row.PrdtCd;
            sheet.Cell(excelRow, 3).Value = row.InsurCd;
            sheet.Cell(excelRow, 4).Value = row.InsurNm;
            if (includeReason)
            {
                sheet.Cell(excelRow, 5).Value = row.Reason;
            }
        }

        sheet.Columns().AdjustToContents();
    }
}
