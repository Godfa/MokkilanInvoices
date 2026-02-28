import { observer } from "mobx-react-lite";
import React, { useState, useEffect } from "react";
import { Button, Icon, Label, Segment, Table } from "semantic-ui-react";
import { useStore } from "../../../app/stores/store";
import ExpenseItemForm from "../form/ExpenseItemForm";
import ExpenseLineItemForm from "../form/ExpenseLineItemForm";
import { ExpenseItem, ExpenseLineItem, InvoiceStatus } from "../../../app/models/invoice";
import { toast } from "react-toastify";

interface Props {
    invoiceId: string;
}

export default observer(function ExpenseItemList({ invoiceId }: Props) {
    const { invoiceStore } = useStore();
    const { selectedInvoice, deleteExpenseItem, deleteLineItem, loading, getExpenseTypeName, getUserName, addPayer, removePayer, PotentialParticipants, loadExpenseTypes } = invoiceStore;
    const [addMode, setAddMode] = useState(false);
    const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
    const [deletingId, setDeletingId] = useState<string>('');
    const [payerMenuOpen, setPayerMenuOpen] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [addingLineItemFor, setAddingLineItemFor] = useState<string | null>(null);
    const [editingLineItem, setEditingLineItem] = useState<{ expenseItemId: string, lineItem: ExpenseLineItem } | null>(null);

    useEffect(() => {
        loadExpenseTypes();
    }, [loadExpenseTypes]);

    if (!selectedInvoice) return null;

    const isInvoiceLocked = selectedInvoice.status === InvoiceStatus.Maksussa || selectedInvoice.status === InvoiceStatus.Arkistoitu;

    const handleEdit = (item: ExpenseItem) => {
        setEditingItem(item);
        setAddMode(false);
    };

    const handleCloseForm = () => {
        setAddMode(false);
        setEditingItem(null);
    };

    const handleDelete = async (itemId: string) => {
        setDeletingId(itemId);
        await deleteExpenseItem(invoiceId, itemId);
        setDeletingId('');
    };

    const toggleExpanded = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedItems(newExpanded);
    };

    const handleDeleteLineItem = async (expenseItemId: string, lineItemId: string) => {
        await deleteLineItem(invoiceId, expenseItemId, lineItemId);
    };

    return (
        <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                <h3 style={{ margin: 0 }}>Kuluerät</h3>
                <Button
                    className='btn-primary'
                    onClick={() => {
                        setAddMode(!addMode);
                        setEditingItem(null);
                    }}
                    loading={loading}
                    disabled={loading || isInvoiceLocked}
                >
                    <Icon name='plus' /> Lisää kulu
                </Button>
            </div>

            {(addMode || editingItem) && (
                <ExpenseItemForm
                    invoiceId={invoiceId}
                    closeForm={handleCloseForm}
                    expenseItem={editingItem || undefined}
                />
            )}

            <div style={{ overflowX: 'auto' }}>
                <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell width={1}></Table.HeaderCell>
                            <Table.HeaderCell>Nimi</Table.HeaderCell>
                            <Table.HeaderCell>Tyyppi</Table.HeaderCell>
                            <Table.HeaderCell>Velkoja</Table.HeaderCell>
                            <Table.HeaderCell>Summa</Table.HeaderCell>
                            <Table.HeaderCell>Maksajat</Table.HeaderCell>
                            <Table.HeaderCell>Toiminnot</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>

                    <Table.Body>
                        {selectedInvoice.expenseItems && selectedInvoice.expenseItems.map((item) => (
                            <React.Fragment key={item.id}>
                                <Table.Row style={{ cursor: 'pointer' }} onClick={() => toggleExpanded(item.id)}>
                                    <Table.Cell>
                                        <Button
                                            icon
                                            size='tiny'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpanded(item.id);
                                            }}
                                        >
                                            <Icon name={expandedItems.has(item.id) ? 'chevron down' : 'chevron right'} />
                                        </Button>
                                    </Table.Cell>
                                    <Table.Cell>{item.name}</Table.Cell>
                                    <Table.Cell>{getExpenseTypeName(item.expenseType)}</Table.Cell>
                                    <Table.Cell>{item.organizer?.displayName || getUserName(item.organizerId)}</Table.Cell>
                                    <Table.Cell>{(item.lineItems?.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0) ?? 0).toFixed(2)} €</Table.Cell>
                                    <Table.Cell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                        <div style={{ marginBottom: '5px' }}>
                                            {item.payers && item.payers.length > 0 ? (
                                                item.payers.map(p => (
                                                    <Label key={p.appUserId} style={{ marginRight: '5px', marginBottom: '5px' }}>
                                                        {p.appUser.displayName}
                                                        <Label.Detail>
                                                            <Button
                                                                size='mini'
                                                                icon='delete'
                                                                onClick={() => removePayer(invoiceId, item.id, p.appUserId)}
                                                                loading={loading}
                                                                disabled={loading || isInvoiceLocked}
                                                                style={{ marginLeft: '5px', padding: '3px' }}
                                                            />
                                                        </Label.Detail>
                                                    </Label>
                                                ))
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Ei maksajia</span>
                                            )}
                                        </div>
                                        <div style={{ marginTop: '5px' }}>
                                            {selectedInvoice.participants && selectedInvoice.participants.length > 0 && (
                                                <>
                                                    {selectedInvoice.participants.filter(p => !item.payers?.some(payer => payer.appUserId === p.appUserId)).length > 0 && (
                                                        <Button
                                                            size='tiny'
                                                            className='btn-success'
                                                            content={`Lisää kaikki (${selectedInvoice.participants.filter(p => !item.payers?.some(payer => payer.appUserId === p.appUserId)).length})`}
                                                            onClick={async () => {
                                                                const payersToAdd = selectedInvoice.participants!.filter(p => !item.payers?.some(payer => payer.appUserId === p.appUserId));
                                                                invoiceStore.loading = true;
                                                                try {
                                                                    await Promise.all(
                                                                        payersToAdd.map(p => addPayer(invoiceId, item.id, p.appUserId, true))
                                                                    );
                                                                    toast.success(`${payersToAdd.length} maksajaa lisätty`);
                                                                } finally {
                                                                    invoiceStore.loading = false;
                                                                }
                                                            }}
                                                            loading={loading}
                                                            disabled={loading || isInvoiceLocked}
                                                            style={{ marginRight: '5px', marginBottom: '5px' }}
                                                        />
                                                    )}
                                                    {item.payers && item.payers.length > 0 && (
                                                        <Button
                                                            size='tiny'
                                                            className='btn-danger'
                                                            content={`Poista kaikki (${item.payers.length})`}
                                                            onClick={async () => {
                                                                const payersToRemove = [...item.payers!];
                                                                invoiceStore.loading = true;
                                                                try {
                                                                    await Promise.all(
                                                                        payersToRemove.map(p => removePayer(invoiceId, item.id, p.appUserId, true))
                                                                    );
                                                                    toast.success(`${payersToRemove.length} maksajaa poistettu`);
                                                                } finally {
                                                                    invoiceStore.loading = false;
                                                                }
                                                            }}
                                                            loading={loading}
                                                            disabled={loading || isInvoiceLocked}
                                                            style={{ marginRight: '5px', marginBottom: '5px' }}
                                                        />
                                                    )}
                                                </>
                                            )}
                                            {payerMenuOpen !== item.id && (
                                                <Button
                                                    size='tiny'
                                                    className='btn-secondary'
                                                    content='Lisää maksaja'
                                                    onClick={() => setPayerMenuOpen(item.id)}
                                                    disabled={loading || isInvoiceLocked}
                                                    style={{ marginBottom: '5px' }}
                                                />
                                            )}
                                        </div>
                                        {payerMenuOpen === item.id && (
                                            <div style={{ marginTop: '5px' }}>
                                                {PotentialParticipants
                                                    .filter(c => !item.payers?.some(p => p.appUserId === c.key))
                                                    .map(user => (
                                                        <Button
                                                            key={user.key}
                                                            size='tiny'
                                                            color='orange'
                                                            basic
                                                            content={user.value}
                                                            onClick={() => {
                                                                addPayer(invoiceId, item.id, user.key);
                                                                setPayerMenuOpen(null);
                                                            }}
                                                            loading={loading}
                                                            disabled={loading || isInvoiceLocked}
                                                            style={{ marginRight: '5px', marginBottom: '5px' }}
                                                        />
                                                    ))}
                                                <Button
                                                    size='tiny'
                                                    className='btn-secondary'
                                                    content='Sulje'
                                                    onClick={() => setPayerMenuOpen(null)}
                                                    style={{ marginBottom: '5px' }}
                                                />
                                            </div>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                        <Button
                                            onClick={() => handleEdit(item)}
                                            color='blue'
                                            icon='edit'
                                            size='tiny'
                                            disabled={loading || isInvoiceLocked}
                                        />
                                        <Button
                                            loading={loading && deletingId === item.id}
                                            onClick={() => handleDelete(item.id)}
                                            color='red'
                                            icon='trash'
                                            size='tiny'
                                            disabled={loading || isInvoiceLocked}
                                        />
                                    </Table.Cell>
                                </Table.Row>

                                {expandedItems.has(item.id) && (
                                    <Table.Row>
                                        <Table.Cell colSpan='7' style={{ padding: 'var(--spacing-md) var(--spacing-lg)', backgroundColor: 'var(--bg-secondary)' }}>
                                            <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                                                <strong>Rivitiedot:</strong>
                                                <Button
                                                    size='tiny'
                                                    className='btn-primary'
                                                    onClick={() => {
                                                        setAddingLineItemFor(item.id);
                                                        setEditingLineItem(null);
                                                    }}
                                                    disabled={loading || isInvoiceLocked}
                                                >
                                                    <Icon name='plus' /> Lisää rivi
                                                </Button>
                                            </div>

                                            {(addingLineItemFor === item.id || editingLineItem?.expenseItemId === item.id) && (
                                                <ExpenseLineItemForm
                                                    invoiceId={invoiceId}
                                                    expenseItemId={item.id}
                                                    closeForm={() => {
                                                        setAddingLineItemFor(null);
                                                        setEditingLineItem(null);
                                                    }}
                                                    lineItem={editingLineItem?.lineItem}
                                                />
                                            )}

                                            {item.lineItems && item.lineItems.length > 0 ? (
                                                <Table compact size='small'>
                                                    <Table.Header>
                                                        <Table.Row>
                                                            <Table.HeaderCell>Nimi</Table.HeaderCell>
                                                            <Table.HeaderCell>Määrä</Table.HeaderCell>
                                                            <Table.HeaderCell>Yksikköhinta</Table.HeaderCell>
                                                            <Table.HeaderCell>Yhteensä</Table.HeaderCell>
                                                            <Table.HeaderCell>Toiminnot</Table.HeaderCell>
                                                        </Table.Row>
                                                    </Table.Header>
                                                    <Table.Body>
                                                        {item.lineItems.map(lineItem => (
                                                            <Table.Row key={lineItem.id}>
                                                                <Table.Cell>{lineItem.name}</Table.Cell>
                                                                <Table.Cell>{lineItem.quantity}</Table.Cell>
                                                                <Table.Cell>{lineItem.unitPrice.toFixed(2)} €</Table.Cell>
                                                                <Table.Cell>{(lineItem.quantity * lineItem.unitPrice).toFixed(2)} €</Table.Cell>
                                                                <Table.Cell>
                                                                    <Button
                                                                        icon='edit'
                                                                        size='mini'
                                                                        color='blue'
                                                                        onClick={() => {
                                                                            setEditingLineItem({ expenseItemId: item.id, lineItem });
                                                                            setAddingLineItemFor(null);
                                                                        }}
                                                                        disabled={loading || isInvoiceLocked}
                                                                    />
                                                                    <Button
                                                                        icon='trash'
                                                                        size='mini'
                                                                        color='red'
                                                                        onClick={() => handleDeleteLineItem(item.id, lineItem.id)}
                                                                        loading={loading}
                                                                        disabled={loading || isInvoiceLocked}
                                                                    />
                                                                </Table.Cell>
                                                            </Table.Row>
                                                        ))}
                                                    </Table.Body>
                                                </Table>
                                            ) : (
                                                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Ei rivitietoja vielä.</p>
                                            )}
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                            </React.Fragment>
                        ))}
                    </Table.Body>
                </Table>
            </div>
        </div>
    )
})
