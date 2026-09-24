import { useState } from "react";
import type { FormEvent } from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import "../styles/register.css";

interface IconProps {
    size?: number;
}

const CodeIcon = ({
    size = 24,
}: IconProps) => (
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
}: IconProps) => (
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
}: IconProps) => (
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
}: IconProps) => (
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
}: IconProps) => (
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

const UserIcon = ({
    size = 20,
}: IconProps) => (
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
        <circle
            cx="12"
            cy="8"
            r="4"
        />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
);

const MailIcon = ({
    size = 20,
}: IconProps) => (
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
}: IconProps) => (
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

const ArrowIcon = ({
    size = 20,
}: IconProps) => (
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

const EyeIcon = ({
    size = 20,
    closed = false,
}: IconProps & {
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

interface FeatureItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    className: string;
}

const FeatureItem = ({
    icon,
    title,
    description,
    className,
}: FeatureItemProps) => (
    <div className="register-feature">
        <div
            className={`register-feature-icon ${className}`}
        >
            {icon}
        </div>

        <div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    </div>
);

const Register = () => {
    const navigate = useNavigate();

    const { register } =
        useAuth();

    const [name, setName] =
        useState("");

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
                await register(
                    name.trim(),
                    email.trim(),
                    password
                );

                navigate(
                    "/dashboard"
                );
            } catch (error: any) {
                console.error(
                    "Registration error:",
                    error
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                        "Registration failed"
                );
            } finally {
                setLoading(false);
            }
        };

    return (
        <div className="register-page">
            {/* =========================================
                BACKGROUND EFFECTS
            ========================================== */}

            <div className="register-bg-grid" />

            <div className="register-glow register-glow-one" />
            <div className="register-glow register-glow-two" />

            {/* =========================================
                NAVBAR
            ========================================== */}

            <header className="register-navbar">
                <Link
                    to="/register"
                    className="register-logo"
                >
                    <span className="register-logo-icon">
                        <CodeIcon size={25} />
                    </span>

                    <span>
                        Code
                        <strong>
                            Collab
                        </strong>
                    </span>
                </Link>

                <nav className="register-nav">
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

            {/* =========================================
                MAIN CONTENT
            ========================================== */}

            <main className="register-main">
                {/* =====================================
                    LEFT HERO SECTION
                ====================================== */}

                <section
                    className="register-hero"
                    id="features"
                >
                    <div className="register-badge">
                        <span>🚀</span>

                        <span>
                            Build
                        </span>

                        <span className="register-badge-muted">
                            Together
                        </span>

                        <span className="register-badge-muted">
                            Code
                        </span>

                        <span className="register-badge-muted">
                            Better
                        </span>
                    </div>

                    <h1>
                        Join{" "}
                        <span>
                            CodeCollab
                        </span>
                    </h1>

                    <p className="register-hero-description">
                        Create your account
                        and start
                        collaborating on
                        code in real-time.
                    </p>

                    <div className="register-features">
                        <FeatureItem
                            icon={
                                <UsersIcon
                                    size={26}
                                />
                            }
                            title="Real-time Collaboration"
                            description="Code together, from anywhere"
                            className="feature-purple"
                        />

                        <FeatureItem
                            icon={
                                <TerminalIcon
                                    size={26}
                                />
                            }
                            title="Built-in Code Execution"
                            description="Run and test code instantly"
                            className="feature-blue"
                        />

                        <FeatureItem
                            icon={
                                <FolderIcon
                                    size={26}
                                />
                            }
                            title="Manage Projects"
                            description="Organize and share with ease"
                            className="feature-green"
                        />

                        <FeatureItem
                            icon={
                                <ShieldIcon
                                    size={26}
                                />
                            }
                            title="Secure & Reliable"
                            description="Your code, your privacy"
                            className="feature-pink"
                        />
                    </div>

                    {/* Decorative editor */}
                    <div className="register-code-visual">
                        <div className="register-code-window">
                            <div className="register-window-bar">
                                <span />
                                <span />
                                <span />

                                <small>
                                    collaboration.ts
                                </small>
                            </div>

                            <div className="register-code-body">
                                <div className="code-line">
                                    <span className="line-number">
                                        01
                                    </span>

                                    <span className="code-purple">
                                        function
                                    </span>{" "}
                                    <span className="code-blue">
                                        collaborate
                                    </span>
                                    <span>
                                        ()
                                    </span>{" "}
                                    <span>
                                        {"{"}
                                    </span>
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        02
                                    </span>

                                    <span className="code-purple">
                                        const
                                    </span>{" "}
                                    <span className="code-yellow">
                                        ideas
                                    </span>{" "}
                                    = [
                                    <span className="code-green">
                                        "build"
                                    </span>
                                    ,
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        03
                                    </span>

                                    <span className="code-green">
                                        &nbsp;&nbsp;"learn"
                                    </span>
                                    ,
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        04
                                    </span>

                                    <span className="code-green">
                                        &nbsp;&nbsp;"grow"
                                    </span>
                                    ];
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        05
                                    </span>

                                    <span>
                                        &nbsp;
                                    </span>
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        06
                                    </span>

                                    <span className="code-purple">
                                        return
                                    </span>{" "}
                                    <span>
                                        ideas.join(
                                    </span>
                                    <span className="code-green">
                                        " + "
                                    </span>
                                    );
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        07
                                    </span>

                                    <span>
                                        {"}"}
                                    </span>
                                </div>

                                <div className="code-line code-comment">
                                    <span className="line-number">
                                        08
                                    </span>

                                    // Together
                                    we code
                                    better.
                                </div>

                                <div className="code-line">
                                    <span className="line-number">
                                        09
                                    </span>

                                    console.log(
                                    <span className="code-green">
                                        "collaborate()"
                                    </span>
                                    );
                                </div>
                            </div>
                        </div>

                        <div className="register-floating-card register-floating-one">
                            <CodeIcon size={25} />
                        </div>

                        <div className="register-floating-card register-floating-two">
                            <span>{"</>"}</span>
                        </div>

                        <div className="register-floating-line line-one" />
                        <div className="register-floating-line line-two" />
                    </div>

                    <div className="register-quote">
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

                {/* =====================================
                    REGISTER FORM
                ====================================== */}

                <section className="register-card">
                    <div className="register-card-header">
                        <h2>
                            Create Account
                        </h2>

                        <p>
                            Join CodeCollab and
                            start your coding
                            journey
                        </p>
                    </div>

                    <form
                        className="register-form"
                        onSubmit={
                            handleSubmit
                        }
                    >
                        {/* NAME */}

                        <div className="register-field">
                            <label>
                                <UserIcon
                                    size={18}
                                />

                                Full Name
                            </label>

                            <div className="register-input-wrapper">
                                <UserIcon
                                    size={19}
                                />

                                <input
                                    type="text"
                                    value={name}
                                    onChange={(
                                        e
                                    ) =>
                                        setName(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Enter your full name"
                                    autoComplete="name"
                                    required
                                />
                            </div>
                        </div>

                        {/* EMAIL */}

                        <div className="register-field">
                            <label>
                                <MailIcon
                                    size={18}
                                />

                                Email Address
                            </label>

                            <div className="register-input-wrapper">
                                <MailIcon
                                    size={19}
                                />

                                <input
                                    type="email"
                                    value={
                                        email
                                    }
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

                        {/* PASSWORD */}

                        <div className="register-field">
                            <label>
                                <LockIcon
                                    size={18}
                                />

                                Password
                            </label>

                            <div className="register-input-wrapper">
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
                                    placeholder="Create a password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    required
                                />

                                <button
                                    type="button"
                                    className="password-toggle"
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

                        {/* PASSWORD INFO */}

                        <div className="password-info">
                            <div className="password-info-title">
                                Password must contain:
                            </div>

                            <div className="password-rule">
                                <span
                                    className={
                                        password.length >=
                                        6
                                            ? "rule-active"
                                            : ""
                                    }
                                >
                                    {password.length >=
                                    6
                                        ? "✓"
                                        : "○"}
                                </span>

                                At least 6 characters
                            </div>

                            <div className="password-rule password-rule-muted">
                                <span>
                                    •
                                </span>

                                Use a strong password
                            </div>
                        </div>

                        {/* ERROR */}

                        {error && (
                            <div className="register-error">
                                {error}
                            </div>
                        )}

                        {/* SUBMIT */}

                        <button
                            type="submit"
                            className="register-submit"
                            disabled={loading}
                        >
                            <span>
                                {loading
                                    ? "Creating Account..."
                                    : "Create Account"}
                            </span>

                            {!loading && (
                                <ArrowIcon
                                    size={20}
                                />
                            )}
                        </button>
                    </form>

                    <div className="register-divider">
                        <span />
                        <p>OR</p>
                        <span />
                    </div>

                    <p className="register-login-text">
                        Already have an
                        account?{" "}

                        <Link to="/login">
                            Login
                        </Link>
                    </p>
                </section>
            </main>
        </div>
    );
};

export default Register;