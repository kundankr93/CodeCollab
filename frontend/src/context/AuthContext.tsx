import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";

import api from "../api/axios";

export type UserRole =
    | "student"
    | "interviewer"
    | "admin"
    | "owner";

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const accessToken = localStorage.getItem("accessToken");

            if (!accessToken) {
                setLoading(false);
                return;
            }

            try {
                const response = await api.get("/users/me");
                setUser(response.data.user as User);
            } catch {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        void loadUser();
    }, []);

    const login = async (email: string, password: string): Promise<void> => {
        const response = await api.post("/auth/login", { email, password });
        const { accessToken, refreshToken, user } = response.data;

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        setUser(user as User);
    };

    const register = async (
        name: string,
        email: string,
        password: string
    ): Promise<void> => {
        const response = await api.post("/auth/register", {
            name,
            email,
            password,
        });
        const { accessToken, refreshToken, user } = response.data;

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        setUser(user as User);
    };

    const logout = async (): Promise<void> => {
        const refreshToken = localStorage.getItem("refreshToken");

        try {
            if (refreshToken) {
                await api.post("/auth/logout", { refreshToken });
            }
        } catch {
            // Local logout must still complete if the API is unavailable.
        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setUser(null);
        }
    };

    const updateUser = (updatedUser: User): void => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
                updateUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
};
