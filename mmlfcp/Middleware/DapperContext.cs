using Microsoft.Data.SqlClient;
using System.Data;

namespace mmlfcp.Middleware
{
    public class DapperContext
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;
        public DapperContext(IConfiguration config)
        {
            _config = config;
            _connectionString = _config.GetConnectionString("SqlConnection");
        }
        public IDbConnection CreateConnection()
            => new SqlConnection(_connectionString);
    }
}
