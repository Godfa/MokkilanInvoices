import { observer } from "mobx-react-lite";
import React, { useState } from "react";
import { Button, Icon, Label, Modal } from "semantic-ui-react";
import { useStore } from "../../../app/stores/store";
import { Link, useNavigate } from "react-router-dom";
import { InvoiceStatus } from "../../../app/models/invoice";


export default observer(function InvoiceList() {
    const { invoiceStore, userStore } = useStore();
    const { deleteInvoice, Invoices, loading, approveInvoice, unapproveInvoice, togglePaymentStatus } = invoiceStore;
    const { user } = userStore;
    const navigate = useNavigate();

    const [target, setTarget] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; title: string } | null>(null);

    function openDeleteModal(invoice: { id: string; title: string }) {
        setInvoiceToDelete(invoice);
        setDeleteModalOpen(true);
    }

    function handleInvoiceDelete() {
        if (!invoiceToDelete) return;
        setTarget(invoiceToDelete.id);
        deleteInvoice(invoiceToDelete.id);
        setDeleteModalOpen(false);
        setInvoiceToDelete(null);
    }

    function getStatusLabel(status: InvoiceStatus): string {
        switch (status) {
            case InvoiceStatus.Aktiivinen: return 'Aktiivinen';
            case InvoiceStatus.Maksussa: return 'Maksussa';
            case InvoiceStatus.Arkistoitu: return 'Arkistoitu';
            default: return 'Tuntematon';
        }
    }

    function getStatusColor(status: InvoiceStatus): "red" | "orange" | "green" | "grey" {
        switch (status) {
            case InvoiceStatus.Aktiivinen: return 'green';
            case InvoiceStatus.Maksussa: return 'orange';
            case InvoiceStatus.Arkistoitu: return 'grey';
            default: return 'grey';
        }
    }

    if (Invoices.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <Icon name="file alternate outline" />
                </div>
                <div className="empty-state-title">Ei laskuja</div>
                <div className="empty-state-description">
                    Luo ensimmäinen laskusi aloittaaksesi.
                </div>
                <Button
                    as={Link}
                    to="/createInvoice"
                    className="btn-primary"
                    style={{ marginTop: 'var(--spacing-lg)' }}
                >
                    <Icon name="plus" /> Luo lasku
                </Button>
            </div>
        );
    }

    return (
        <div className="invoice-grid">
            {Invoices.map(invoice => {
                const hasApproved = invoice.approvals?.some(a => a.appUserId === user?.id) || false;
                const isParticipant = invoice.participants?.some(p => p.appUserId === user?.id) || false;
                const isAdmin = user?.roles?.includes('Admin') || false;
                const canInteractWithApproval = invoice.status === InvoiceStatus.Aktiivinen && (isParticipant || isAdmin);

                const participantDetails = invoice.participants?.find(p => p.appUserId === user?.id);
                const hasPaid = participantDetails?.hasPaid || false;
                const canInteractWithPayment = invoice.status === InvoiceStatus.Maksussa && (isParticipant || isAdmin);

                const approvalCount = invoice.approvals?.length || 0;
                const participantCount = invoice.participants?.length || 0;
                const allApproved = participantCount > 0 && approvalCount === participantCount;

                const handleToggleApproval = () => {
                    if (user?.id) {
                        setTarget(`approve-${invoice.id}`);
                        if (hasApproved) {
                            unapproveInvoice(invoice.id, user.id);
                        } else {
                            approveInvoice(invoice.id, user.id);
                        }
                    }
                };

                const handleTogglePayment = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (user?.id) {
                        setTarget(`pay-${invoice.id}`);
                        togglePaymentStatus(invoice.id, user.id);
                    }
                };

                const handleCardClick = () => {
                    navigate(`/invoices/${invoice.id}`);
                };

                return (
                    <div
                        key={invoice.id}
                        className="invoice-card"
                        onClick={handleCardClick}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="invoice-card-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    <h3 className="invoice-card-title" style={{ margin: 0 }}>{invoice.title}</h3>
                                    <Label color={getStatusColor(invoice.status)} size="small">
                                        {getStatusLabel(invoice.status)}
                                    </Label>
                                    {hasApproved && invoice.status === InvoiceStatus.Aktiivinen && (
                                        <Icon name="check circle" style={{ color: '#21ba45' }} title="Olet hyväksynyt" />
                                    )}
                                    {hasPaid && invoice.status === InvoiceStatus.Maksussa && (
                                        <Icon name="money bill alternate" style={{ color: '#21ba45' }} title="Olet maksanut" />
                                    )}
                                    {participantCount > 0 && (
                                        <Label size="small" style={{ backgroundColor: allApproved ? '#21ba45' : '#767676', color: 'white' }}>
                                            {approvalCount}/{participantCount} hyväksytty
                                        </Label>
                                    )}
                                </div>
                                <div className="invoice-card-meta">
                                    LAN #{invoice.lanNumber}
                                </div>
                            </div>
                            <div className="invoice-card-amount">
                                {invoice.amount?.toFixed(2)}€
                            </div>
                        </div>

                        {invoice.description && (
                            <div className="invoice-card-description">
                                {invoice.description}
                            </div>
                        )}

                        <div className="invoice-card-actions" onClick={(e) => e.stopPropagation()}>
                            {canInteractWithApproval && (
                                <Button
                                    onClick={(e) => { e.stopPropagation(); handleToggleApproval(); }}
                                    className={hasApproved ? "btn-secondary" : "btn-success"}
                                    size="small"
                                    loading={loading && target === `approve-${invoice.id}`}
                                    disabled={loading}
                                >
                                    <Icon name={hasApproved ? "times" : "check"} />
                                    {hasApproved ? "Peru hyväksyntä" : "Hyväksy lasku"}
                                </Button>
                            )}
                            {canInteractWithPayment && (
                                <Button
                                    onClick={handleTogglePayment}
                                    className={hasPaid ? "btn-secondary" : "btn-success"}
                                    size="small"
                                    loading={loading && target === `pay-${invoice.id}`}
                                    disabled={loading}
                                >
                                    <Icon name={hasPaid ? "undo" : "money bill alternate"} />
                                    {hasPaid ? "Peru maksumerkintä" : "Merkitse maksetuksi"}
                                </Button>
                            )}
                            <Button
                                as={Link}
                                to={`/invoices/${invoice.id}`}
                                className="btn-primary"
                                size="small"
                            >
                                <Icon name="eye" /> Näytä
                            </Button>
                            {isAdmin && (
                                <Button
                                    onClick={() => openDeleteModal({ id: invoice.id, title: invoice.title })}
                                    className="btn-danger"
                                    size="small"
                                >
                                    <Icon name="trash" /> Poista
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Delete Invoice Confirmation Modal */}
            <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} size='small'>
                <Modal.Header>Poista lasku</Modal.Header>
                <Modal.Content>
                    <p>Haluatko varmasti poistaa laskun <strong>{invoiceToDelete?.title}</strong>?</p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-md)' }}>
                        Tämä toiminto ei ole palautettavissa.
                    </p>
                </Modal.Content>
                <Modal.Actions>
                    <Button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Peruuta</Button>
                    <Button
                        color='red'
                        onClick={handleInvoiceDelete}
                        loading={loading && target === invoiceToDelete?.id}
                    >
                        <Icon name='trash' /> Poista lasku
                    </Button>
                </Modal.Actions>
            </Modal>
        </div>
    )
})
