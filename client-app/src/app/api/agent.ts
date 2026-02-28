import axios, { AxiosError, AxiosResponse } from "axios";
import { Invoice, ExpenseItem, ExpenseTypeOption, ExpenseLineItem, InvoiceStatus } from "../models/invoice";
import { toast } from 'react-toastify';

const sleep = (delay: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}

axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

axios.interceptors.request.use(config => {
    const token = window.localStorage.getItem('jwt');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
})

axios.interceptors.response.use(async (response: AxiosResponse) => {
    try {
        await sleep(1000);
        return response;
    } catch (error) {
        console.log(error);
        return await Promise.reject(error);
    }
}, (error: AxiosError) => {
    if (!error.response) {
        // Network error or server not responding
        toast.error('Network error - cannot connect to server');
        return Promise.reject(error);
    }

    const { data, status } = error.response as AxiosResponse;

    switch (status) {
        case 400:
            if (typeof data === 'string') {
                toast.error(data);
            } else {
                toast.error('Bad request');
            }
            break;
        case 401:
            if (typeof data === 'string') {
                toast.error(data);
            } else {
                toast.error('Unauthorized');
            }
            break;
        case 404:
            toast.error('Not found');
            break;
        case 500:
            toast.error('Server error');
            break;
        default:
            toast.error('An error occurred');
    }

    return Promise.reject(error);
})

const responseBody = <T>(response: AxiosResponse<T>) => response.data;

const requests = {
    get: <T>(url: string) => axios.get<T>(url).then(responseBody),
    post: <T>(url: string, body: {}) => axios.post<T>(url, body).then(responseBody),
    put: <T>(url: string, body: {}) => axios.put<T>(url, body).then(responseBody),
    del: <T>(url: string) => axios.delete<T>(url).then(responseBody)
}

const Invoices = {
    list: () => requests.get<Invoice[]>('/invoices'),
    details: (id: string) => requests.get<Invoice>(`/invoices/${id}`),
    create: (invoice: Invoice) => requests.post<Invoice>('/invoices', invoice),
    update: (invoice: Invoice) => requests.put<void>(`/invoices/${invoice.id}`, invoice),
    delete: (id: string) => requests.del<void>(`/invoices/${id}`),
    addParticipant: (invoiceId: string, userId: string) => requests.post<void>(`/invoices/${invoiceId}/participants/${userId}`, {}),
    removeParticipant: (invoiceId: string, userId: string) => requests.del<void>(`/invoices/${invoiceId}/participants/${userId}`),
    changeStatus: (invoiceId: string, status: InvoiceStatus) => requests.put<Invoice>(`/invoices/${invoiceId}/status/${status}`, {}),
    approveInvoice: (invoiceId: string, userId: string) => requests.post<Invoice>(`/invoices/${invoiceId}/approve/${userId}`, {}),
    unapproveInvoice: (invoiceId: string, userId: string) => requests.del<Invoice>(`/invoices/${invoiceId}/approve/${userId}`),
    sendPaymentNotifications: (invoiceId: string) => requests.post<void>(`/invoices/${invoiceId}/send-payment-notifications`, {}),
    togglePaymentStatus: (invoiceId: string, userId: string) => requests.post<void>(`/invoices/${invoiceId}/participants/${userId}/toggle-payment`, {})
}

const ExpenseItems = {
    list: () => requests.get<ExpenseItem[]>('/expenseitems'),
    details: (id: string) => requests.get<ExpenseItem>(`/expenseitems/${id}`),
    create: (expenseItem: ExpenseItem) => requests.post<void>('/expenseitems', expenseItem),
    createForInvoice: (invoiceId: string, expenseItem: ExpenseItem) => requests.post<void>(`/expenseitems/${invoiceId}`, expenseItem),
    update: (expenseItem: ExpenseItem) => requests.put<void>(`/expenseitems/${expenseItem.id}`, expenseItem),
    delete: (id: string) => requests.del<void>(`/expenseitems/${id}`),
    addPayer: (expenseItemId: string, userId: string) => requests.post<void>(`/expenseitems/${expenseItemId}/payers/${userId}`, {}),
    removePayer: (expenseItemId: string, userId: string) => requests.del<void>(`/expenseitems/${expenseItemId}/payers/${userId}`)
}

const ExpenseTypes = {
    list: () => requests.get<ExpenseTypeOption[]>('/expensetypes')
}

const ExpenseLineItems = {
    list: (expenseItemId: string) => requests.get<ExpenseLineItem[]>(`/expenselineitems/${expenseItemId}`),
    create: (expenseItemId: string, lineItem: ExpenseLineItem) => requests.post<void>(`/expenselineitems/${expenseItemId}`, lineItem),
    update: (expenseItemId: string, lineItem: ExpenseLineItem) => requests.put<void>(`/expenselineitems/${expenseItemId}/items/${lineItem.id}`, lineItem),
    delete: (expenseItemId: string, lineItemId: string) => requests.del<void>(`/expenselineitems/${expenseItemId}/items/${lineItemId}`)
}

export interface UserFormValues {
    email: string;
    password: string;
    displayName?: string;
    userName?: string;
}

export interface User {
    id: string;
    userName: string;
    displayName: string;
    token: string;
    image?: string;
    mustChangePassword: boolean;
    roles: string[];
}

export interface ChangePasswordValues {
    newPassword: string;
}

export interface ForgotPasswordValues {
    email: string;
}

export interface ResetPasswordValues {
    email: string;
    token: string;
    newPassword: string;
}

export interface UserManagement {
    id: string;
    userName: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    bankAccount?: string;
    preferredPaymentMethod?: string;
    mustChangePassword: boolean;
    isAdmin: boolean;
}

export interface CreateUser {
    userName: string;
    displayName: string;
    email: string;
}

export interface UpdateUser {
    displayName: string;
    email: string;
    phoneNumber?: string;
    bankAccount?: string;
    preferredPaymentMethod?: string;
}

export interface UserProfile {
    id: string;
    userName: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    bankAccount?: string;
    preferredPaymentMethod?: string;
}

export interface UpdateProfile {
    displayName: string;
    email: string;
    phoneNumber?: string;
    bankAccount?: string;
    preferredPaymentMethod?: string;
}

const Account = {
    current: () => requests.get<User>('/account'),
    login: (user: UserFormValues) => requests.post<User>('/account/login', user),
    register: (user: UserFormValues) => requests.post<User>('/account/register', user),
    changePassword: (passwords: ChangePasswordValues) => requests.post<void>('/account/changePassword', passwords),
    forgotPassword: (values: ForgotPasswordValues) => requests.post<{ message: string }>('/account/forgotPassword', values),
    resetPassword: (values: ResetPasswordValues) => requests.post<{ message: string }>('/account/resetPassword', values),
    getProfile: () => requests.get<UserProfile>('/account/profile'),
    updateProfile: (profile: UpdateProfile) => requests.put<void>('/account/profile', profile)
}

const Admin = {
    listUsers: () => requests.get<UserManagement[]>('/admin/users'),
    createUser: (user: CreateUser) => requests.post<UserManagement>('/admin/users', user),
    updateUser: (id: string, user: UpdateUser) => requests.put<void>(`/admin/users/${id}`, user),
    deleteUser: (id: string) => requests.del<void>(`/admin/users/${id}`),
    grantAdminRole: (id: string) => requests.post<void>(`/admin/users/${id}/grant-admin`, {}),
    revokeAdminRole: (id: string) => requests.del<void>(`/admin/users/${id}/revoke-admin`),
    sendPasswordResetLink: (id: string) => requests.post<{ message: string }>(`/admin/users/${id}/reset-password`, {}),
    unlockUser: (id: string) => requests.post<void>(`/admin/users/${id}/unlock`, {})
}

const Users = {
    list: () => requests.get<UserManagement[]>('/users')
}

export interface ScannedReceiptLine {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    confidence?: number;
}

export interface ScannedReceiptResult {
    provider: string;
    lines: ScannedReceiptLine[];
    total?: number;
    merchantName?: string;
    receiptDate?: string;
    warnings: string[];
    processingTimeMs: number;
}

const Receipts = {
    scan: (file: File, language: string = 'fi', provider: string = 'auto', ollamaModel?: string) => {
        const formData = new FormData();
        formData.append('file', file);

        let url = `/receipts/scan?language=${language}&provider=${provider}`;
        if (ollamaModel && provider === 'ollama') {
            url += `&ollamaModel=${ollamaModel}`;
        }

        return axios.post<ScannedReceiptResult>(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }).then(responseBody);
    }
}

const agent = {
    Invoices,
    ExpenseItems,
    ExpenseLineItems,
    ExpenseTypes,
    Account,
    Admin,
    Users,
    Receipts
}

export default agent;