using ChkMmpccInsu.Services;
using Xunit;

namespace ChkMmpccInsu.Tests;

public class RuleParserTests
{
    [Fact]
    public void Parse_IncludedExample_ReturnsOrGroupsOfAndTokens()
    {
        var groups = RuleParser.Parse("상해,장해|상해,장해,3,100");

        Assert.Equal(2, groups.Count);
        Assert.Equal(new[] { "상해", "장해" }, groups[0]);
        Assert.Equal(new[] { "상해", "장해", "3", "100" }, groups[1]);
    }

    [Fact]
    public void Parse_ExcludedExample_ReturnsOrGroupsOfAndTokens()
    {
        var groups = RuleParser.Parse("사망|80,이상|20|50");

        Assert.Equal(4, groups.Count);
        Assert.Equal(new[] { "사망" }, groups[0]);
        Assert.Equal(new[] { "80", "이상" }, groups[1]);
        Assert.Equal(new[] { "20" }, groups[2]);
        Assert.Equal(new[] { "50" }, groups[3]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Parse_NullOrEmpty_ReturnsEmptyList(string? rule)
    {
        var groups = RuleParser.Parse(rule);

        Assert.Empty(groups);
    }
}
