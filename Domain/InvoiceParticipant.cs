using System;
using System.Text.Json.Serialization;

namespace Domain
{
    public class InvoiceParticipant
    {
        public Guid InvoiceId { get; set; }

        [JsonIgnore]
        public Invoice Invoice { get; set; }

        public string AppUserId { get; set; }
        public User AppUser { get; set; }

        public DateTime? LastReminderSentAt { get; set; }

        public bool HasPaid { get; set; }
        public DateTime? PaidAt { get; set; }
    }
}
