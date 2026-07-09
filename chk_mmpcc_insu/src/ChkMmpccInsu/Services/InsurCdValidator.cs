using ChkMmpccInsu.Models;

namespace ChkMmpccInsu.Services;

public static class InsurCdValidator
{
    public static ValidationResult Validate(TicPrdtD row, InsurCdRule? rule)
    {
        var result = new ValidationResult
        {
            CompyCd = row.CompyCd,
            PrdtCd = row.PrdtCd,
            InsurCd = row.InsurCd,
            InsurNm = row.InsurNm
        };

        if (rule is null)
        {
            result.Status = ValidationStatus.NoRule;
            result.Reason = "TB_INSUR_CD_RULES에 매칭되는 룰 없음";
            return result;
        }

        var includedGroups = RuleParser.Parse(rule.Included);
        var excludedGroups = RuleParser.Parse(rule.Excluded);

        if (includedGroups.Count > 0 && !includedGroups.Any(group => group.All(token => row.InsurNm.Contains(token, StringComparison.Ordinal))))
        {
            result.Status = ValidationStatus.Fail;
            result.Reason = $"포함 규칙 불충족: {rule.Included}";
            return result;
        }

        var violatedGroup = excludedGroups.FirstOrDefault(group => group.All(token => row.InsurNm.Contains(token, StringComparison.Ordinal)));
        if (violatedGroup is not null)
        {
            result.Status = ValidationStatus.Fail;
            result.Reason = $"제외 규칙 위반: {string.Join(",", violatedGroup)}";
            return result;
        }

        result.Status = ValidationStatus.Pass;
        result.Reason = string.Empty;
        return result;
    }
}
