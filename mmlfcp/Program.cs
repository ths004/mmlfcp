using mmlfcp.Middleware;
using mmlfcp.Repository;
using mmlfcp.Services;
using Serilog;


var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)  // ← appsettings.json 읽기  먼저 설정된것 적용
    .ReadFrom.Services(services)
    .WriteTo.File("Logs/mmlfcp-.txt",
        rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"));

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

// 1. 로깅
app.UseSerilogRequestLogging();

// 2. Swagger (개발환경)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
// 3. HTTPS 리다이렉션
app.UseHttpsRedirection();

// 4. 기본 파일 설정 - UseStaticFiles() 보다 반드시 앞에
app.UseDefaultFiles();

// 5. 정적 파일 - 캐시 1일로 설정
var staticFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.Name;

        // .js, .css 파일만 노캐시
        if (path.EndsWith(".js") || path.EndsWith(".css"))
        {
            ctx.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            ctx.Context.Response.Headers["Pragma"] = "no-cache";
            ctx.Context.Response.Headers["Expires"] = "0";
        }
        else
        {
            // 이미지 등은 캐시 허용 (1일)
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=86400";
        }
    }
};
app.UseStaticFiles(staticFileOptions);


// 6. 인증/인가
app.UseAuthorization();

// 7. 컨트롤러
app.MapControllers();


// 8. 루트 리다이렉트 (UseDefaultFiles가 정상 동작하면 사실상 불필요)
app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();



