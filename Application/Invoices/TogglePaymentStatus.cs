using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Invoices
{
    public class TogglePaymentStatus
    {
        public class Command : IRequest<Unit>
        {
            public Guid InvoiceId { get; set; }
            public string AppUserId { get; set; }
            public string CurrentUserId { get; set; }
            public bool IsAdmin { get; set; }
        }

        public class Handler : IRequestHandler<Command, Unit>
        {
            private readonly DataContext _context;

            public Handler(DataContext context)
            {
                _context = context;
            }

            public async Task<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                var invoice = await _context.Invoices
                    .Include(i => i.Participants)
                    .FirstOrDefaultAsync(x => x.Id == request.InvoiceId);

                if (invoice == null) throw new Exception("Laskua ei löytynyt.");

                // Validate that invoice is in 'Maksussa' state
                if (invoice.Status != Domain.InvoiceStatus.Maksussa)
                    throw new Exception("Maksun tilaa voi muuttaa vain, kun lasku on 'Maksussa' -tilassa.");

                // Validate permissions: Only the participant themselves or an Admin can change the status
                if (!request.IsAdmin && request.CurrentUserId != request.AppUserId)
                    throw new Exception("You can only change your own payment status unless you are an Admin.");

                var participant = invoice.Participants.FirstOrDefault(p => p.AppUserId == request.AppUserId);

                if (participant == null) throw new Exception("User is not a participant in this invoice.");

                participant.HasPaid = !participant.HasPaid;
                participant.PaidAt = participant.HasPaid ? DateTime.UtcNow : null;

                var result = await _context.SaveChangesAsync() > 0;

                if (!result && invoice.Participants.Count > 0) throw new Exception("Failed to update payment status");

                return Unit.Value;
            }
        }
    }
}
