import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStore } from "../stores/store";
import { observer } from "mobx-react-lite";

function RequireAuth() {
    const { userStore } = useStore();
    const location = useLocation();

    if (!userStore.isLoggedIn) {
        return <Navigate to='/login' state={{ from: location }} replace />
    }

    return <Outlet />;
}

export default observer(RequireAuth);
