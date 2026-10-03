import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import "../styles/password-reset.css";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);
        try {
            const response = await api.post("/auth/forgot-password", {
                email: email.trim(),
            });
            setMessage(response.data.message);
        } catch (requestError: any) {
            setError(
                requestError.response?.data?.message ||
                "Could not send the reset link. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="password-reset-page">
            <section className="password-reset-card">
                <div className="password-reset-icon">🔐</div>
                <h1>Forgot Password?</h1>
                <p>Enter the email address associated with your CodeCollab account. If it exists, we’ll send you a reset link.</p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="reset-email">Email Address</label>
                    <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                    />
                    {message && <div className="password-reset-success" role="status">{message}</div>}
                    {error && <div className="password-reset-error" role="alert">{error}</div>}
                    <button type="submit" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>
                <Link className="password-reset-back" to="/login">← Back to Sign In</Link>
            </section>
        </main>
    );
};

export default ForgotPassword;
