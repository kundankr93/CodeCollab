import { useState } from "react";
import type { FormEvent } from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import "../styles/login.css";

const CodeIcon = ({
    size = 24,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const UsersIcon = ({
    size = 24,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle
            cx="9"
            cy="7"
            r="4"
        />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const TerminalIcon = ({
    size = 24,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="4 17 10 11 4 5" />
        <line
            x1="12"
            y1="19"
            x2="20"
            y2="19"
        />
    </svg>
);

const FolderIcon = ({
    size = 24,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
);

const ShieldIcon = ({
    size = 24,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const MailIcon = ({
    size = 20,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
        />
        <polyline points="3 7 12 13 21 7" />
    </svg>
);

const LockIcon = ({
    size = 20,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect
            x="4"
            y="10"
            width="16"
            height="11"
            rx="2"
        />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
);

const EyeIcon = ({
    size = 20,
    closed = false,
}: {
    size?: number;
    closed?: boolean;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {closed ? (
            <>
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                <path d="M9.88 4.24A9.77 9.77 0 0 1 12 4c5 0 9 4 10 8a10.6 10.6 0 0 1-2.07 3.94" />
                <path d="M6.61 6.61A10.9 10.9 0 0 0 2 12c1 4 5 8 10 8a9.7 9.7 0 0 0 4.39-1.06" />
            </>
        ) : (
            <>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle
                    cx="12"
                    cy="12"
                    r="3"
                />
            </>
        )}
    </svg>
);

const ArrowIcon = ({
    size = 20,
}: {
    size?: number;
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
        />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const Login = () => {
    const navigate =
        useNavigate();

    const { login } =
        useAuth();

    const [email, setEmail] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

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
        <div className="login-page">
            {/* Background */}

            <div className="login-bg-grid" />

            <div className="login-glow login-glow-one" />
            <div className="login-glow login-glow-two" />

            {/* Navbar */}

            <header className="login-navbar">
                <Link
                    to="/login"
                    className="login-logo"
                >
                    <span className="login-logo-icon">
                        <CodeIcon size={25} />
                    </span>

                    <span>
                        Code
                        <strong>
                            Collab
                        </strong>
                    </span>
                </Link>

                <nav className="login-nav">
                    <a href="#features">
                        Features
                    </a>

                    <a href="#collaborate">
                        Collaborate
                    </a>

                    <a href="#code">
                        Code
                    </a>

                    <a href="#learn">
                        Learn
                    </a>
                </nav>
            </header>

            {/* Main */}

            <main className="login-main">
                {/* Left */}

                <section
                    className="login-hero"
                    id="features"
                >
                    <div className="login-badge">
                        <span>
                            🚀
                        </span>

                        <span>
                            Welcome
                        </span>

                        <span className="login-badge-muted">
                            Back
                        </span>

                        <span className="login-badge-muted">
                            Code
                        </span>

                        <span className="login-badge-muted">
                            Better
                        </span>
                    </div>

                    <h1>
                        Welcome to{" "}
                        <span>
                            CodeCollab
                        </span>
                    </h1>

                    <p className="login-hero-description">
                        Sign in and continue
                        building, coding and
                        collaborating in
                        real-time.
                    </p>

                    <div className="login-features">
                        <div className="login-feature">
                            <div className="login-feature-icon feature-purple">
                                <UsersIcon
                                    size={26}
                                />
                            </div>

                            <div>
                                <h3>
                                    Real-time Collaboration
                                </h3>

                                <p>
                                    Code together,
                                    from anywhere
                                </p>
                            </div>
                        </div>

                        <div className="login-feature">
                            <div className="login-feature-icon feature-blue">
                                <TerminalIcon
                                    size={26}
                                />
                            </div>

                            <div>
                                <h3>
                                    Built-in Code Execution
                                </h3>

                                <p>
                                    Run and test
                                    code instantly
                                </p>
                            </div>
                        </div>

                        <div className="login-feature">
                            <div className="login-feature-icon feature-green">
                                <FolderIcon
                                    size={26}
                                />
                            </div>

                            <div>
                                <h3>
                                    Manage Projects
                                </h3>

                                <p>
                                    Organize and
                                    share with ease
                                </p>
                            </div>
                        </div>

                        <div className="login-feature">
                            <div className="login-feature-icon feature-pink">
                                <ShieldIcon
                                    size={26}
                                />
                            </div>

                            <div>
                                <h3>
                                    Secure & Reliable
                                </h3>

                                <p>
                                    Your code,
                                    your privacy
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Code visual */}

                    <div className="login-code-visual">
                        <div className="login-code-window">
                            <div className="login-window-bar">
                                <span />
                                <span />
                                <span />

                                <small>
                                    workspace.ts
                                </small>
                            </div>

                            <div className="login-code-body">
                                <div className="code-line">
                                    <span className="line-number">
                                        01
                                    </span>

                                    <span className="code-purple">
                                        const
                                    </span>{" "}

                                    <span className="code-blue">
                                        workspace
                                    </span>{" "}
                                    = {"{"}
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        02
                                    </span>

                                    &nbsp;&nbsp;team:{" "}
                                    <span className="code-green">
                                        "CodeCollab"
                                    </span>
                                    ,
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        03
                                    </span>

                                    &nbsp;&nbsp;status:{" "}
                                    <span className="code-green">
                                        "connected"
                                    </span>
                                    ,
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        04
                                    </span>

                                    &nbsp;&nbsp;users:{" "}
                                    <span className="code-yellow">
                                        12
                                    </span>
                                    ,
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        05
                                    </span>

                                    {"}"}
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        06
                                    </span>

                                    <span className="code-purple">
                                        await
                                    </span>{" "}
                                    workspace.connect();
                                </div>

                                <div className="code-line code-comment">
                                    <span className="line-number">
                                        07
                                    </span>

                                    // Build together.
                                </div>
                            </div>
                        </div>

                        <div className="login-floating-card login-floating-one">
                            <CodeIcon size={25} />
                        </div>

                        <div className="login-floating-card login-floating-two">
                            <span>
                                {"</>"}
                            </span>
                        </div>
                    </div>

                    <div className="login-quote">
                        <span>
                            "
                        </span>

                        Great developers
                        build together.

                        <span>
                            "
                        </span>
                    </div>
                </section>

                {/* Login card */}

                <section className="login-card">
                    <div className="login-card-header">
                        <h2>
                            Welcome Back
                        </h2>

                        <p>
                            Sign in to continue
                            to your CodeCollab
                            workspace
                        </p>
                    </div>

                    <form
                        className="login-form"
                        onSubmit={
                            handleSubmit
                        }
                    >
                        {/* Email */}

                        <div className="login-field">
                            <label>
                                <MailIcon
                                    size={18}
                                />

                                Email Address
                            </label>

                            <div className="login-input-wrapper">
                                <MailIcon
                                    size={19}
                                />

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(
                                        e
                                    ) =>
                                        setEmail(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}

                        <div className="login-field">
                            <label>
                                <LockIcon
                                    size={18}
                                />

                                Password
                            </label>

                            <div className="login-input-wrapper">
                                <LockIcon
                                    size={19}
                                />

                                <input
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={
                                        password
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setPassword(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className="login-password-toggle"
                                    onClick={() =>
                                        setShowPassword(
                                            (
                                                previous
                                            ) =>
                                                !previous
                                        )
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    <EyeIcon
                                        size={20}
                                        closed={
                                            showPassword
                                        }
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Error */}

                        {error && (
                            <div className="login-error">
                                {error}
                            </div>
                        )}

                        {/* Submit */}

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={loading}
                        >
                            <span>
                                {loading
                                    ? "Signing in..."
                                    : "Sign In"}
                            </span>

                            {!loading && (
                                <ArrowIcon
                                    size={20}
                                />
                            )}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span />
                        <p>OR</p>
                        <span />
                    </div>

                    <p className="login-register-text">
                        Don't have an
                        account?{" "}

                        <Link to="/register">
                            Create Account
                        </Link>
                    </p>
                </section>
            </main>
        </div>
    );
};

export default Login;