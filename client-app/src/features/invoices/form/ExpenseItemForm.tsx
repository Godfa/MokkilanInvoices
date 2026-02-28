import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { Button, Form, Header, Segment, Icon, Checkbox, Table, Message } from "semantic-ui-react";
import { useStore } from "../../../app/stores/store";
import { Formik, Form as FormikForm, Field, ErrorMessage } from "formik";
import * as Yup from 'yup';
import { v4 as uuid } from 'uuid';
import { ExpenseItem, ExpenseLineItem } from "../../../app/models/invoice";
import agent, { ScannedReceiptResult } from "../../../app/api/agent";
import { toast } from "react-toastify";

interface Props {
    invoiceId: string;
    closeForm: () => void;
    expenseItem?: ExpenseItem;
}

interface FormValues {
    name: string;
    expenseType: number;
    organizerId: string;
    id: string;
    payers: any[];
    lineItems: any[];
    // Optional first line item fields
    lineItemName?: string;
    lineItemQuantity?: number;
    lineItemUnitPrice?: number;
}

export default observer(function ExpenseItemForm({ invoiceId, closeForm, expenseItem }: Props) {
    const { invoiceStore } = useStore();
    const { createExpenseItem, updateExpenseItem, createLineItem, loading, loadExpenseTypes, loadUsers, ExpenseTypes, PotentialParticipants } = invoiceStore;
    const [addLineItem, setAddLineItem] = useState(false);
    const [scanningReceipt, setScanningReceipt] = useState(false);
    const [scannedLineItems, setScannedLineItems] = useState<ExpenseLineItem[]>([]);
    const [selectedLineItems, setSelectedLineItems] = useState<Set<string>>(new Set());
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptTotal, setReceiptTotal] = useState<number>(0);

    useEffect(() => {
        loadExpenseTypes();
        loadUsers();
    }, [loadExpenseTypes, loadUsers]);

    const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(selectedFile.type)) {
                toast.error('Virheellinen tiedostotyyppi. Vain JPEG, PNG ja WEBP kuvat ovat tuettuja.');
                return;
            }

            // Validate file size (10MB max)
            if (selectedFile.size > 10_000_000) {
                toast.error('Tiedosto on liian suuri. Maksimikoko on 10MB.');
                return;
            }

            setReceiptFile(selectedFile);
        }
    };

    const scanReceipt = async () => {
        if (!receiptFile) return;

        setScanningReceipt(true);

        try {
            const scanResult = await agent.Receipts.scan(
                receiptFile,
                'fi',
                'auto'
            );

            // Convert scanned lines to ExpenseLineItems
            const lineItems: ExpenseLineItem[] = scanResult.lines.map(line => ({
                id: uuid(),
                expenseItemId: '', // Will be set when expense item is created
                name: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                total: line.lineTotal
            }));

            setScannedLineItems(lineItems);
            // Select all lines by default
            setSelectedLineItems(new Set(lineItems.map(item => item.id)));
            // Set receipt total
            setReceiptTotal(scanResult.total || lineItems.reduce((sum, item) => sum + item.total, 0));
            toast.success(`Kuitti skannattu! Löydettiin ${lineItems.length} riviä.`);
        } catch (err: any) {
            const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Skannaus epäonnistui';
            toast.error(`Virhe: ${message}`);
            console.error('Receipt scan error:', err);
        } finally {
            setScanningReceipt(false);
        }
    };

    const validationSchema = Yup.object({
        name: Yup.string().required('The event name is required'),
        expenseType: Yup.number().required('Expense Type is required').notOneOf([-1], 'Type is required'),
        organizerId: Yup.string().required('Velkoja on pakollinen'),
        // Conditional validation for line item fields
        lineItemName: Yup.string().when('$addLineItem', {
            is: true,
            then: (schema) => schema.required('Line item name is required'),
            otherwise: (schema) => schema.notRequired()
        }),
        lineItemQuantity: Yup.number().when('$addLineItem', {
            is: true,
            then: (schema) => schema.required('Quantity is required').positive('Must be positive'),
            otherwise: (schema) => schema.notRequired()
        }),
        lineItemUnitPrice: Yup.number().when('$addLineItem', {
            is: true,
            then: (schema) => schema.required('Unit price is required').min(0, 'Must be zero or positive'),
            otherwise: (schema) => schema.notRequired()
        })
    })

    const initialValues: FormValues = expenseItem ? {
        name: expenseItem.name,
        expenseType: expenseItem.expenseType,
        organizerId: expenseItem.organizerId,
        id: expenseItem.id,
        payers: expenseItem.payers || [],
        lineItems: expenseItem.lineItems || []
    } : {
        name: '',
        expenseType: -1,
        organizerId: '',
        id: '',
        payers: [],
        lineItems: [],
        lineItemName: 'Ostokset',
        lineItemQuantity: 1,
        lineItemUnitPrice: 0
    }

    return (
        <Segment clearing>
            <Header content={expenseItem ? 'Edit Expense Item' : 'Add Expense Item'} sub color='teal' />
            <Formik
                initialValues={initialValues}
                onSubmit={async (values) => {
                    const expenseItemId = expenseItem ? expenseItem.id : uuid();

                    const itemData = {
                        ...values,
                        expenseType: parseInt(values.expenseType.toString()),
                        organizerId: values.organizerId,
                        // Don't send organizer object to backend - it causes duplicate key errors
                        // Backend will load the organizer via organizerId
                        id: expenseItemId
                    } as any;

                    // Create or update the expense item
                    if (expenseItem) {
                        await updateExpenseItem(invoiceId, itemData);
                    } else {
                        await createExpenseItem(invoiceId, itemData);

                        // If adding a line item manually, create it after expense item is created
                        if (addLineItem && values.lineItemName && values.lineItemQuantity && values.lineItemUnitPrice !== undefined) {
                            const lineItem: ExpenseLineItem = {
                                id: uuid(),
                                expenseItemId: expenseItemId,
                                name: values.lineItemName,
                                quantity: values.lineItemQuantity,
                                unitPrice: values.lineItemUnitPrice,
                                total: values.lineItemQuantity * values.lineItemUnitPrice
                            };
                            await createLineItem(invoiceId, expenseItemId, lineItem);
                        }

                        // If we have scanned line items, create only the selected ones
                        if (scannedLineItems.length > 0) {
                            const itemsToCreate = scannedLineItems.filter(item => selectedLineItems.has(item.id));
                            for (const lineItem of itemsToCreate) {
                                await createLineItem(invoiceId, expenseItemId, {
                                    ...lineItem,
                                    expenseItemId: expenseItemId
                                });
                            }
                        }
                    }

                    closeForm();
                }}
                validationSchema={validationSchema}
            >
                {({ handleSubmit, isValid, isSubmitting, dirty }) => (
                    <FormikForm className='ui form' onSubmit={handleSubmit} autoComplete='off'>
                        <Form.Field>
                            <label>Name</label>
                            <Field placeholder='Name' name='name' />
                            <ErrorMessage name='name' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                        </Form.Field>
                        <Form.Field>
                            <label>Velkoja</label>
                            <Field as="select" name="organizerId">
                                <option value="">Valitse velkoja</option>
                                {PotentialParticipants.map(user => (
                                    <option key={user.key} value={user.key}>{user.value}</option>
                                ))}
                            </Field>
                            <ErrorMessage name='organizerId' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                        </Form.Field>
                        <Form.Field>
                            <label>Type</label>
                            <Field as="select" name="expenseType">
                                <option value={-1}>Select Type</option>
                                {ExpenseTypes.map(type => (
                                    <option key={type.key} value={type.key}>{type.value}</option>
                                ))}
                            </Field>
                            <ErrorMessage name='expenseType' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                        </Form.Field>
                        {expenseItem && (
                            <Form.Field>
                                <label>Amount: €{(expenseItem.lineItems?.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0) ?? 0).toFixed(2)}</label>
                                <p style={{ color: '#666', fontSize: '0.9em' }}>
                                    <em>Amount is calculated from line items. Expand the expense item to add or edit line items.</em>
                                </p>
                            </Form.Field>
                        )}
                        {!expenseItem && (
                            <>
                                <Segment>
                                    <Header size='small' content='📄 Skannaa kuitti automaattiseen rivien lisäykseen' />
                                    <Form.Field>
                                        <label>Valitse kuittikuva</label>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            onChange={handleReceiptFileChange}
                                            disabled={scanningReceipt}
                                        />
                                    </Form.Field>
                                    <Button
                                        type="button"
                                        color="blue"
                                        onClick={scanReceipt}
                                        disabled={!receiptFile || scanningReceipt}
                                        loading={scanningReceipt}
                                    >
                                        <Icon name='file image' />
                                        {scanningReceipt ? 'Skannataan...' : 'Skannaa kuitti'}
                                    </Button>

                                    {scannedLineItems.length > 0 && (
                                        <Segment color='green' style={{ marginTop: '1em' }}>
                                            <Header size='tiny'>
                                                ✅ Skannattu {scannedLineItems.length} riviä
                                                <span style={{ float: 'right', color: '#2185d0' }}>
                                                    Kokonaissumma: {receiptTotal.toFixed(2)} €
                                                </span>
                                            </Header>
                                            <Table compact size='small'>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.HeaderCell width={1}>
                                                            <Checkbox
                                                                checked={selectedLineItems.size === scannedLineItems.length}
                                                                indeterminate={selectedLineItems.size > 0 && selectedLineItems.size < scannedLineItems.length}
                                                                onChange={(e, { checked }) => {
                                                                    if (checked) {
                                                                        setSelectedLineItems(new Set(scannedLineItems.map(item => item.id)));
                                                                    } else {
                                                                        setSelectedLineItems(new Set());
                                                                    }
                                                                }}
                                                            />
                                                        </Table.HeaderCell>
                                                        <Table.HeaderCell>Tuote</Table.HeaderCell>
                                                        <Table.HeaderCell>Määrä</Table.HeaderCell>
                                                        <Table.HeaderCell>Hinta</Table.HeaderCell>
                                                        <Table.HeaderCell>Yhteensä</Table.HeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {scannedLineItems.map((item, idx) => (
                                                        <Table.Row key={idx} active={selectedLineItems.has(item.id)}>
                                                            <Table.Cell>
                                                                <Checkbox
                                                                    checked={selectedLineItems.has(item.id)}
                                                                    onChange={(e, { checked }) => {
                                                                        const newSelected = new Set(selectedLineItems);
                                                                        if (checked) {
                                                                            newSelected.add(item.id);
                                                                        } else {
                                                                            newSelected.delete(item.id);
                                                                        }
                                                                        setSelectedLineItems(newSelected);
                                                                    }}
                                                                />
                                                            </Table.Cell>
                                                            <Table.Cell>{item.name}</Table.Cell>
                                                            <Table.Cell>{item.quantity}</Table.Cell>
                                                            <Table.Cell>{item.unitPrice.toFixed(2)} €</Table.Cell>
                                                            <Table.Cell><strong>{item.total.toFixed(2)} €</strong></Table.Cell>
                                                        </Table.Row>
                                                    ))}
                                                </Table.Body>
                                            </Table>
                                            <Message info size='small'>
                                                {selectedLineItems.size} / {scannedLineItems.length} riviä valittu.
                                                Valitut rivit ({scannedLineItems.filter(item => selectedLineItems.has(item.id)).reduce((sum, item) => sum + item.total, 0).toFixed(2)} €) lisätään automaattisesti kun tallennat kuluerän.
                                            </Message>
                                        </Segment>
                                    )}
                                </Segment>

                                <Form.Field>
                                    <Checkbox
                                        label='Tai lisää rivi manuaalisesti'
                                        checked={addLineItem}
                                        onChange={(e, { checked }) => setAddLineItem(!!checked)}
                                    />
                                </Form.Field>
                                {addLineItem && (
                                    <Segment>
                                        <Header size='small' content='Rivin tiedot' />
                                        <Form.Field>
                                            <label>Nimi</label>
                                            <Field placeholder='Esim. Olut, Pizza, jne.' name='lineItemName' />
                                            <ErrorMessage name='lineItemName' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                                        </Form.Field>
                                        <Form.Group widths='equal'>
                                            <Form.Field>
                                                <label>Määrä</label>
                                                <Field type='number' step='0.01' placeholder='Määrä' name='lineItemQuantity' />
                                                <ErrorMessage name='lineItemQuantity' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                                            </Form.Field>
                                            <Form.Field>
                                                <label>Yksikköhinta (€)</label>
                                                <Field type='number' step='0.01' placeholder='Hinta' name='lineItemUnitPrice' />
                                                <ErrorMessage name='lineItemUnitPrice' render={error => <label style={{ color: 'red' }}>{error}</label>} />
                                            </Form.Field>
                                        </Form.Group>
                                    </Segment>
                                )}
                                {!addLineItem && scannedLineItems.length === 0 && (
                                    <p style={{ color: '#666', fontSize: '0.9em', fontStyle: 'italic' }}>
                                        Voit lisätä rivejä myös jälkeenpäin laajentamalla kuluerän.
                                    </p>
                                )}
                            </>
                        )}
                        <Button
                            disabled={isSubmitting || !dirty || !isValid}
                            loading={loading} floated='right'
                            positive type='submit' content='Submit' />
                        <Button onClick={closeForm} floated='right' type='button' content='Cancel' />
                    </FormikForm>
                )}
            </Formik>
        </Segment>
    )
})
