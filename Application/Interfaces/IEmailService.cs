using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public class EmailAttachment
    {
        public string FileName { get; set; }
        public byte[] Content { get; set; }
        public string ContentType { get; set; }
    }

    public interface IEmailService
    {
        Task<bool> SendNewUserEmailAsync(string email, string displayName, string username, string temporaryPassword);
        Task<bool> SendPasswordResetEmailAsync(string email, string displayName, string username, string temporaryPassword);
        Task<bool> SendPasswordResetLinkAsync(string email, string displayName, string resetLink);
        Task<bool> SendInvoiceReviewNotificationAsync(string email, string displayName, string invoiceTitle, string invoiceUrl);
        Task<bool> SendInvoicePaymentNotificationAsync(string email, string displayName, string invoiceTitle, string invoiceUrl, List<EmailAttachment> attachments);
        Task<bool> SendInvoiceReminderEmailAsync(string email, string displayName, string invoiceTitle, string invoiceUrl);
    }
}
