import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Icon } from "semantic-ui-react";
import { useStore } from "../../../app/stores/store";
import { toast } from "react-toastify";
import PaymentSettlement from "./PaymentSettlement";
import { InvoiceStatus } from "../../../app/models/invoice";

interface Props {
    invoiceId: string;
}

export default observer(function ParticipantList({ invoiceId }: Props) {
    const { invoiceStore, userStore } = useStore();
    const { selectedInvoice, addParticipant, removeParticipant, loadUsers, PotentialParticipants, loading, addUsualSuspects, approveInvoice, unapproveInvoice, togglePaymentStatus } = invoiceStore;
    const { user } = userStore;

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    if (!selectedInvoice) return null;

    const isInvoiceLocked = selectedInvoice.status === InvoiceStatus.Maksussa || selectedInvoice.status === InvoiceStatus.Arkistoitu;
    const isAdmin = user?.roles?.includes('Admin') || false;

    const participants = selectedInvoice.participants || [];
    const participantIds = participants.map(p => p.appUserId);

    const handleAddParticipant = async (userId: string) => {
        await addParticipant(invoiceId, userId);
    };

    const handleRemoveParticipant = async (userId: string) => {
        await removeParticipant(invoiceId, userId);
    };

    const handleAddAllParticipants = async () => {
        invoiceStore.loading = true;
        try {
            const nonParticipants = PotentialParticipants.filter(c => !participantIds.includes(c.key));
            await Promise.all(
                nonParticipants.map(user =>
                    addParticipant(invoiceId, user.key, true)
                )
            );
            if (nonParticipants.length > 0) {
                toast.success(`${nonParticipants.length} osallistujaa lisätty`);
            }
        } finally {
            invoiceStore.loading = false;
        }
    };

    const handleAddUsualSuspects = async () => {
        await addUsualSuspects(invoiceId);
    };

    const handleRemoveAllParticipants = async () => {
        invoiceStore.loading = true;
        try {
            await Promise.all(
                participants.map(p =>
                    removeParticipant(invoiceId, p.appUserId, true)
                )
            );
            toast.success('Kaikki osallistujat poistettu');
        } finally {
            invoiceStore.loading = false;
        }
    };

    const handleApproveAllParticipants = async () => {
        invoiceStore.loading = true;
        try {
            const unapprovedParticipants = participants.filter(p =>
                !selectedInvoice.approvals?.some(a => a.appUserId === p.appUserId)
            );

            if (unapprovedParticipants.length === 0) {
                toast.info('Kaikki osallistujat on jo hyväksynyt');
                return;
            }

            // Process approvals in parallel
            await Promise.all(
                unapprovedParticipants.map(p =>
                    approveInvoice(invoiceId, p.appUserId)
                )
            );

            // After all approvals, check if all participants have approved and send notifications
            await invoiceStore.sendPaymentNotifications(invoiceId);

            toast.success(`${unapprovedParticipants.length} osallistujan hyväksyntä lisätty`);
        } finally {
            invoiceStore.loading = false;
        }
    };

    const nonParticipantCount = PotentialParticipants.filter(c => !participantIds.includes(c.key)).length;
    const usualSuspects = ['Epi', 'JHattu', 'Leivo', 'Timo', 'Jaapu', 'Urpi', 'Zeip'];
    const usualSuspectsToAdd = PotentialParticipants.filter(c =>
        usualSuspects.some(suspect => c.value.includes(suspect)) && !participantIds.includes(c.key)
    ).length;

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div>
            {/* Maksuerittely */}
            <PaymentSettlement invoice={selectedInvoice} compact={false} />

            {/* Osallistujalista */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                    <h3 style={{ margin: 0 }}>Osallistujat</h3>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                        {isAdmin && selectedInvoice.status === InvoiceStatus.Aktiivinen && participants.length > 0 && (
                            <Button
                                size='tiny'
                                className='btn-success'
                                onClick={handleApproveAllParticipants}
                                loading={loading}
                                disabled={loading}
                            >
                                <Icon name='check circle' /> Hyväksy kaikkien puolesta
                            </Button>
                        )}
                        {participants.length > 0 && (
                            <Button
                                size='tiny'
                                className='btn-danger'
                                onClick={handleRemoveAllParticipants}
                                loading={loading}
                                disabled={loading || isInvoiceLocked}
                            >
                                <Icon name='trash' /> Poista kaikki
                            </Button>
                        )}
                        {usualSuspectsToAdd > 0 && (
                            <Button
                                size='tiny'
                                className='btn-primary'
                                onClick={handleAddUsualSuspects}
                                loading={loading}
                                disabled={loading || isInvoiceLocked}
                            >
                                <Icon name='users' /> Vakkarit ({usualSuspectsToAdd})
                            </Button>
                        )}
                        {nonParticipantCount > 0 && (
                            <Button
                                size='tiny'
                                className='btn-success'
                                onClick={handleAddAllParticipants}
                                loading={loading}
                                disabled={loading || isInvoiceLocked}
                            >
                                <Icon name='plus' /> Lisää kaikki ({nonParticipantCount})
                            </Button>
                        )}
                    </div>
                </div>

                {/* Current Participants */}
                <div className="participant-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    {participants.length > 0 ? (
                        participants.map(p => {
                            const hasApproved = selectedInvoice.approvals?.some(a => a.appUserId === p.appUserId) || false;
                            const hasPaid = p.hasPaid || false;
                            const isCurrentUser = user?.id === p.appUserId;

                            // Approval interaction only in Aktiivinen phase
                            const canInteractWithApproval = selectedInvoice.status === InvoiceStatus.Aktiivinen && (isCurrentUser || isAdmin);

                            // Payment interaction only in Maksussa phase
                            const canInteractWithPayment = selectedInvoice.status === InvoiceStatus.Maksussa && (isCurrentUser || isAdmin);

                            const handleToggleApproval = async () => {
                                if (hasApproved) {
                                    await unapproveInvoice(invoiceId, p.appUserId);
                                } else {
                                    await approveInvoice(invoiceId, p.appUserId);
                                    // Check if this might be the last approval and trigger notifications
                                    await invoiceStore.sendPaymentNotifications(invoiceId);
                                }
                            };

                            const handleTogglePayment = async () => {
                                await togglePaymentStatus(invoiceId, p.appUserId);
                            };

                            return (
                                <div key={p.appUserId} className="participant-card" style={{ position: 'relative' }}>
                                    {selectedInvoice.status === InvoiceStatus.Aktiivinen && hasApproved && (
                                        <Icon
                                            name='check circle'
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                color: '#21ba45',
                                                fontSize: '1.2em'
                                            }}
                                            title="Hyväksytty"
                                        />
                                    )}
                                    {selectedInvoice.status === InvoiceStatus.Maksussa && hasPaid && (
                                        <Icon
                                            name='money bill alternate'
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                color: '#21ba45',
                                                fontSize: '1.2em'
                                            }}
                                            title={`Maksettu ${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''}`}
                                        />
                                    )}
                                    <div className="participant-avatar">
                                        {getInitials(p.appUser.displayName)}
                                    </div>
                                    <span className="participant-name">{p.appUser.displayName}</span>

                                    {canInteractWithApproval && (
                                        <Button
                                            size='mini'
                                            className={hasApproved ? 'btn-secondary' : 'btn-success'}
                                            onClick={handleToggleApproval}
                                            loading={loading}
                                            disabled={loading}
                                            style={{ marginLeft: 'auto' }}
                                        >
                                            <Icon name={hasApproved ? 'times' : 'check'} />
                                            {hasApproved ? 'Peru' : 'Hyväksy'}
                                        </Button>
                                    )}

                                    {canInteractWithPayment && (
                                        <Button
                                            size='mini'
                                            className={hasPaid ? 'btn-secondary' : 'btn-success'}
                                            onClick={handleTogglePayment}
                                            loading={loading}
                                            disabled={loading}
                                            style={{ marginLeft: 'auto' }}
                                            title={hasPaid ? "Peru maksumerkintä" : "Merkitse maksetuksi"}
                                        >
                                            <Icon name={hasPaid ? 'undo' : 'money bill alternate'} />
                                            {hasPaid ? 'Peru' : 'Maksettu'}
                                        </Button>
                                    )}

                                    <Button
                                        size='mini'
                                        icon='print'
                                        as={Link}
                                        to={`/invoices/${invoiceId}/print/${p.appUserId}`}
                                        style={{ marginLeft: (canInteractWithApproval || canInteractWithPayment) ? '0' : 'auto', padding: '4px', background: 'transparent', color: 'var(--text-muted)' }}
                                        title="Tulosta osuus"
                                    />
                                    <Button
                                        size='mini'
                                        icon='close'
                                        onClick={() => handleRemoveParticipant(p.appUserId)}
                                        loading={loading}
                                        disabled={loading || isInvoiceLocked}
                                        style={{ padding: '4px', background: 'transparent', color: 'var(--text-muted)' }}
                                    />
                                </div>
                            );
                        })
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Ei osallistujia vielä</p>
                    )}
                </div>

                {/* Add Participants */}
                {PotentialParticipants.filter(c => !participantIds.includes(c.key)).length > 0 && (
                    <>
                        <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Lisää osallistuja</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                            {PotentialParticipants
                                .filter(c => !participantIds.includes(c.key))
                                .map(user => (
                                    <Button
                                        key={user.key}
                                        size='tiny'
                                        className='btn-secondary'
                                        onClick={() => handleAddParticipant(user.key)}
                                        loading={loading}
                                        disabled={loading || isInvoiceLocked}
                                    >
                                        <Icon name='plus' /> {user.value}
                                    </Button>
                                ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});
