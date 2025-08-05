using System.Net.Sockets;
using System.Net;
using JWT;
using JWT.Algorithms;
using JWT.Exceptions;
using JWT.Builder;
using mmlfcp.Models;

namespace mmlfcp.Common
{
    public class Utility
    {
        public static string GetIPAddress(HttpContext httpContext)
        {
            IPAddress? remoteIpAddress = null;
            var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();

            if (!string.IsNullOrEmpty(forwardedFor))
            {
                var ips = forwardedFor.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                      .Select(s => s.Trim());
                foreach (var ip in ips)
                {
                    if (IPAddress.TryParse(ip, out var address) &&
                        (address.AddressFamily is AddressFamily.InterNetwork
                         or AddressFamily.InterNetworkV6))
                    {
                        remoteIpAddress = address;
                        break;
                    }
                }
            }
            else
            {
                remoteIpAddress = httpContext.Connection.RemoteIpAddress;
            }
            return remoteIpAddress == null ? "" : remoteIpAddress.ToString();
        }

        public static AuthEntity PCJWTVerifying(string token, string currentClientIP = "")
        {
            AuthEntity authEntity = new AuthEntity();
            authEntity.ErrorCode = 0;
            authEntity.ErrorMessage = "";

            try
            {
                const string secret = "1524A7C3BAA69F0A2130C04C2BEFB36B"; //Web
                var jwtValues = JwtBuilder.Create()
                                     .WithAlgorithm(new HMACSHA256Algorithm()) // symmetric
                                     .WithSecret(secret)
                                     .MustVerifySignature()
                                     .Decode<IDictionary<string, object>>(token);

                authEntity.ConsultantID = jwtValues["consultant_id"].ToString();
                authEntity.ConsultantName = jwtValues["name"].ToString();
                authEntity.AgencyCompanyCD = jwtValues["client_id"].ToString();
                authEntity.AgencyCompanyName = jwtValues.ContainsKey("client_name") == true ? jwtValues["client_name"].ToString() : "";

                // IP 주소 검증
                if (jwtValues.ContainsKey("client_ip"))
                {
                    string tokenClientIP = jwtValues["client_ip"].ToString();

                    // IP 주소 비교
                    if (!string.IsNullOrEmpty(tokenClientIP) && !string.IsNullOrEmpty(currentClientIP))
                    {
                        if (tokenClientIP != currentClientIP)
                        {
                            authEntity.ErrorCode = 400;
                            authEntity.ErrorMessage = "IP 주소가 일치하지 않습니다.";
                            return authEntity;
                        }
                    }
                }
            }
            catch (TokenExpiredException)
            {
                authEntity.ErrorCode = 300;
                authEntity.ErrorMessage = "인증된 토큰의 사용시간이 지났습니다.";
            }
            catch (SignatureVerificationException)
            {
                authEntity.ErrorCode = 200;
                authEntity.ErrorMessage = "인증키 오류";
            }
            catch (Exception)
            {
                authEntity.ErrorCode = 100;
                authEntity.ErrorMessage = "서버 오류";
            }

            return authEntity;
        }

        public static AuthEntity BCJWTVerifying(string token)
        {
            AuthEntity authEntity = new AuthEntity();
            authEntity.ErrorCode = 0;
            authEntity.ErrorMessage = "";

            try
            {
                const string secret = "zIg6d3d35kWIzhMd2F5hGNdZa5EyUEWw"; //Web
                var jwtValues = JwtBuilder.Create()
                                     .WithAlgorithm(new HMACSHA256Algorithm()) // symmetric
                                     .WithSecret(secret)
                                     .MustVerifySignature()
                                     .Decode<IDictionary<string, object>>(token);

                authEntity.ConsultantID = jwtValues["consultant_id"].ToString();
                authEntity.ConsultantName = jwtValues["name"].ToString();
                authEntity.AgencyCompanyCD = jwtValues["client_id"].ToString();
                authEntity.AgencyCompanyName = jwtValues.ContainsKey("client_name") == true ? jwtValues["client_name"].ToString() : "";
            }
            catch (TokenExpiredException)
            {
                authEntity.ErrorCode = 300;
                authEntity.ErrorMessage = "인증된 토큰의 사용시간이 지났습니다.";
            }
            catch (SignatureVerificationException)
            {
                authEntity.ErrorCode = 200;
                authEntity.ErrorMessage = "인증키 오류";
            }
            catch (Exception)
            {
                authEntity.ErrorCode = 100;
                authEntity.ErrorMessage = "서버 오류";
            }

            return authEntity;
        }

        public static AuthEntity JWTVerifying(string token, string remoteip = "")
        {
            AuthEntity authEntity = new AuthEntity();
            authEntity.ErrorCode = 0;

            if (String.IsNullOrEmpty(token) == true)
            {
                authEntity.ErrorCode = 100;
                authEntity.ErrorMessage = "인증토큰이 없습니다..(앱을 종료후 다시 실행하세요)";
                return authEntity;
            }

            AuthEntity pcAuthEntity = PCJWTVerifying(token, remoteip);
            AuthEntity bcAuthEntity = BCJWTVerifying(token);

            if (pcAuthEntity.ErrorCode == 300 || bcAuthEntity.ErrorCode == 300)
            {
                authEntity.ErrorCode = 300;
                authEntity.ErrorMessage = "인증된 토큰의 사용시간이 지났습니다.(앱을 종료후 다시 실행하세요)";
            }

            if (pcAuthEntity.ErrorCode == 0 || bcAuthEntity.ErrorCode == 0)
            {
                if (pcAuthEntity.ErrorCode == 0)
                {
                    authEntity.ConsultantID = pcAuthEntity.ConsultantID;
                    authEntity.ConsultantName = pcAuthEntity.ConsultantName;
                    authEntity.AgencyCompanyCD = pcAuthEntity.AgencyCompanyCD;
                    authEntity.AgencyCompanyName = pcAuthEntity.AgencyCompanyName;
                }
                else
                {
                    authEntity.ConsultantID = bcAuthEntity.ConsultantID;
                    authEntity.ConsultantName = bcAuthEntity.ConsultantName;
                    authEntity.AgencyCompanyCD = bcAuthEntity.AgencyCompanyCD;
                    authEntity.AgencyCompanyName = bcAuthEntity.AgencyCompanyName;
                }
            }
            else
            {
                authEntity.ErrorCode = 200;
                authEntity.ErrorMessage = "인증 중 오류가 발생하였습니다.(앱을 종료후 다시 실행하세요)";
            }

            return authEntity;
        }
    }
}