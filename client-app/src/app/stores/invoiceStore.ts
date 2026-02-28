import { Invoice, ExpenseItem, ExpenseLineItem, InvoiceStatus } from "../models/invoice";
import { makeAutoObservable, runInAction } from "mobx";
import agent from "../api/agent";
import { v4 as uuid } from 'uuid';
import { toast } from 'react-toastify';

interface ShoppingExpenseData {
    price: number;
    enabled: boolean;
}

export default class InvoiceStore {
    invoiceRegistry = new Map<string, Invoice>();
    selectedInvoice: Invoice | undefined = undefined;
    editMode = false;
    loading = false;
    loadingInitial = true;

    constructor() {
        makeAutoObservable(this)
    }

    // User mapping
    userRegistry = new Map<string, string>(); // Id -> DisplayName

    get PotentialParticipants() {
        return Array.from(this.userRegistry.entries()).map(([key, value]) => ({ key, value }));
    }

    loadUsers = async () => {
        if (this.userRegistry.size > 0) return;
        try {
            const users = await agent.Users.list();
            runInAction(() => {
                users.forEach(user => {
                    this.userRegistry.set(user.id, user.displayName);
                })
            })
        } catch (error) {
            console.log(error);
        }
    }

    get Invoices() {
        return Array.from(this.invoiceRegistry.values());
    }

    get canCreateInvoice(): boolean {
        return !this.Invoices.some(i => i.status === InvoiceStatus.Aktiivinen);
    }

    loadInvoices = async () => {
        // this.loadingInitial = true;
        try {
            const invoices = await agent.Invoices.list();
            invoices.forEach((invoice: Invoice) => {
                this.invoiceRegistry.set(invoice.id, invoice);

            })
            this.setLoadingInitial(false);
        } catch (error) {
            console.log(error);
            this.setLoadingInitial(false);
        }
    }

    loadInvoice = async (id: string) => {
        let invoice = this.invoiceRegistry.get(id);
        if (invoice) {
            this.selectedInvoice = invoice;
            return invoice;
        }

        this.setLoadingInitial(true);
        try {
            invoice = await agent.Invoices.details(id);
            runInAction(() => {
                this.invoiceRegistry.set(invoice!.id, invoice!);
                this.selectedInvoice = invoice;
                this.setLoadingInitial(false);
            })
            return invoice;
        } catch (error) {
            console.log(error);
            runInAction(() => {
                this.setLoadingInitial(false);
            })
        }
    }

    setLoadingInitial = (state: boolean) => {
        this.loadingInitial = state;
    }

    selectInvoice = (id: string) => {
        this.selectedInvoice = this.invoiceRegistry.get(id);
    }

    cancelSelectedInvoice = () => {
        this.selectedInvoice = undefined;
    }

    openForm = (id?: string) => {
        id ? this.selectInvoice(id) : this.cancelSelectedInvoice();
        this.editMode = true;
    }

    closeForm = () => {
        this.editMode = false;
        this.selectedInvoice = undefined;
    }

    createInvoice = async (invoice: Invoice, shoppingData?: ShoppingExpenseData | null) => {
        this.loading = true;
        // Don't set invoice.id - let the backend generate it
        try {
            const createdInvoice = await agent.Invoices.create(invoice);
            runInAction(() => {
                this.invoiceRegistry.set(createdInvoice.id, createdInvoice);
                this.selectedInvoice = createdInvoice;
                this.editMode = false;
            })
            toast.success('Invoice created successfully');

            // Automatically add usual suspects as participants
            try {
                await this.addUsualSuspects(createdInvoice.id, false);
            } catch (error) {
                console.error('Failed to add usual suspects:', error);
            }

            // Create shopping expense if requested
            if (shoppingData?.enabled && shoppingData.price > 0) {
                try {
                    await this.createShoppingExpense(createdInvoice.id, shoppingData.price);
                } catch (error) {
                    console.error('Failed to create shopping expense:', error);
                    toast.error('Laskun luonti onnistui, mutta ostokset-kulun luonti epäonnistui');
                }
            }

            // Reload invoice from server to get complete data with participants and expenses
            // Force reload from server (not from registry cache)
            const refreshedInvoice = await agent.Invoices.details(createdInvoice.id);
            runInAction(() => {
                this.invoiceRegistry.set(refreshedInvoice.id, refreshedInvoice);
                this.selectedInvoice = refreshedInvoice;
            });
        } catch (error) {
            console.log(error);
            toast.error('Failed to create invoice');
        } finally {
            runInAction(() => {
                this.loading = false;
            })
        }
    }

    updateInvoice = async (invoice: Invoice) => {
        this.loading = true;
        try {
            await agent.Invoices.update(invoice);
            runInAction(() => {
                this.invoiceRegistry.set(invoice.id, invoice);
                this.selectedInvoice = invoice;
                this.editMode = false;
                this.loading = false;
            })
            toast.success('Invoice updated successfully');
        } catch (error) {
            console.log(error);
            runInAction(() => {
                this.loading = false;
            })
        }
    }

    expenseTypeRegistry = new Map<number, string>();

    get ExpenseTypes() {
        return Array.from(this.expenseTypeRegistry.entries()).map(([key, value]) => ({ key, value }));
    }

    loadExpenseTypes = async () => {
        if (this.expenseTypeRegistry.size > 0) return;
        try {
            const types = await agent.ExpenseTypes.list();
            runInAction(() => {
                types.forEach(type => {
                    this.expenseTypeRegistry.set(type.key, type.value);
                })
            })
        } catch (error) {
            console.log(error);
        }
    }

    createExpenseItem = async (invoiceId: string, expenseItem: ExpenseItem) => {
        this.loading = true;
        try {
            await agent.ExpenseItems.createForInvoice(invoiceId, expenseItem);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice) {
                    if (!invoice.expenseItems) invoice.expenseItems = [];
                    invoice.expenseItems.push(expenseItem);
                    // Update registry
                    this.invoiceRegistry.set(invoiceId, invoice);
                    if (this.selectedInvoice?.id === invoiceId) {
                        this.selectedInvoice = invoice;
                    }
                }
            })
            toast.success('Expense Item added');

            // Automatically add all participants as payers
            const invoice = this.invoiceRegistry.get(invoiceId);
            if (invoice?.participants && invoice.participants.length > 0) {
                await Promise.all(
                    invoice.participants.map(p =>
                        this.addPayer(invoiceId, expenseItem.id, p.appUserId, true)
                    )
                );
                toast.success(`${invoice.participants.length} payers added automatically`);
            }
        } catch (error: any) {
            console.log(error);
            const errorMessage = error?.response?.data || 'Kulun lisääminen epäonnistui';
            toast.error(errorMessage);
            throw error;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    }

    deleteExpenseItem = async (invoiceId: string, itemId: string) => {
        this.loading = true;
        try {
            await agent.ExpenseItems.delete(itemId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    invoice.expenseItems = invoice.expenseItems.filter(i => i.id !== itemId);
                    this.invoiceRegistry.set(invoiceId, invoice);
                    if (this.selectedInvoice?.id === invoiceId) {
                        this.selectedInvoice = invoice;
                    }
                }
                this.loading = false;
            })
            toast.success('Expense Item deleted');
        } catch (error) {
            console.log(error);
            runInAction(() => this.loading = false);
        }
    }

    deleteInvoice = async (id: string) => {
        this.loading = true;
        try {
            await agent.Invoices.delete(id);
            runInAction(() => {
                this.invoiceRegistry.delete(id);
                if (this.selectedInvoice?.id === id) this.cancelSelectedInvoice();
                this.loading = false;
            })
            toast.success('Invoice deleted successfully');
        } catch (error) {
            console.log(error);
            runInAction(() => {
                this.loading = false;
            })
        }
    }

    changeInvoiceStatus = async (invoiceId: string, newStatus: InvoiceStatus) => {
        this.loading = true;
        try {
            const updatedInvoice = await agent.Invoices.changeStatus(invoiceId, newStatus);
            runInAction(() => {
                this.invoiceRegistry.set(invoiceId, updatedInvoice);
                if (this.selectedInvoice?.id === invoiceId) {
                    this.selectedInvoice = updatedInvoice;
                }
                this.loading = false;
            });
            toast.success('Laskun tila päivitetty');
        } catch (error) {
            console.log(error);
            toast.error('Tilan päivitys epäonnistui');
            runInAction(() => {
                this.loading = false;
            });
        }
    }

    approveInvoice = async (invoiceId: string, userId: string) => {
        this.loading = true;
        try {
            const updatedInvoice = await agent.Invoices.approveInvoice(invoiceId, userId);
            runInAction(() => {
                this.invoiceRegistry.set(invoiceId, updatedInvoice);
                if (this.selectedInvoice?.id === invoiceId) {
                    this.selectedInvoice = updatedInvoice;
                }
                this.loading = false;
            });
            toast.success('Lasku hyväksytty');
        } catch (error: any) {
            console.log(error);
            const errorMessage = error?.response?.data || 'Hyväksyminen epäonnistui';
            toast.error(errorMessage);
            runInAction(() => {
                this.loading = false;
            });
        }
    }

    unapproveInvoice = async (invoiceId: string, userId: string) => {
        this.loading = true;
        try {
            const updatedInvoice = await agent.Invoices.unapproveInvoice(invoiceId, userId);
            runInAction(() => {
                this.invoiceRegistry.set(invoiceId, updatedInvoice);
                if (this.selectedInvoice?.id === invoiceId) {
                    this.selectedInvoice = updatedInvoice;
                }
                this.loading = false;
            });
            toast.success('Hyväksyntä peruttu');
        } catch (error: any) {
            console.log(error);
            const errorMessage = error?.response?.data || 'Hyväksynnän peruminen epäonnistui';
            toast.error(errorMessage);
            runInAction(() => {
                this.loading = false;
            });
        }
    }

    sendPaymentNotifications = async (invoiceId: string) => {
        try {
            await agent.Invoices.sendPaymentNotifications(invoiceId);
        } catch (error: any) {
            console.log(error);
            // Don't show error toast - notifications are optional
        }
    }

    togglePaymentStatus = async (invoiceId: string, userId: string) => {
        this.loading = true;
        try {
            await agent.Invoices.togglePaymentStatus(invoiceId, userId);

            // Reload the invoice to get the updated hasPaid / paidAt properties
            // To ensure we get fresh data instead of just modifying locally
            const updatedInvoice = await agent.Invoices.details(invoiceId);
            runInAction(() => {
                this.invoiceRegistry.set(invoiceId, updatedInvoice);
                if (this.selectedInvoice?.id === invoiceId) {
                    this.selectedInvoice = updatedInvoice;
                }
                this.loading = false;
            });
            toast.success('Maksutilan muutos tallennettu');
        } catch (error: any) {
            console.log(error);
            const errorMessage = error?.response?.data || 'Tilan muuttaminen epäonnistui';
            toast.error(errorMessage);
            runInAction(() => {
                this.loading = false;
            });
        }
    }

    updateExpenseItem = async (invoiceId: string, expenseItem: ExpenseItem) => {
        this.loading = true;
        try {
            await agent.ExpenseItems.update(expenseItem);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const index = invoice.expenseItems.findIndex(i => i.id === expenseItem.id);
                    if (index !== -1) {
                        invoice.expenseItems[index] = expenseItem;
                        this.invoiceRegistry.set(invoiceId, invoice);
                        if (this.selectedInvoice?.id === invoiceId) {
                            this.selectedInvoice = invoice;
                        }
                    }
                }
                this.loading = false;
            })
            toast.success('Expense Item updated');
        } catch (error) {
            console.log(error);
            runInAction(() => this.loading = false);
        }
    }

    getExpenseTypeName = (typeId: number): string => {
        return this.expenseTypeRegistry.get(typeId) || typeId.toString();
    }

    getUserName = (userId: string): string => {
        return this.userRegistry.get(userId) || userId;
    }

    addParticipant = async (invoiceId: string, userId: string, silent: boolean = false) => {
        if (!silent) {
            this.loading = true;
        }
        try {
            await agent.Invoices.addParticipant(invoiceId, userId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice) {
                    if (!invoice.participants) invoice.participants = [];
                    const user = { id: userId, userName: '', displayName: this.userRegistry.get(userId) || '', email: '' };
                    invoice.participants.push({
                        invoiceId: invoiceId,
                        appUserId: userId,
                        appUser: user
                    });
                    this.invoiceRegistry.set(invoiceId, invoice);
                    if (this.selectedInvoice?.id === invoiceId) {
                        this.selectedInvoice = invoice;
                    }
                }
                if (!silent) {
                    this.loading = false;
                }
            });
            if (!silent) {
                toast.success('Participant added');
            }
        } catch (error) {
            console.log(error);
            if (!silent) {
                runInAction(() => this.loading = false);
            }
        }
    }

    removeParticipant = async (invoiceId: string, userId: string, silent: boolean = false) => {
        if (!silent) {
            this.loading = true;
        }
        try {
            await agent.Invoices.removeParticipant(invoiceId, userId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.participants) {
                    invoice.participants = invoice.participants.filter(p => p.appUserId !== userId);
                    this.invoiceRegistry.set(invoiceId, invoice);
                    if (this.selectedInvoice?.id === invoiceId) {
                        this.selectedInvoice = invoice;
                    }
                }
                if (!silent) {
                    this.loading = false;
                }
            });
            if (!silent) {
                toast.success('Participant removed');
            }
        } catch (error) {
            console.log(error);
            if (!silent) {
                runInAction(() => this.loading = false);
            }
        }
    }

    addPayer = async (invoiceId: string, expenseItemId: string, userId: string, silent: boolean = false) => {
        if (!silent) {
            this.loading = true;
        }
        try {
            await agent.ExpenseItems.addPayer(expenseItemId, userId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const expenseItem = invoice.expenseItems.find(ei => ei.id === expenseItemId);
                    if (expenseItem) {
                        if (!expenseItem.payers) expenseItem.payers = [];
                        const user = { id: userId, userName: '', displayName: this.userRegistry.get(userId) || '', email: '' };
                        expenseItem.payers.push({
                            expenseItemId: expenseItemId,
                            appUserId: userId,
                            appUser: user
                        });
                        this.invoiceRegistry.set(invoiceId, invoice);
                        if (this.selectedInvoice?.id === invoiceId) {
                            this.selectedInvoice = invoice;
                        }
                    }
                }
                if (!silent) {
                    this.loading = false;
                }
            });
            if (!silent) {
                toast.success('Payer added');
            }
        } catch (error) {
            console.log(error);
            if (!silent) {
                runInAction(() => this.loading = false);
            }
        }
    }

    removePayer = async (invoiceId: string, expenseItemId: string, userId: string, silent: boolean = false) => {
        if (!silent) {
            this.loading = true;
        }
        try {
            await agent.ExpenseItems.removePayer(expenseItemId, userId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const expenseItem = invoice.expenseItems.find(ei => ei.id === expenseItemId);
                    if (expenseItem && expenseItem.payers) {
                        expenseItem.payers = expenseItem.payers.filter(p => p.appUserId !== userId);
                        this.invoiceRegistry.set(invoiceId, invoice);
                        if (this.selectedInvoice?.id === invoiceId) {
                            this.selectedInvoice = invoice;
                        }
                    }
                }
                if (!silent) {
                    this.loading = false;
                }
            });
            if (!silent) {
                toast.success('Payer removed');
            }
        } catch (error) {
            console.log(error);
            if (!silent) {
                runInAction(() => this.loading = false);
            }
        }
    }

    addUsualSuspects = async (invoiceId: string, manageLoading: boolean = true) => {
        // Ensure users are loaded
        await this.loadUsers();

        if (manageLoading) {
            this.loading = true;
        }

        try {
            const usualSuspects = ['Epi', 'JHattu', 'Leivo', 'Timo', 'Jaapu', 'Urpi', 'Zeip'];
            const invoice = this.invoiceRegistry.get(invoiceId);
            const participantIds = invoice?.participants?.map(p => p.appUserId) || [];

            const suspectsToAdd = this.PotentialParticipants.filter(c =>
                usualSuspects.some(suspect => c.value.includes(suspect)) && !participantIds.includes(c.key)
            );

            // Add all suspects in parallel for better performance
            await Promise.all(
                suspectsToAdd.map(user =>
                    this.addParticipant(invoiceId, user.key, true)
                )
            );

            if (suspectsToAdd.length > 0) {
                toast.success(`${suspectsToAdd.length} usual suspects added as participants`);
            }
        } finally {
            if (manageLoading) {
                runInAction(() => {
                    this.loading = false;
                });
            }
        }
    }

    createShoppingExpense = async (invoiceId: string, price: number) => {
        await this.loadUsers();

        const defaultUser = this.PotentialParticipants.find(c => c.value.includes('Urpi'));

        if (!defaultUser) {
            throw new Error('No user found to assign shopping expense');
        }

        const expenseItem: ExpenseItem = {
            id: uuid(),
            name: 'Ostokset',
            expenseType: 0, // ShoppingList
            organizerId: defaultUser.key,
            organizer: { id: defaultUser.key, displayName: defaultUser.value, userName: '', email: '' },
            amount: price,
            payers: [],
            lineItems: []
        };

        await this.createExpenseItem(invoiceId, expenseItem);

        const lineItem: ExpenseLineItem = {
            id: uuid(),
            expenseItemId: expenseItem.id,
            name: 'Ostokset',
            quantity: 1,
            unitPrice: price,
            total: price
        };

        await this.createLineItem(invoiceId, expenseItem.id, lineItem);

        toast.success('Ostokset kuluerä luotu onnistuneesti');
    }

    createLineItem = async (invoiceId: string, expenseItemId: string, lineItem: ExpenseLineItem) => {
        this.loading = true;
        try {
            await agent.ExpenseLineItems.create(expenseItemId, lineItem);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const expenseItem = invoice.expenseItems.find(ei => ei.id === expenseItemId);
                    if (expenseItem) {
                        if (!expenseItem.lineItems) expenseItem.lineItems = [];
                        expenseItem.lineItems.push(lineItem);
                        this.invoiceRegistry.set(invoiceId, invoice);
                        if (this.selectedInvoice?.id === invoiceId) {
                            this.selectedInvoice = invoice;
                        }
                    }
                }
                this.loading = false;
            });
            toast.success('Line item added');
        } catch (error) {
            console.log(error);
            runInAction(() => this.loading = false);
        }
    }

    updateLineItem = async (invoiceId: string, expenseItemId: string, lineItem: ExpenseLineItem) => {
        this.loading = true;
        try {
            await agent.ExpenseLineItems.update(expenseItemId, lineItem);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const expenseItem = invoice.expenseItems.find(ei => ei.id === expenseItemId);
                    if (expenseItem && expenseItem.lineItems) {
                        const index = expenseItem.lineItems.findIndex(li => li.id === lineItem.id);
                        if (index !== -1) {
                            expenseItem.lineItems[index] = lineItem;
                            this.invoiceRegistry.set(invoiceId, invoice);
                            if (this.selectedInvoice?.id === invoiceId) {
                                this.selectedInvoice = invoice;
                            }
                        }
                    }
                }
                this.loading = false;
            });
            toast.success('Line item updated');
        } catch (error) {
            console.log(error);
            runInAction(() => this.loading = false);
        }
    }

    deleteLineItem = async (invoiceId: string, expenseItemId: string, lineItemId: string) => {
        this.loading = true;
        try {
            await agent.ExpenseLineItems.delete(expenseItemId, lineItemId);
            runInAction(() => {
                const invoice = this.invoiceRegistry.get(invoiceId);
                if (invoice && invoice.expenseItems) {
                    const expenseItem = invoice.expenseItems.find(ei => ei.id === expenseItemId);
                    if (expenseItem && expenseItem.lineItems) {
                        expenseItem.lineItems = expenseItem.lineItems.filter(li => li.id !== lineItemId);
                        this.invoiceRegistry.set(invoiceId, invoice);
                        if (this.selectedInvoice?.id === invoiceId) {
                            this.selectedInvoice = invoice;
                        }
                    }
                }
                this.loading = false;
            });
            toast.success('Line item deleted');
        } catch (error) {
            console.log(error);
            runInAction(() => this.loading = false);
        }
    }
}
