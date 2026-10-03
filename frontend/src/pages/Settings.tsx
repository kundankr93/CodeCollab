import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import { useAuth, type User } from "../context/AuthContext";
import "../styles/Settings.css";

type SettingsTab = "profile" | "account" | "security";

const Settings = () => {
    const navigate = useNavigate();
    const { user, updateUser, logout } = useAuth();

    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
    const [name, setName] = useState(user?.name ?? "");
    const [avatar, setAvatar] = useState(user?.avatar ?? "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [profileError, setProfileError] = useState("");
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        setName(user?.name ?? "");
        setAvatar(user?.avatar ?? "");
    }, [user]);

    const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProfileMessage("");
        setProfileError("");

        if (name.trim().length < 2 || name.trim().length > 50) {
            setProfileError("Name must be between 2 and 50 characters.");
            return;
        }

        setProfileLoading(true);
        try {
            const response = await api.patch("/users/me", {
                name: name.trim(),
                avatar: avatar.trim(),
            });
            updateUser(response.data.user as User);
            setProfileMessage("Your profile has been updated.");
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    .response?.data?.message;
            setProfileError(message || "Could not update your profile.");
        } finally {
            setProfileLoading(false);
        }
    };

    const changePassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordMessage("");
        setPasswordError("");

        if (newPassword.length < 6) {
            setPasswordError("New password must contain at least 6 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }

        setPasswordLoading(true);
        try {
            await api.patch("/users/me/password", {
                currentPassword,
                newPassword,
            });

            setPasswordMessage("Password changed. Please log in again.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

            await logout();
            navigate("/login", { replace: true });
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    .response?.data?.message;
            setPasswordError(message || "Could not change your password.");
        } finally {
            setPasswordLoading(false);
        }
    };

    const initials = user?.name?.trim().charAt(0).toUpperCase() || "U";
    const createdAt = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "Not available";

    return (
        <div className="settings-page">
            <aside className="settings-sidebar">
                <button
                    className="settings-back"
                    type="button"
                    onClick={() => navigate("/dashboard")}
                >
                    <span aria-hidden="true">←</span> Back to dashboard
                </button>

                <div className="settings-brand">
                    <span className="settings-brand-icon">&lt;/&gt;</span>
                    <span>CodeCollab</span>
                </div>

                <div className="settings-nav-title">SETTINGS</div>
                <nav className="settings-nav" aria-label="Settings sections">
                    <button
                        type="button"
                        className={activeTab === "profile" ? "active" : ""}
                        onClick={() => setActiveTab("profile")}
                    >
                        <span aria-hidden="true">◉</span> Profile
                    </button>
                    <button
                        type="button"
                        className={activeTab === "account" ? "active" : ""}
                        onClick={() => setActiveTab("account")}
                    >
                        <span aria-hidden="true">▣</span> Account
                    </button>
                    <button
                        type="button"
                        className={activeTab === "security" ? "active" : ""}
                        onClick={() => setActiveTab("security")}
                    >
                        <span aria-hidden="true">◇</span> Security
                    </button>
                </nav>

                <div className="settings-sidebar-user">
                    <div className="settings-avatar-small">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="" />
                        ) : (
                            initials
                        )}
                    </div>
                    <div>
                        <strong>{user?.name || "User"}</strong>
                        <span>{user?.email}</span>
                    </div>
                </div>
            </aside>

            <main className="settings-main">
                <header className="settings-header">
                    <div>
                        <p className="settings-eyebrow">PREFERENCES & ACCOUNT</p>
                        <h1>Settings</h1>
                        <p>Manage your profile and keep your account secure.</p>
                    </div>
                    <button
                        className="settings-dashboard-button"
                        type="button"
                        onClick={() => navigate("/dashboard")}
                    >
                        Dashboard <span aria-hidden="true">↗</span>
                    </button>
                </header>

                <div className="settings-content">
                    {activeTab === "profile" && (
                        <section className="settings-card">
                            <div className="settings-card-heading">
                                <div>
                                    <h2>Profile information</h2>
                                    <p>Update the information shown on your CodeCollab account.</p>
                                </div>
                                <span className="settings-heading-icon">◉</span>
                            </div>

                            <div className="settings-profile-preview">
                                <div className="settings-avatar-large">
                                    {avatar.trim() ? (
                                        <img src={avatar} alt="Profile preview" />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <div>
                                    <strong>{name || "Your name"}</strong>
                                    <span>{user?.email}</span>
                                </div>
                            </div>

                            <form onSubmit={saveProfile} className="settings-form">
                                <label htmlFor="settings-name">Full name</label>
                                <input
                                    id="settings-name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    maxLength={50}
                                    minLength={2}
                                    required
                                    placeholder="Enter your name"
                                />

                                <label htmlFor="settings-avatar">Avatar image URL <span>(optional)</span></label>
                                <input
                                    id="settings-avatar"
                                    type="url"
                                    value={avatar}
                                    onChange={(event) => setAvatar(event.target.value)}
                                    placeholder="https://example.com/photo.jpg"
                                />
                                <small className="settings-help">
                                    Use a publicly accessible image URL. Leave blank to use your initials.
                                </small>

                                {profileError && <div className="settings-alert error">{profileError}</div>}
                                {profileMessage && <div className="settings-alert success">{profileMessage}</div>}

                                <div className="settings-form-actions">
                                    <button
                                        type="button"
                                        className="settings-secondary-button"
                                        onClick={() => {
                                            setName(user?.name ?? "");
                                            setAvatar(user?.avatar ?? "");
                                            setProfileError("");
                                            setProfileMessage("");
                                        }}
                                    >
                                        Reset
                                    </button>
                                    <button type="submit" className="settings-primary-button" disabled={profileLoading}>
                                        {profileLoading ? "Saving..." : "Save changes"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {activeTab === "account" && (
                        <section className="settings-card">
                            <div className="settings-card-heading">
                                <div>
                                    <h2>Account details</h2>
                                    <p>View the basic information associated with your account.</p>
                                </div>
                                <span className="settings-heading-icon">▣</span>
                            </div>

                            <div className="settings-account-banner">
                                <div className="settings-avatar-large">
                                    {user?.avatar ? <img src={user.avatar} alt="" /> : initials}
                                </div>
                                <div>
                                    <strong>{user?.name}</strong>
                                    <span>{user?.role || "User"} account</span>
                                </div>
                                <span className="settings-account-status"><i /> Active</span>
                            </div>

                            <div className="settings-details-list">
                                <div className="settings-detail-row">
                                    <div><span>Email address</span><strong>{user?.email || "Not available"}</strong></div>
                                    <span className="settings-readonly">Read only</span>
                                </div>
                                <div className="settings-detail-row">
                                    <div><span>Account role</span><strong className="capitalize">{user?.role || "Not available"}</strong></div>
                                    <span className="settings-readonly">System assigned</span>
                                </div>
                                <div className="settings-detail-row">
                                    <div><span>Member since</span><strong>{createdAt}</strong></div>
                                    <span className="settings-readonly">Account info</span>
                                </div>
                                <div className="settings-detail-row">
                                    <div><span>User ID</span><strong className="settings-user-id">{user?.id || "Not available"}</strong></div>
                                    <span className="settings-readonly">Unique ID</span>
                                </div>
                            </div>
                            <div className="settings-info-note">
                                Email and role are read-only in this version of CodeCollab.
                            </div>
                        </section>
                    )}

                    {activeTab === "security" && (
                        <section className="settings-card">
                            <div className="settings-card-heading">
                                <div>
                                    <h2>Password & security</h2>
                                    <p>Change your password to help protect your account.</p>
                                </div>
                                <span className="settings-heading-icon">◇</span>
                            </div>

                            <div className="settings-security-note">
                                <span aria-hidden="true">ⓘ</span>
                                After changing your password, you will be logged out and asked to sign in again.
                            </div>

                            <form onSubmit={changePassword} className="settings-form">
                                <label htmlFor="current-password">Current password</label>
                                <input
                                    id="current-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    required
                                />

                                <label htmlFor="new-password">New password</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    required
                                />
                                <small className="settings-help">Use at least 6 characters.</small>

                                <label htmlFor="confirm-password">Confirm new password</label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                />

                                {passwordError && <div className="settings-alert error">{passwordError}</div>}
                                {passwordMessage && <div className="settings-alert success">{passwordMessage}</div>}

                                <div className="settings-form-actions">
                                    <button
                                        type="button"
                                        className="settings-secondary-button"
                                        onClick={() => {
                                            setCurrentPassword("");
                                            setNewPassword("");
                                            setConfirmPassword("");
                                            setPasswordError("");
                                            setPasswordMessage("");
                                        }}
                                    >
                                        Clear
                                    </button>
                                    <button type="submit" className="settings-primary-button" disabled={passwordLoading}>
                                        {passwordLoading ? "Updating..." : "Update password"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Settings;
