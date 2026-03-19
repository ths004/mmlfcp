    public class AuthEntity
    {
        public int ErrorCode { get; set; }

        public String ErrorMessage { get; set; }

        public String ConsultantID { get; set; }
        public String ConsultantName { get; set; }

        public String AgencyCompanyCD { get; set; }

        public String AgencyCompanyName { get; set; }
    }

    public class UserRestrictEntity
    {

        public String ga_id { get; set; }

        public String consultant_id { get; set; }
        public String app_id { get; set; }
    }