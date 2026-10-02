import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import type { ReactNode } from "react";

import api from "../api/axios";


// ==========================================
// USER ROLE
// ==========================================

export type UserRole =
    | "student"
    | "interviewer"
    | "admin"
    | "owner";


// ==========================================
// USER
// ==========================================

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
}


// ==========================================
// AUTH CONTEXT TYPE
// ==========================================

interface AuthContextType {
    user: User | null;

    loading: boolean;

    login: (
        email: string,
        password: string
    ) => Promise<void>;

    register: (
        name: string,
        email: string,
        password: string
    ) => Promise<void>;

    logout: () => Promise<void>;
}


// ==========================================
// CONTEXT
// ==========================================

const AuthContext = createContext<
    AuthContextType | undefined
>(undefined);


// ==========================================
// PROVIDER PROPS
// ==========================================

interface AuthProviderProps {
    children: ReactNode;
}


// ==========================================
// AUTH PROVIDER
// ==========================================

export const AuthProvider = ({
    children,
}: AuthProviderProps) => {

    const [user, setUser] =
        useState<User | null>(null);

    const [loading, setLoading] =
        useState(true);


    // ==========================================
    // LOAD CURRENT USER
    // ==========================================

    useEffect(() => {

        const loadUser = async () => {

            const accessToken =
                localStorage.getItem(
                    "accessToken"
                );


            // No access token
            if (!accessToken) {

                setLoading(false);

                return;
            }


            try {

                const response =
                    await api.get(
                        "/users/me"
                    );


                setUser(
                    response.data.user
                );

            } catch {

                localStorage.removeItem(
                    "accessToken"
                );

                localStorage.removeItem(
                    "refreshToken"
                );

                setUser(null);

            } finally {

                setLoading(false);

            }
        };


        loadUser();

    }, []);


    // ==========================================
    // LOGIN
    // ==========================================

    const login = async (
        email: string,
        password: string
    ): Promise<void> => {

        const response =
            await api.post(
                "/auth/login",
                {
                    email,
                    password,
                }
            );


        const {
            accessToken,
            refreshToken,
            user,
        } = response.data;


        localStorage.setItem(
            "accessToken",
            accessToken
        );

        localStorage.setItem(
            "refreshToken",
            refreshToken
        );


        setUser(user);
    };


    // ==========================================
    // REGISTER
    // ==========================================

    const register = async (
        name: string,
        email: string,
        password: string
    ): Promise<void> => {

        const response =
            await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password,
                }
            );


        const {
            accessToken,
            refreshToken,
            user,
        } = response.data;


        localStorage.setItem(
            "accessToken",
            accessToken
        );

        localStorage.setItem(
            "refreshToken",
            refreshToken
        );


        setUser(user);
    };


    // ==========================================
    // LOGOUT
    // ==========================================

    const logout = async (): Promise<void> => {

        const refreshToken =
            localStorage.getItem(
                "refreshToken"
            );


        try {

            if (refreshToken) {

                await api.post(
                    "/auth/logout",
                    {
                        refreshToken,
                    }
                );

            }

        } catch {

            // Ignore logout API errors

        } finally {

            localStorage.removeItem(
                "accessToken"
            );

            localStorage.removeItem(
                "refreshToken"
            );

            setUser(null);
        }
    };


    // ==========================================
    // PROVIDER
    // ==========================================

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};


// ==========================================
// USE AUTH HOOK
// ==========================================

export const useAuth = (): AuthContextType => {

    const context =
        useContext(AuthContext);


    if (!context) {

        throw new Error(
            "useAuth must be used inside AuthProvider"
        );

    }


    return context;
};