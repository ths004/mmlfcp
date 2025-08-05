# Technology Stack

## Framework & Runtime
- **ASP.NET Core Web API** (.NET 8.0)
- **C#** with nullable reference types enabled
- **Implicit usings** enabled for cleaner code

## Database & Data Access
- **Microsoft SQL Server** as primary database
- **Dapper** (v2.1.66) for lightweight ORM and SQL query execution
- **Microsoft.Data.SqlClient** (v6.1.0) for database connectivity
- Custom `DapperContext` for connection management

## Logging
- **Serilog** (v4.3.0) with ASP.NET Core integration (v9.0.0)
- **File-based logging** with daily rolling intervals
- Structured logging with custom output templates
- Request logging middleware enabled

## API Documentation
- **Swagger/OpenAPI** via Swashbuckle.AspNetCore (v6.6.2)
- Available in development environment

## Architecture Patterns
- **Repository Pattern** with interface-based dependency injection
- **Dependency Injection** using built-in ASP.NET Core container
- **Async/Await** pattern throughout data access layer

## Common Commands

### Build & Run
```bash
# Build the project
dotnet build

# Run in development mode
dotnet run

# Run with specific environment
dotnet run --environment Development
```

### Database Operations
- Connection string configured in `appsettings.json`
- All database operations use parameterized queries via Dapper
- Async repository methods for all data access

### Logging
- Logs written to `Logs/` directory with daily rotation
- Startup logs: `Logs/startup-.txt`
- Application logs: `Logs/mmlfcp-.txt`