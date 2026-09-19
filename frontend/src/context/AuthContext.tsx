import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import type { ReactNode } from "react";

import api from "../api/axios";


interface User {
    id: string;
    name: string;
    email: string;
    role: "student" | "interviewer" | "admin";
    avatar?: string;
}


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


const AuthContext = createContext<
    AuthContextType | undefined
>(undefined);


interface AuthProviderProps {
    children: ReactNode;
}


export const AuthProvider = ({
    children,
}: AuthProviderProps) => {

    const [user, setUser] = useState<User | null>(null);

    const [loading, setLoading] = useState(true);


    useEffect(() => {

        const loadUser = async () => {

            const accessToken =
                localStorage.getItem("accessToken");


            if (!accessToken) {
                setLoading(false);
                return;
            }


            try {

                const response = await api.get(
                    "/users/me"
                );

                setUser(response.data.user);

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


    const login = async (
        email: string,
        password: string
    ): Promise<void> => {

        const response = await api.post(
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


    const register = async (
        name: string,
        email: string,
        password: string
    ): Promise<void> => {

        const response = await api.post(
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


    const logout = async (): Promise<void> => {

        const refreshToken =
            localStorage.getItem("refreshToken");


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


export const useAuth = (): AuthContextType => {

    const context = useContext(AuthContext);


    if (!context) {

        throw new Error(
            "useAuth must be used inside AuthProvider"
        );

    }


    return context;
};