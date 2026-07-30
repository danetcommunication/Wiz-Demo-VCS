using System.Net;  
using System.Net.Http;  
using System.Web;  
using System.Web.Http;  
using DAL.Classes;  
using TicketingWebApi.Filters;  
  
namespace TicketingWebApi.Controllers  
{  
    [ExceptionInterceptorFilter]  
    [ActionInterceptorFilter]  
    [RoutePrefix("file/downloader")]  
    public class FileDownloadController : ApiController  
    {  
        private const string SomethingWentWrong = "Argh! Something went wrong. Please try again in a few minutes";  
        private readonly FileDownloadHelper fileDownloadHelper;  
        private readonly AteraUserPrincipal _currentUser;  
  
        public FileDownloadController()  
        {  
            _currentUser = HttpContext.Current.User as AteraUserPrincipal;  
            if (string.IsNullOrEmpty(_currentUser.AccountId) || string.IsNullOrEmpty(_currentUser.ConnString))  
                throw new HttpResponseException(Request.CreateErrorResponse(HttpStatusCode.BadRequest, SomethingWentWrong));  
  
            fileDownloadHelper = new FileDownloadHelper();  
        }  
  
        [Route("blob")]  
        [HttpPost, HttpGet]  
        public string GetSecuredBlobUrl(string url)  
        {  
            return fileDownloadHelper.GetSecuredBlobUrl(url, SasTokenExpiration.QuarterHour);  
        }  
  
        [Route("preview")]  
        [HttpGet]  
        public HttpResponseMessage GetBlobForPreview(string url)  
        {  
            var securedUrl = fileDownloadHelper.GetSecuredBlobUrl(url, SasTokenExpiration.QuarterHour);  
  
            using (var client = new HttpClient())  
            {  
                var response = client.GetAsync(securedUrl).Result;  
                if (!response.IsSuccessStatusCode)  
                {  
                    throw new HttpResponseException(Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Failed to download blob"));  
                }  
  
                var result = new HttpResponseMessage(HttpStatusCode.OK)  
                {  
                    Content = new ByteArrayContent(response.Content.ReadAsByteArrayAsync().Result)  
                };  
                result.Content.Headers.ContentType = response.Content.Headers.ContentType;  
                return result;  
            }  
        }  
  
    }  
}  
