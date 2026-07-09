namespace ChkMmpccInsu.Models;

public enum ValidationStatus
{
    Pass,
    Fail,
    NoRule
}

public class ValidationResult
{
    public string CompyCd { get; set; } = string.Empty;
    public string PrdtCd { get; set; } = string.Empty;
    public string InsurCd { get; set; } = string.Empty;
    public string InsurNm { get; set; } = string.Empty;
    public ValidationStatus Status { get; set; }
    public string Reason { get; set; } = string.Empty;
}
