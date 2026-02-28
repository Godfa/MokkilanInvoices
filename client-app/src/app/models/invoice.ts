export enum InvoiceStatus {
    Aktiivinen = 0,
    Maksussa = 1,
    Arkistoitu = 2
}

export interface ExpenseLineItem {
    id: string;
    expenseItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface AppUser {
    id: string;
    userName: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    bankAccount?: string;
    preferredPaymentMethod?: string;
}

export interface ExpenseItemPayer {
    expenseItemId: string;
    appUserId: string;
    appUser: AppUser;
}

export interface ExpenseItem {
    id: string;
    organizerId: string;
    organizer: AppUser;
    expenseType: number; // Enum value
    name: string;
    amount: number;
    payers: ExpenseItemPayer[];
    lineItems: ExpenseLineItem[];
}

export interface ExpenseTypeOption {
    key: number;
    value: string;
}

export interface InvoiceParticipant {
    invoiceId: string;
    appUserId: string;
    appUser: AppUser;
    hasPaid?: boolean;
    paidAt?: string;
}

export interface InvoiceApproval {
    invoiceId: string;
    appUserId: string;
    appUser: AppUser;
    approvedAt: string;
}

export interface Invoice {
    id: string;
    lanNumber: number;
    description: string;
    title: string;
    image: string;
    status: InvoiceStatus;
    amount: number;
    expenseItems: ExpenseItem[];
    participants: InvoiceParticipant[];
    approvals: InvoiceApproval[];
}

export interface ParticipantBalance {
    userId: string;
    displayName: string;
    totalPaid: number;
    totalOwed: number;
    netBalance: number;
}

export interface PaymentTransaction {
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
    toUser?: AppUser;
}

