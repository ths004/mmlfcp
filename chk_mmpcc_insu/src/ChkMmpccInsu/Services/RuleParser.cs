namespace ChkMmpccInsu.Services;

public static class RuleParser
{
    /// <summary>
    /// "A,B|C,D,E" -> [[A,B],[C,D,E]] (| = OR between groups, , = AND within a group)
    /// </summary>
    public static List<List<string>> Parse(string? rule)
    {
        var groups = new List<List<string>>();
        if (string.IsNullOrWhiteSpace(rule))
        {
            return groups;
        }

        foreach (var orPart in rule.Split('|'))
        {
            var andTokens = orPart.Split(',')
                .Select(t => t.Trim())
                .Where(t => t.Length > 0)
                .ToList();

            if (andTokens.Count > 0)
            {
                groups.Add(andTokens);
            }
        }

        return groups;
    }
}
