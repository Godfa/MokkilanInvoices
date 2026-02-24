using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.Interfaces;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly string _smtpHost;
        private readonly int _smtpPort;
        private readonly string _smtpUsername;
        private readonly string _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;
        private readonly string _appUrl;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
            _smtpHost = _config["Email:SmtpHost"];
            _smtpPort = int.TryParse(_config["Email:SmtpPort"], out var port) ? port : 587;
            _smtpUsername = _config["Email:SmtpUsername"];
            _smtpPassword = _config["Email:SmtpPassword"];
            _fromEmail = _config["Email:FromEmail"];
            _fromName = _config["Email:FromName"] ?? "Mökkilan Invoices";
            _appUrl = _config["Email:AppUrl"] ?? "https://your-app-url.com";
        }

        public async Task<bool> SendNewUserEmailAsync(string email, string displayName, string username, string temporaryPassword)
        {
            var subject = "Tervetuloa lanittajien laskutuspalveluun Mökkilan Invoices - Käyttäjätunnuksesi";
            var htmlContent = $@"
                <h2>Tervetuloa lanittajien laskutuspalveluun Mökkilan Invoices!</h2>
                <p>Hei {displayName},</p>
                <p>Käyttäjätilisi on luotu onnistuneesti. Tässä kirjautumistietosi:</p>
                <ul>
                    <li><strong>Käyttäjätunnus:</strong> {username}</li>
                    <li><strong>Sähköposti:</strong> {email}</li>
                    <li><strong>Väliaikainen salasana:</strong> {temporaryPassword}</li>
                </ul>
                <p><strong>Tärkeää:</strong> Sinua pyydetään vaihtamaan salasana ensimmäisen kirjautumisen yhteydessä tietoturvasyistä.</p>
                <p>Kirjaudu sisään osoitteessa: <a href=""{_appUrl}"">{_appUrl}</a></p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Tervetuloa lanittajien laskutuspalveluun Mökkilan Invoices!

Hei {displayName},

Käyttäjätilisi on luotu onnistuneesti. Tässä kirjautumistietosi:

Käyttäjätunnus: {username}
Sähköposti: {email}
Väliaikainen salasana: {temporaryPassword}

Tärkeää: Sinua pyydetään vaihtamaan salasana ensimmäisen kirjautumisen yhteydessä tietoturvasyistä.

Kirjaudu sisään osoitteessa: {_appUrl}

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailAsync(email, displayName, subject, plainTextContent, htmlContent);
        }

        public async Task<bool> SendPasswordResetEmailAsync(string email, string displayName, string username, string temporaryPassword)
        {
            var subject = "Salasanan nollaus - Mökkilan Invoices";
            var htmlContent = $@"
                <h2>Salasanan nollaus</h2>
                <p>Hei {displayName},</p>
                <p>Ylläpitäjä on nollannut salasanasi. Tässä kirjautumistietosi:</p>
                <ul>
                    <li><strong>Käyttäjätunnus:</strong> {username}</li>
                    <li><strong>Väliaikainen salasana:</strong> {temporaryPassword}</li>
                </ul>
                <p><strong>Tärkeää:</strong> Sinua pyydetään vaihtamaan tämä salasana seuraavan kirjautumisen yhteydessä tietoturvasyistä.</p>
                <p>Kirjaudu sisään osoitteessa: <a href=""{_appUrl}"">{_appUrl}</a></p>
                <p>Jos et pyytänyt tätä muutosta, ota välittömästi yhteyttä ylläpitäjään.</p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Salasanan nollaus

Hei {displayName},

Ylläpitäjä on nollannut salasanasi. Tässä kirjautumistietosi:

Käyttäjätunnus: {username}
Väliaikainen salasana: {temporaryPassword}

Tärkeää: Sinua pyydetään vaihtamaan tämä salasana seuraavan kirjautumisen yhteydessä tietoturvasyistä.

Kirjaudu sisään osoitteessa: {_appUrl}

Jos et pyytänyt tätä muutosta, ota välittömästi yhteyttä ylläpitäjään.

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailAsync(email, displayName, subject, plainTextContent, htmlContent);
        }

        public async Task<bool> SendPasswordResetLinkAsync(string email, string displayName, string resetLink)
        {
            var subject = "Salasanan nollauspyyntö - Mökkilan Invoices";
            var htmlContent = $@"
                <h2>Salasanan nollauspyyntö</h2>
                <p>Hei {displayName},</p>
                <p>Olemme vastaanottaneet pyynnön nollata salasanasi. Nollaa salasanasi klikkaamalla alla olevaa linkkiä:</p>
                <p><a href=""{resetLink}"" style=""display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;"">Nollaa salasana</a></p>
                <p>Tai kopioi linkki selaimeesi:</p>
                <p>{resetLink}</p>
                <p><strong>Linkki vanhenee 24 tunnin kuluttua.</strong></p>
                <p>Jos et pyytänyt salasanan nollausta, voit jättää tämän viestin huomiotta tai ottaa yhteyttä tukeen, jos sinulla on huolia.</p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Salasanan nollauspyyntö

Hei {displayName},

Olemme vastaanottaneet pyynnön nollata salasanasi. Nollaa salasanasi alla olevan linkin kautta:

{resetLink}

Linkki vanhenee 24 tunnin kuluttua.

Jos et pyytänyt salasanan nollausta, voit jättää tämän viestin huomiotta tai ottaa yhteyttä tukeen, jos sinulla on huolia.

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailAsync(email, displayName, subject, plainTextContent, htmlContent);
        }

        public async Task<bool> SendInvoiceReviewNotificationAsync(string email, string displayName, string invoiceTitle, string invoiceUrl)
        {
            var subject = $"Uusi lasku luotu: {invoiceTitle} - Mökkilan Invoices";
            var htmlContent = $@"
                <h2>Uusi lasku on luotu</h2>
                <p>Hei {displayName},</p>
                <p>Lasku <strong>{invoiceTitle}</strong> on luotu ja odottaa tarkistusta.</p>
                <p>Ole hyvä ja:</p>
                <ul>
                    <li>Lisää omat kulusi laskulle</li>
                    <li>Tarkista, että kaikki kulut ovat oikein</li>
                    <li>Hyväksy lasku kun olet tyytyväinen</li>
                </ul>
                <p><a href=""{invoiceUrl}"" style=""display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;"">Avaa lasku</a></p>
                <p>Tai kopioi linkki selaimeesi:</p>
                <p>{invoiceUrl}</p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Uusi lasku on luotu

Hei {displayName},

Lasku {invoiceTitle} on luotu ja odottaa tarkistusta.

Ole hyvä ja:
- Lisää omat kulusi laskulle
- Tarkista, että kaikki kulut ovat oikein
- Hyväksy lasku kun olet tyytyväinen


{invoiceUrl}

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailAsync(email, displayName, subject, plainTextContent, htmlContent);
        }

        public async Task<bool> SendInvoicePaymentNotificationAsync(string email, string displayName, string invoiceTitle, string invoiceUrl, List<EmailAttachment> attachments)
        {
            var subject = "Lasku siirtynyt maksuun - Mökkilan Invoices";
            var htmlContent = $@"
                <h2>Lasku on siirtynyt maksuun</h2>
                <p>Hei {displayName},</p>
                <p>Lasku <strong>{invoiceTitle}</strong> on hyväksytty ja siirtynyt maksuun.</p>
                <p>Liitteenä löydät:</p>
                <ul>
                    <li>Henkilökohtainen laskusi maksuosuuksineen</li>
                    <li>Kokonaiserittely kaikista kuluista</li>
                </ul>
                <p>Voit myös tarkastella laskua verkossa:</p>
                <p><a href=""{invoiceUrl}"" style=""display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;"">Avaa lasku</a></p>
                <p>Tai kopioi linkki selaimeesi:</p>
                <p>{invoiceUrl}</p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Lasku on siirtynyt maksuun

Hei {displayName},

Lasku {invoiceTitle} on hyväksytty ja siirtynyt maksuun.

Liitteenä löydät:
- Henkilökohtainen laskusi maksuosuuksineen
- Kokonaiserittely kaikista kuluista

Voit myös tarkastella laskua verkossa:
{invoiceUrl}

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailWithAttachmentsAsync(email, displayName, subject, plainTextContent, htmlContent, attachments);
        }

        public async Task<bool> SendInvoiceReminderEmailAsync(string email, string displayName, string invoiceTitle, string invoiceUrl)
        {
            var subject = $"Muistutus: Lasku odottaa hyväksyntääsi: {invoiceTitle} - Mökkilan Invoices";
            var htmlContent = $@"
                <h2>Lasku odottaa yhä hyväksyntääsi</h2>
                <p>Hei {displayName},</p>
                <p>Tämä on muistutus, että lasku <strong>{invoiceTitle}</strong> odottaa edelleen tarkistustasi ja hyväksyntääsi.</p>
                <p>Ole hyvä ja:</p>
                <ul>
                    <li>Lisää omat kulusi laskulle</li>
                    <li>Tarkista, että kaikki kulut ovat oikein</li>
                    <li>Hyväksy lasku kun olet tyytyväinen</li>
                </ul>
                <p><a href=""{invoiceUrl}"" style=""display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;"">Avaa lasku</a></p>
                <p>Tai kopioi linkki selaimeesi:</p>
                <p>{invoiceUrl}</p>
                <br>
                <p>Terveisin,<br>Mökkilan Invoices</p>
            ";

            var plainTextContent = $@"
Lasku odottaa yhä hyväksyntääsi

Hei {displayName},

Tämä on muistutus, että lasku {invoiceTitle} odottaa edelleen tarkistustasi ja hyväksyntääsi.

Ole hyvä ja:
- Lisää omat kulusi laskulle
- Tarkista, että kaikki kulut ovat oikein
- Hyväksy lasku kun olet tyytyväinen


{invoiceUrl}

Terveisin,
Mökkilan Invoices
            ";

            return await SendEmailAsync(email, displayName, subject, plainTextContent, htmlContent);
        }

        private async Task<bool> SendEmailAsync(string toEmail, string toName, string subject, string plainTextContent, string htmlContent)
        {
            if (string.IsNullOrEmpty(_smtpHost))
            {
                _logger.LogWarning("SMTP host is not configured. Email will not be sent to {Email}", toEmail);
                return false;
            }

            if (string.IsNullOrEmpty(_fromEmail))
            {
                _logger.LogWarning("FromEmail is not configured. Email will not be sent to {Email}", toEmail);
                return false;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress(toName, toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder
                {
                    TextBody = plainTextContent,
                    HtmlBody = htmlContent
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();

                await client.ConnectAsync(_smtpHost, _smtpPort, MailKit.Security.SecureSocketOptions.StartTls);

                // Authenticate if credentials are provided
                if (!string.IsNullOrEmpty(_smtpUsername) && !string.IsNullOrEmpty(_smtpPassword))
                {
                    await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                }

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email sent successfully to {Email}", toEmail);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while sending email to {Email}", toEmail);
                return false;
            }
        }

        private async Task<bool> SendEmailWithAttachmentsAsync(string toEmail, string toName, string subject, string plainTextContent, string htmlContent, List<EmailAttachment> attachments)
        {
            if (string.IsNullOrEmpty(_smtpHost))
            {
                _logger.LogWarning("SMTP host is not configured. Email will not be sent to {Email}", toEmail);
                return false;
            }

            if (string.IsNullOrEmpty(_fromEmail))
            {
                _logger.LogWarning("FromEmail is not configured. Email will not be sent to {Email}", toEmail);
                return false;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress(toName, toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder
                {
                    TextBody = plainTextContent,
                    HtmlBody = htmlContent
                };

                // Add attachments if any
                if (attachments != null && attachments.Any())
                {
                    foreach (var attachment in attachments)
                    {
                        bodyBuilder.Attachments.Add(attachment.FileName, attachment.Content, ContentType.Parse(attachment.ContentType));
                    }
                }

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();

                await client.ConnectAsync(_smtpHost, _smtpPort, MailKit.Security.SecureSocketOptions.StartTls);

                // Authenticate if credentials are provided
                if (!string.IsNullOrEmpty(_smtpUsername) && !string.IsNullOrEmpty(_smtpPassword))
                {
                    await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                }

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email with {AttachmentCount} attachments sent successfully to {Email}", attachments?.Count ?? 0, toEmail);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while sending email with attachments to {Email}", toEmail);
                return false;
            }
        }
    }
}
