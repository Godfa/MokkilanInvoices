import { createBrowserRouter, Navigate, RouteObject } from "react-router-dom";
import App from "../layout/App";
import InvoiceDashboard from "../../features/invoices/dashboard/InvoiceDashboard";
import InvoiceDetails from "../../features/invoices/details/InvoiceDetails";
import InvoiceForm from "../../features/invoices/form/InvoiceForm";
import LoginForm from "../../features/users/LoginForm";
import ChangePasswordForm from "../../features/users/ChangePasswordForm";
import ForgotPasswordForm from "../../features/users/ForgotPasswordForm";
import ResetPasswordForm from "../../features/users/ResetPasswordForm";
import AdminPage from "../../features/admin/AdminPage";
import ProfilePage from "../../features/profile/ProfilePage";

import InvoicePrintView from "../../features/invoices/details/InvoicePrintView";
import ParticipantInvoicePrintView from "../../features/invoices/details/ParticipantInvoicePrintView";
import ReceiptScanner from "../../features/receipts/ReceiptScanner";

import RequireAuth from "./RequireAuth";

export const routes: RouteObject[] = [
    {
        path: '/',
        element: <App />,
        children: [
            {
                element: <RequireAuth />,
                children: [
                    { path: 'invoices', element: <InvoiceDashboard /> },
                    { path: 'invoices/:id', element: <InvoiceDetails /> },
                    { path: 'invoices/:id/print', element: <InvoicePrintView /> },
                    { path: 'invoices/:id/print/:participantId', element: <ParticipantInvoicePrintView /> },
                    { path: 'createInvoice', element: <InvoiceForm key='create' /> },
                    { path: 'manage/:id', element: <InvoiceForm key='manage' /> },
                    { path: 'profile', element: <ProfilePage /> },
                    { path: 'changePassword', element: <ChangePasswordForm /> },
                    { path: 'admin', element: <AdminPage /> },
                    { path: 'scan-receipt', element: <ReceiptScanner /> },
                ]
            },
            { index: true, element: <Navigate replace to='/login' /> },
            { path: 'login', element: <LoginForm /> },
            { path: 'forgot-password', element: <ForgotPasswordForm /> },
            { path: 'reset-password', element: <ResetPasswordForm /> },
            { path: '*', element: <Navigate replace to='/invoices' /> },
        ]
    }
]

export const router = createBrowserRouter(routes);
