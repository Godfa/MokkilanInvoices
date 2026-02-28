import React, { useEffect, useState } from "react";
import { Button, Icon, Dropdown } from "semantic-ui-react";
import LoadingComponent from "../../../app/layout/LoadingComponent";
import { useStore } from "../../../app/stores/store";
import ExpenseItemList from "./ExpenseItemList";
import ParticipantList from "./ParticipantList";
import { Link, useParams, useLocation } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { InvoiceStatus } from "../../../app/models/invoice";

export default observer(function InvoiceDetails() {
    const { invoiceStore, userStore } = useStore();
    const { selectedInvoice: invoice, loadInvoice, loadingInitial, changeInvoiceStatus, loading, approveInvoice, unapproveInvoice, togglePaymentStatus } = invoiceStore;
    const { user } = userStore;
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'expenses' | 'participants'>('expenses');

    const statusOptions = [
        { key: InvoiceStatus.Aktiivinen, text: 'Aktiivinen', value: InvoiceStatus.Aktiivinen },
        { key: InvoiceStatus.Maksussa, text: 'Maksussa', value: InvoiceStatus.Maksussa },
        { key: InvoiceStatus.Arkistoitu, text: 'Arkistoitu', value: InvoiceStatus.Arkistoitu }
    ];

    function getStatusLabel(status: InvoiceStatus): string {
        switch (status) {
            case InvoiceStatus.Aktiivinen: return 'Aktiivinen';
            case InvoiceStatus.Maksussa: return 'Maksussa';
            case InvoiceStatus.Arkistoitu: return 'Arkistoitu';
            default: return 'Tuntematon';
        }
    }

    useEffect(() => {
        if (id) {
            loadInvoice(id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'participants') {
            setActiveTab('participants');
        } else if (tab === 'expenses') {
            setActiveTab('expenses');
        }
    }, [location.search]);

    if (loadingInitial || !invoice) return <LoadingComponent content="Ladataan laskua..." />;

    // Check if current user can approve
    const isAdmin = user?.roles?.includes('Admin') || false;
    const hasApproved = invoice.approvals?.some(a => a.appUserId === user?.id) || false;
    const isParticipant = invoice.participants?.some(p => p.appUserId === user?.id) || false;
    const canInteractWithApproval = invoice.status === InvoiceStatus.Aktiivinen && (isParticipant || isAdmin);

    const participantDetails = invoice.participants?.find(p => p.appUserId === user?.id);
    const hasPaid = participantDetails?.hasPaid || false;
    const canInteractWithPayment = invoice.status === InvoiceStatus.Maksussa && (isParticipant || isAdmin);

    const handleToggleApproval = async () => {
        if (user?.id && invoice.id) {
            if (hasApproved) {
                await unapproveInvoice(invoice.id, user.id);
            } else {
                await approveInvoice(invoice.id, user.id);
                // Check if this might be the last approval and trigger notifications
                await invoiceStore.sendPaymentNotifications(invoice.id);
            }
        }
    };

    const handleTogglePayment = async () => {
        if (user?.id && invoice.id) {
            await togglePaymentStatus(invoice.id, user.id);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="invoice-hero">
                <img src={`/assets/lanImages/${invoice.image}.jpg`} alt={invoice.title} />
                <div className="invoice-hero-overlay">
                    <h1 className="invoice-hero-title">{invoice.title}</h1>
                    <div className="invoice-hero-meta">LAN #{invoice.lanNumber}</div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="invoice-info-grid">
                <div className="invoice-info-item">
                    <div className="invoice-info-label">Summa</div>
                    <div className="invoice-info-value">{invoice.amount?.toFixed(2)}€</div>
                </div>
                <div className="invoice-info-item">
                    <div className="invoice-info-label">LAN-numero</div>
                    <div className="invoice-info-value">#{invoice.lanNumber}</div>
                </div>
                <div className="invoice-info-item">
                    <div className="invoice-info-label">Kuluja</div>
                    <div className="invoice-info-value">{invoice.expenseItems?.length || 0}</div>
                </div>
                <div className="invoice-info-item">
                    <div className="invoice-info-label">Osallistujia</div>
                    <div className="invoice-info-value">{invoice.participants?.length || 0}</div>
                </div>
                <div className="invoice-info-item">
                    <div className="invoice-info-label">Tila</div>
                    <div className="invoice-info-value">
                        {isAdmin ? (
                            <Dropdown
                                selection
                                value={invoice.status}
                                options={statusOptions}
                                onChange={(_, { value }) => {
                                    if (value !== undefined && invoice.id) {
                                        changeInvoiceStatus(invoice.id, value as InvoiceStatus);
                                    }
                                }}
                            />
                        ) : (
                            <span>{getStatusLabel(invoice.status)}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            {invoice.description && (
                <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                    <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Kuvaus</h4>
                    <p style={{ margin: 0 }}>{invoice.description}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === 'expenses' ? 'active' : ''}`}
                    onClick={() => setActiveTab('expenses')}
                >
                    <Icon name="shopping cart" /> Kulut
                </button>
                <button
                    className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
                    onClick={() => setActiveTab('participants')}
                >
                    <Icon name="users" /> Osallistujat
                </button>
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {activeTab === 'expenses' && <ExpenseItemList invoiceId={invoice.id} />}
                {activeTab === 'participants' && <ParticipantList invoiceId={invoice.id} />}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xl)', flexWrap: 'wrap' }}>
                {canInteractWithApproval && (
                    <Button
                        className={hasApproved ? "btn-secondary" : "btn-success"}
                        onClick={handleToggleApproval}
                        loading={loading}
                        disabled={loading}
                    >
                        <Icon name={hasApproved ? "times" : "check"} />
                        {hasApproved ? "Peru hyväksyntä" : "Hyväksy lasku"}
                    </Button>
                )}
                {canInteractWithPayment && (
                    <Button
                        className={hasPaid ? "btn-secondary" : "btn-success"}
                        onClick={handleTogglePayment}
                        loading={loading}
                        disabled={loading}
                    >
                        <Icon name={hasPaid ? "undo" : "money bill alternate"} />
                        {hasPaid ? "Peru maksumerkintä" : "Merkitse maksetuksi"}
                    </Button>
                )}
                <Button
                    as={Link}
                    to={`/manage/${invoice.id}`}
                    className="btn-primary"
                    disabled={invoice.status === InvoiceStatus.Maksussa || invoice.status === InvoiceStatus.Arkistoitu}
                >
                    <Icon name="edit" /> Muokkaa laskua
                </Button>
                <Button as={Link} to={`/invoices/${invoice.id}/print`} color='blue'>
                    <Icon name="print" /> Tulosta (PDF)
                </Button>
                <Button as={Link} to='/invoices' className="btn-secondary">
                    <Icon name="arrow left" /> Takaisin
                </Button>
            </div>
        </div>
    )
})
