import { useState } from "react";

import type { FormEvent } from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";


const Register = () => {

    const navigate = useNavigate();

    const { register } = useAuth();


    const [name, setName] = useState("");

    const [email, setEmail] = useState("");

    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    const [loading, setLoading] = useState(false);


    const handleSubmit = async (
        e: FormEvent
    ): Promise<void> => {

        e.preventDefault();

        setError("");

        setLoading(true);


        try {

            await register(
                name,
                email,
                password
            );

            navigate("/dashboard");

        } catch (error: any) {

            setError(
                error.response?.data?.message ||
                "Registration failed"
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
                Create Account
            </h2>


            <form onSubmit={handleSubmit}>

                <div>

                    <label>
                        Name
                    </label>

                    <input
                        type="text"
                        value={name}
                        onChange={(e) =>
                            setName(e.target.value)
                        }
                        required
                    />

                </div>


                <div>

                    <label>
                        Email
                    </label>

                    <input
                        type="email"
                        value={email}
                        onChange={(e) =>
                            setEmail(e.target.value)
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
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        minLength={6}
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
                    disabled={loading}
                >
                    {loading
                        ? "Creating account..."
                        : "Register"}
                </button>

            </form>


            <p>

                Already have an account?{" "}

                <Link to="/login">
                    Login
                </Link>

            </p>

        </div>
    );
};


export default Register;