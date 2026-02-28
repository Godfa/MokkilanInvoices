import { makeAutoObservable, runInAction } from "mobx";
import agent, { ChangePasswordValues, ForgotPasswordValues, ResetPasswordValues, User, UserFormValues } from "../api/agent";
import { router } from "../router/Routes";

export default class UserStore {
    user: User | null = null;

    constructor() {
        makeAutoObservable(this)
    }

    get isLoggedIn() {
        return !!this.user;
    }

    login = async (creds: UserFormValues) => {
        try {
            const user = await agent.Account.login(creds);
            runInAction(() => {
                this.user = user;
            });
            window.localStorage.setItem('jwt', user.token);
            const state = router.state.location.state as any;
            const from = state?.from?.pathname || '/invoices';
            const search = state?.from?.search || '';
            router.navigate(from + search);
        } catch (error) {
            throw error;
        }
    }

    register = async (creds: UserFormValues) => {
        try {
            const user = await agent.Account.register(creds);
            runInAction(() => {
                this.user = user;
            });
            window.localStorage.setItem('jwt', user.token);
            router.navigate('/invoices');
        } catch (error) {
            throw error;
        }
    }

    logout = () => {
        this.user = null;
        window.localStorage.removeItem('jwt');
        router.navigate('/');
    }

    getUser = async () => {
        try {
            const user = await agent.Account.current();
            runInAction(() => {
                this.user = user;
            });
        } catch (error) {
            console.log(error);
        }
    }

    changePassword = async (passwords: ChangePasswordValues) => {
        try {
            await agent.Account.changePassword(passwords);
            if (this.user) {
                runInAction(() => {
                    this.user!.mustChangePassword = false;
                });
            }
        } catch (error) {
            throw error;
        }
    }

    forgotPassword = async (values: ForgotPasswordValues) => {
        try {
            const response = await agent.Account.forgotPassword(values);
            return response.message;
        } catch (error) {
            throw error;
        }
    }

    resetPassword = async (values: ResetPasswordValues) => {
        try {
            const response = await agent.Account.resetPassword(values);
            return response.message;
        } catch (error) {
            throw error;
        }
    }
}
