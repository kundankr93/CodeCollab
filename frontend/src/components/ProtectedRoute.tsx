import {
    Navigate,
    Outlet,
} from "react-router-dom";

import {
    useAuth,
    type UserRole,
} from "../context/AuthContext";

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

const ProtectedRoute = ({
    allowedRoles,
}: ProtectedRouteProps) => {

    const {
        user,
        loading,
    } = useAuth();


    // ==========================================
    // AUTHENTICATION LOADING
    // ==========================================

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#080914",
                    color: "#ffffff",
                    fontSize: "18px",
                }}
            >
                Loading...
            </div>
        );
    }


    // ==========================================
    // USER NOT LOGGED IN
    // ==========================================

    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }


    // ==========================================
    // ROLE AUTHORIZATION
    // ==========================================

    if (
        allowedRoles &&
        !allowedRoles.includes(
            user.role
        )
    ) {
        return (
            <Navigate
                to="/dashboard"
                replace
            />
        );
    }


    // ==========================================
    // AUTHORIZED
    // ==========================================

    return <Outlet />;
};

export default ProtectedRoute;