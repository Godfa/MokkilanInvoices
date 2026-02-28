using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Invoices;
using Domain;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Xunit;

namespace Application.UnitTests.Invoices
{
    public class TogglePaymentStatusTests
    {
        private (DataContext context, DbContextOptions<DataContext> options) GetContext()
        {
            var options = new DbContextOptionsBuilder<DataContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return (new DataContext(options), options);
        }

        [Fact]
        public async Task Handle_ShouldTogglePaymentStatus_WhenValidParticipant()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var userId = "user-1";
            var participant = new InvoiceParticipant { AppUserId = userId, HasPaid = false, PaidAt = null };

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Maksussa,
                Participants = new List<InvoiceParticipant> { participant }
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = userId,
                CurrentUserId = userId,
                IsAdmin = false
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            using (var assertContext = new DataContext(options))
            {
                var toggledParticipant = await assertContext.Invoices
                    .Include(i => i.Participants)
                    .Where(i => i.Id == invoiceId)
                    .SelectMany(i => i.Participants)
                    .FirstOrDefaultAsync(p => p.AppUserId == userId);

                Assert.NotNull(toggledParticipant);
                Assert.True(toggledParticipant.HasPaid);
                Assert.NotNull(toggledParticipant.PaidAt);
            }
        }

        [Fact]
        public async Task Handle_ShouldUntogglePaymentStatus_WhenValidParticipant()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var userId = "user-1";
            var participant = new InvoiceParticipant { AppUserId = userId, HasPaid = true, PaidAt = DateTime.UtcNow };

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Maksussa,
                Participants = new List<InvoiceParticipant> { participant }
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = userId,
                CurrentUserId = userId,
                IsAdmin = false
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            using (var assertContext = new DataContext(options))
            {
                var toggledParticipant = await assertContext.Invoices
                    .Include(i => i.Participants)
                    .Where(i => i.Id == invoiceId)
                    .SelectMany(i => i.Participants)
                    .FirstOrDefaultAsync(p => p.AppUserId == userId);

                Assert.NotNull(toggledParticipant);
                Assert.False(toggledParticipant.HasPaid);
                Assert.Null(toggledParticipant.PaidAt);
            }
        }

        [Fact]
        public async Task Handle_ShouldAllowAdminToToggleOtherUsersPaymentStatus()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var targetUserId = "user-1";
            var adminId = "admin-1";
            var participant = new InvoiceParticipant { AppUserId = targetUserId, HasPaid = false, PaidAt = null };

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Maksussa,
                Participants = new List<InvoiceParticipant> { participant }
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = targetUserId,
                CurrentUserId = adminId,
                IsAdmin = true
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            using (var assertContext = new DataContext(options))
            {
                var toggledParticipant = await assertContext.Invoices
                    .Include(i => i.Participants)
                    .Where(i => i.Id == invoiceId)
                    .SelectMany(i => i.Participants)
                    .FirstOrDefaultAsync(p => p.AppUserId == targetUserId);

                Assert.NotNull(toggledParticipant);
                Assert.True(toggledParticipant.HasPaid);
            }
        }

        [Fact]
        public async Task Handle_ShouldThrowException_WhenUserTriesToToggleAnotherUsersStatusWithoutAdmin()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var targetUserId = "user-1";
            var currentUserId = "user-2";
            var participant = new InvoiceParticipant { AppUserId = targetUserId, HasPaid = false, PaidAt = null };

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Maksussa,
                Participants = new List<InvoiceParticipant> { participant }
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = targetUserId,
                CurrentUserId = currentUserId,
                IsAdmin = false
            };

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_ShouldThrowException_WhenInvoiceNotInMaksussaStatus()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var userId = "user-1";
            var participant = new InvoiceParticipant { AppUserId = userId, HasPaid = false, PaidAt = null };

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Aktiivinen, // Not Maksussa
                Participants = new List<InvoiceParticipant> { participant }
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = userId,
                CurrentUserId = userId,
                IsAdmin = false
            };

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_ShouldThrowException_WhenUserNotParticipant()
        {
            // Arrange
            var (context, options) = GetContext();
            var invoiceId = Guid.NewGuid();
            var userId = "user-1";

            context.Invoices.Add(new Invoice
            {
                Id = invoiceId,
                Status = InvoiceStatus.Maksussa,
                Participants = new List<InvoiceParticipant>() // Empty participants
            });
            await context.SaveChangesAsync();

            var handler = new TogglePaymentStatus.Handler(context);
            var command = new TogglePaymentStatus.Command
            {
                InvoiceId = invoiceId,
                AppUserId = userId,
                CurrentUserId = userId,
                IsAdmin = false
            };

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => handler.Handle(command, CancellationToken.None));
        }
    }
}
