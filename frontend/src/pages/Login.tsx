import { useState } from "react";
import type { FormEvent } from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const Login = () => {
    const navigate =
        useNavigate();

    const { login } =
        useAuth();

    const [email, setEmail] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [error, setError] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const handleSubmit =
        async (
            e: FormEvent
        ): Promise<void> => {
            e.preventDefault();

            setError("");

            setLoading(true);

            try {
                await login(
                    email.trim(),
                    password
                );

                navigate(
                    "/dashboard"
                );
            } catch (error: any) {
                console.error(
                    "Login error:",
                    error
                );

                console.error(
                    "Response:",
                    error.response
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                        "Login failed"
                );
            } finally {
                setLoading(false);
            }
        };

    return (
        <div>
            <h1>
                CodeCollab
            </h1>

            <h2>
                Login
            </h2>

            <form
                onSubmit={
                    handleSubmit
                }
            >
                <div>
                    <label>
                        Email
                    </label>

                    <input
                        type="email"
                        value={
                            email
                        }
                        onChange={(
                            e
                        ) =>
                            setEmail(
                                e.target
                                    .value
                            )
                        }
                        required
                    />
                </div>

                <div>
                    <label>
                        Password
                    </label>

                    <input
                        type="password"
                        value={
                            password
                        }
                        onChange={(
                            e
                        ) =>
                            setPassword(
                                e.target
                                    .value
                            )
                        }
                        required
                    />
                </div>

                {error && (
                    <p>
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={
                        loading
                    }
                >
                    {loading
                        ? "Logging in..."
                        : "Login"}
                </button>
            </form>

            <p>
                Don't have an
                account?{" "}

                <Link to="/register">
                    Register
                </Link>
            </p>
        </div>
    );
};

export default Login;