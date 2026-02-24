using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Interfaces;
using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Persistence;

namespace API.Services
{
    public class InvoiceReminderBackgroundService : BackgroundService
    {
        private readonly ILogger<InvoiceReminderBackgroundService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly IConfiguration _config;
        private readonly TimeSpan _checkInterval;

        public InvoiceReminderBackgroundService(
            ILogger<InvoiceReminderBackgroundService> logger,
            IServiceProvider serviceProvider,
            IConfiguration config)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _config = config;

            // Default to 1 day if not configured
            var intervalHours = config.GetValue<int?>("Email:ReminderIntervalHours") ?? 24;
            _checkInterval = TimeSpan.FromHours(intervalHours);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Invoice Reminder Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessRemindersAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred executing Invoice Reminder Background Service.");
                }

                _logger.LogInformation("Invoice Reminder Background Service is waiting for next cycle in {Hours} hours.", _checkInterval.TotalHours);
                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task ProcessRemindersAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<DataContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            var appUrl = _config["Email:AppUrl"] ?? "http://localhost:3000";

            var twoDaysAgo = DateTime.UtcNow.AddDays(-2);

            _logger.LogInformation("Checking for unapproved active invoices...");

            // Find all active invoices
            var activeInvoices = await context.Invoices
                .Include(i => i.Participants)
                    .ThenInclude(p => p.AppUser)
                .Include(i => i.Approvals)
                .Where(i => i.Status == InvoiceStatus.Aktiivinen)
                .ToListAsync(stoppingToken);

            int reminderCount = 0;

            foreach (var invoice in activeInvoices)
            {
                // Find participants who haven't approved
                var approvedUserIds = invoice.Approvals.Select(a => a.AppUserId).ToHashSet();

                var participantsToRemind = invoice.Participants
                    .Where(p => !approvedUserIds.Contains(p.AppUserId))
                    .ToList();

                foreach (var participant in participantsToRemind)
                {
                    // Check if they need a reminder
                    bool needsReminder = false;

                    if (participant.LastReminderSentAt.HasValue)
                    {
                        if (participant.LastReminderSentAt.Value < twoDaysAgo)
                        {
                            needsReminder = true;
                        }
                    }
                    else
                    {
                        // Assume no reminder was sent yet. Set the date now to start the 2-day clock.
                        // We don't want to spam them immediately upon creation, so we just initialize it.
                        participant.LastReminderSentAt = DateTime.UtcNow;
                        reminderCount++; // Count as updated
                    }

                    if (needsReminder)
                    {
                        var invoiceUrl = $"{appUrl}/invoices/{invoice.Id}";
                        var success = await emailService.SendInvoiceReminderEmailAsync(
                            participant.AppUser.Email,
                            participant.AppUser.DisplayName,
                            invoice.Title,
                            invoiceUrl);

                        if (success)
                        {
                            participant.LastReminderSentAt = DateTime.UtcNow;
                            reminderCount++;
                            _logger.LogInformation("Sent reminder for invoice {InvoiceId} to {User}", invoice.Id, participant.AppUser.Email);
                        }
                    }
                }
            }

            if (reminderCount > 0)
            {
                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Sent {Count} reminders and updated database.", reminderCount);
            }
            else
            {
                _logger.LogInformation("No reminders needed at this time.");
            }
        }
    }
}
