import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import "../styles/password-reset.css";

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        setError("");
        if (!token) {
            setError("The reset link is missing its token. Request a new link.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/reset-password", {
                token,
                password,
            });
            setMessage(response.data.message);
            window.setTimeout(() => navigate("/login"), 1800);
        } catch (requestError: any) {
            setError(
                requestError.response?.data?.message ||
                "Could not reset your password. Request a new link and try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="password-reset-page">
            <section className="password-reset-card">
                <div className="password-reset-icon">🔑</div>
                <h1>Set New Password</h1>
                <p>Choose a new password for your CodeCollab account.</p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="new-password">New Password</label>
                    <input
                        id="new-password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        minLength={6}
                        required
                    />
                    <label htmlFor="confirm-password">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                    />
                    {message && <div className="password-reset-success" role="status">{message}</div>}
                    {error && <div className="password-reset-error" role="alert">{error}</div>}
                    <button type="submit" disabled={loading || !token}>
                        {loading ? "Updating..." : "Reset Password"}
                    </button>
                </form>
                <Link className="password-reset-back" to="/login">← Back to Sign In</Link>
            </section>
        </main>
    );
};

export default ResetPassword;
