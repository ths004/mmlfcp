using ChkMmpccInsu.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace ChkMmpccInsu.Services;

public class DataRepository
{
    private readonly string _connectionString;

    public DataRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    private class PrdtRuleJoinRow
    {
        public string CompyCd { get; set; } = string.Empty;
        public string PrdtCd { get; set; } = string.Empty;
        public string InsurCd { get; set; } = string.Empty;
        public string InsurNm { get; set; } = string.Empty;
        public string? Included { get; set; }
        public string? Excluded { get; set; }
        public bool HasRule { get; set; }
    }

    public async Task<List<(TicPrdtD Row, InsurCdRule? Rule)>> GetPrdtRuleRowsAsync()
    {
        const string sql = @"
SELECT
    t.compy_cd  AS CompyCd,
    t.prdt_cd   AS PrdtCd,
    t.insur_cd  AS InsurCd,
    t.insur_nm  AS InsurNm,
    r.included  AS Included,
    r.excluded  AS Excluded,
    CASE WHEN r.insur_cd IS NULL THEN 0 ELSE 1 END AS HasRule
FROM TB_TIC_PRDT_D t
LEFT JOIN TB_INSUR_CD_RULES r ON t.insur_cd = r.insur_cd";

        using var connection = new SqlConnection(_connectionString);
        var rows = await connection.QueryAsync<PrdtRuleJoinRow>(sql);

        return rows.Select(row =>
        {
            var prdt = new TicPrdtD
            {
                CompyCd = row.CompyCd,
                PrdtCd = row.PrdtCd,
                InsurCd = row.InsurCd,
                InsurNm = row.InsurNm
            };

            InsurCdRule? rule = row.HasRule
                ? new InsurCdRule { InsurCd = row.InsurCd, Included = row.Included, Excluded = row.Excluded }
                : null;

            return (prdt, rule);
        }).ToList();
    }
}
