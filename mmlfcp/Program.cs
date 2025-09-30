using mmlfcp.Middleware;
using mmlfcp.Repository;
using mmlfcp.Services;
using Serilog;


var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .WriteTo.File("Logs/mmlfcp-.txt",
        rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .ReadFrom.Services(services));


// Add services to the container.
builder.Services.AddControllers();


// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo 
    { 
        Title = "MMLFCP API", 
        Version = "v1",
        Description = "보험료 계산 및 비교 API"
    });

    // JWT Bearer 인증 설정
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement()
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            },
            new List<string>()
        }
    });

    // XML 주석 파일 경로 설정 (선택사항)
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});

//Dapper 
builder.Services.AddSingleton<DapperContext>();
builder.Services.AddSingleton<IMMLFCPRepository, MMLFCPRepository>();

builder.Services.AddSingleton<ReportContext>();

builder.Services.AddScoped<ReportSevice>();

// MemoryCache 설정 (메모리 제한)
//builder.Services.AddMemoryCache(options =>
//{
//    options.SizeLimit = 1024; // 항목 수 제한
//    options.CompactionPercentage = 0.25; // 메모리 부족 시 25% 제거
//});

// 캐시 서비스 등록
builder.Services.AddMemoryCache();


var app = builder.Build();

//
app.UseSerilogRequestLogging();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// 정적 파일 지원 추가
app.UseStaticFiles();

// 기본 파일 설정 (index.html을 기본 파일로 설정)
app.UseDefaultFiles();

app.UseAuthorization();

app.MapControllers();

// 기본 페이지 설정 (루트 경로에서 index.html로 리다이렉트)
app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();



