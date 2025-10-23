using System.Data;

namespace mmlfcp.Models
{
    public class UserCoverage
    {
        public String user_plan_id { get; set; }   // ✅ Nullable Guid
        public String user_plan_name { get; set; }

        public String plan_type { get; set; }
        public String ga_id { get; set; }

        public String consultant_id { get; set; }

        public DateTime in_date { get; set; }
        public DateTime up_date { get; set; }

        public List<UserCoverageDetail> details { get; set; }
    }

    public class UserCoverageDetail
    {
        public String coverage_cd { get; set; }
        public float coverage_amount { get; set; }

        public static DataTable ToDataTable(string tablename)
        {
            DataTable dt = new DataTable { TableName = tablename };
            dt.Columns.AddRange(new DataColumn[] {
                new DataColumn { ColumnName = "coverage_cd",DataType = typeof(string)},
                new DataColumn { ColumnName = "coverage_amount",DataType = typeof(float)},
            });
            return dt;
        }
    }

    public class UserCoverageResponse
    {
        public bool is_success { get; set; }
        public string error_message { get; set; } = string.Empty;

        public UserCoverage userCoverage { get; set; }
    }
}
