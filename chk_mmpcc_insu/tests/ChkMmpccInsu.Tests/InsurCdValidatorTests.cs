using ChkMmpccInsu.Models;
using ChkMmpccInsu.Services;
using Xunit;

namespace ChkMmpccInsu.Tests;

public class InsurCdValidatorTests
{
    private static readonly InsurCdRule ExampleRule = new()
    {
        InsurCd = "10101",
        Included = "상해,장해|상해,장해,3,100",
        Excluded = "사망|80,이상|20|50"
    };

    private static TicPrdtD MakeRow(string insurNm) => new()
    {
        CompyCd = "C001",
        PrdtCd = "P001",
        InsurCd = "10101",
        InsurNm = insurNm
    };

    [Fact]
    public void Validate_IncludedGroupMatchesAndNoExcludedMatch_ReturnsPass()
    {
        var row = MakeRow("상해장해보장보험");

        var result = InsurCdValidator.Validate(row, ExampleRule);

        Assert.Equal(ValidationStatus.Pass, result.Status);
    }

    [Fact]
    public void Validate_NoIncludedGroupMatches_ReturnsFail()
    {
        var row = MakeRow("일반건강보장보험");

        var result = InsurCdValidator.Validate(row, ExampleRule);

        Assert.Equal(ValidationStatus.Fail, result.Status);
        Assert.Contains("포함 규칙 불충족", result.Reason);
    }

    [Fact]
    public void Validate_IncludedMatchesButExcludedGroupAlsoMatches_ReturnsFail()
    {
        var row = MakeRow("상해장해3종100세만기사망보장");

        var result = InsurCdValidator.Validate(row, ExampleRule);

        Assert.Equal(ValidationStatus.Fail, result.Status);
        Assert.Contains("제외 규칙 위반", result.Reason);
    }

    [Fact]
    public void Validate_NoMatchingRule_ReturnsNoRule()
    {
        var row = MakeRow("아무이름");

        var result = InsurCdValidator.Validate(row, null);

        Assert.Equal(ValidationStatus.NoRule, result.Status);
    }
}
