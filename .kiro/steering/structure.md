# Project Structure

## Root Directory
- `mmlfcp.sln` - Solution file
- `mmlfcp.csproj` - Project file with package references and JWT dependencies
- `Program.cs` - Application entry point with Serilog and JWT authentication configuration
- `appsettings.json` / `appsettings.Development.json` - Configuration files

## Folder Organization

### `/Controllers`
- Contains Web API controllers for insurance premium calculation
- `MMLFCPController.cs` - Main API controller with authentication endpoints
- Follow RESTful naming conventions for new controllers
- All controllers use JWT Bearer authentication

### `/Models`
- Entity classes representing database tables and DTOs
- **Database Entities**:
  - `PlanEntity.cs` - Insurance plan data
  - `CoveragePremiumEntity.cs` - Coverage premium calculations
  - `InsurCDPremiumEntity.cs` - Insurance code premium data
  - `PlanCoverageEntity.cs` - Plan coverage relationships
  - `RequiredInsurCDPremiumEntity.cs` - Required insurance calculations
- **API Response Models**:
  - `ApiResponseModels.cs` - Standardized API response structures
  - `AuthEntity.cs` - JWT authentication result model
- Use snake_case property names to match database column naming

### `/Repository`
- Data access layer implementing Repository pattern
- `MMLFCPRepository.cs` - Main repository with interface `IMMLFCPRepository`
- All methods are async and use Dapper for SQL execution
- Parameterized queries for security
- Supports insurance premium calculations and plan management

### `/Common`
- Utility classes and helper methods
- `Utility.cs` - JWT token validation and IP address extraction utilities
- Contains PC/BC JWT verification methods with different secret keys

### `/Middleware`
- Custom middleware components
- `DapperContext.cs` - Database connection context for SQL Server

### `/Services`
- Business logic layer (currently empty folder)
- Place service classes here for complex business operations

### `/Logs`
- Application log files with daily rotation
- Automatically created by Serilog configuration
- Separate startup and application logs

### `/Properties`
- Project properties and launch settings

### `/wwwroot`
- Static files (currently empty)

## API Endpoints
- **`GET /api/Auth`** - User authentication and plan retrieval
- **`GET /api/ProductPremiums`** - Plan-based product premium calculation (requires JWT)
- **`GET /api/ProductPremiumsByAges`** - Age-based premium calculation (requires JWT)

## Authentication & Security
- **JWT Bearer Authentication** with custom validation
- **IP Address Verification** for enhanced security
- **Dual Token Support** (PC/BC tokens with different secrets)
- **SwaggerUI Integration** with Authorization header support

## Naming Conventions
- **Classes**: PascalCase (e.g., `PlanEntity`, `MMLFCPController`)
- **Methods**: PascalCase with Async suffix for async methods
- **Properties**: snake_case to match database columns
- **Interfaces**: Prefix with 'I' (e.g., `IMMLFCPRepository`)
- **Database parameters**: Use @ prefix in SQL, map to camelCase in C#
- **API Response Properties**: snake_case for JSON consistency

## Architecture Guidelines
- Controllers should be thin, delegating to repositories or services
- Use dependency injection for all dependencies
- Implement interfaces for testability
- All database operations should be async
- Use structured logging with Serilog
- JWT authentication handled through Utility class methods
- Consistent error handling with standardized response models
- IP-based security validation for sensitive operations