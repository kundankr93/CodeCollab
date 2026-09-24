import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

interface Room {
    _id: string;
    roomId: string;
    name: string;
    language: string;
    status: "waiting" | "active" | "completed";
    createdAt: string;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [roomError, setRoomError] = useState("");

    // =========================
    // FETCH ROOMS
    // =========================

    const fetchRooms = async () => {
        try {
            setLoadingRooms(true);
            setRoomError("");

            const response = await api.get("/rooms");

            setRooms(response.data.rooms || []);
        } catch (error: any) {
            setRoomError(
                error.response?.data?.message ||
                "Failed to load coding rooms"
            );
        } finally {
            setLoadingRooms(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    // =========================
    // LOGOUT
    // =========================

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    // =========================
    // JOIN / OPEN ROOM
    // =========================

    const handleOpenRoom = async (
        roomId: string
    ) => {
        try {
            await api.post(
                `/rooms/${roomId}/join`
            );

            navigate(`/rooms/${roomId}`);
        } catch (error: any) {
            setRoomError(
                error.response?.data?.message ||
                "Failed to open room"
            );
        }
    };

    // =========================
    // STATISTICS
    // =========================

    const totalRooms = rooms.length;

    const activeRooms = rooms.filter(
        (room) =>
            room.status === "active"
    ).length;

    const waitingRooms = rooms.filter(
        (room) =>
            room.status === "waiting"
    ).length;

    const completedRooms = rooms.filter(
        (room) =>
            room.status === "completed"
    ).length;

    // Show latest 5 rooms
    const recentRooms = [...rooms]
        .sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        )
        .slice(0, 5);

    // =========================
    // LANGUAGE FORMATTER
    // =========================

    const getLanguageName = (
        language: string
    ) => {
        switch (language) {
            case "cpp":
                return "C++";

            case "javascript":
                return "JavaScript";

            case "python":
                return "Python";

            case "java":
                return "Java";

            default:
                return language;
        }
    };

    // =========================
    // ICONS
    // =========================

    const DashboardIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1"
            />
            <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1"
            />
            <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1"
            />
            <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1"
            />
        </svg>
    );

    const CodeIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <polyline points="8 9 4 12 8 15" />
            <polyline points="16 9 20 12 16 15" />
            <line
                x1="14"
                y1="6"
                x2="10"
                y2="18"
            />
        </svg>
    );

    const InterviewIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <circle
                cx="12"
                cy="12"
                r="8"
            />
            <circle
                cx="12"
                cy="12"
                r="3"
            />
            <line
                x1="12"
                y1="2"
                x2="12"
                y2="5"
            />
            <line
                x1="12"
                y1="19"
                x2="12"
                y2="22"
            />
        </svg>
    );

    const ProblemIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <path d="M12 3l2.3 4.7L19 10l-4.7 2.3L12 17l-2.3-4.7L5 10l4.7-2.3L12 3z" />
            <path d="M19 16l.8 1.7L21.5 18l-1.7.8L19 20.5l-.8-1.7-1.7-.8 1.7-.8L19 16z" />
        </svg>
    );

    const SettingsIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <circle
                cx="12"
                cy="12"
                r="3"
            />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4.3v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4.3h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V13h-.2a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
    );

    const LogoutIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M21 3v18" />
        </svg>
    );

    const BellIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
        </svg>
    );

    const ArrowIcon = () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
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

    // =========================
    // UI
    // =========================

    return (
        <div className="dashboard">

            {/* =========================
                SIDEBAR
            ========================= */}

            <aside className="sidebar">

                <div className="logo">
                    <div className="logo-icon">
                        &lt;/&gt;
                    </div>

                    <span>
                        CodeCollab
                    </span>
                </div>


                <nav className="sidebar-nav">

                    <button
                        className="nav-item active"
                    >
                        <DashboardIcon />

                        <span>
                            Dashboard
                        </span>
                    </button>


                    <button
                        className="nav-item"
                        onClick={() =>
                            navigate("/rooms")
                        }
                    >
                        <CodeIcon />

                        <span>
                            Coding Rooms
                        </span>
                    </button>


                    <button
                        className="nav-item"
                        disabled
                    >
                        <InterviewIcon />

                        <span>
                            Interviews
                        </span>

                        <small>
                            Soon
                        </small>
                    </button>


                    <button
                        className="nav-item"
                        disabled
                    >
                        <ProblemIcon />

                        <span>
                            Problems
                        </span>

                        <small>
                            Soon
                        </small>
                    </button>


                    <button
                        className="nav-item"
                        disabled
                    >
                        <SettingsIcon />

                        <span>
                            Settings
                        </span>

                        <small>
                            Soon
                        </small>
                    </button>

                </nav>


                <div className="sidebar-bottom">

                    <div className="sidebar-user">

                        <div className="sidebar-avatar">
                            {user?.name
                                ?.charAt(0)
                                .toUpperCase()}
                        </div>

                        <div>
                            <p>
                                {user?.name}
                            </p>

                            <span>
                                {user?.role}
                            </span>
                        </div>

                    </div>


                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        <LogoutIcon />

                        <span>
                            Logout
                        </span>
                    </button>

                </div>

            </aside>


            {/* =========================
                MAIN
            ========================= */}

            <main className="dashboard-main">

                {/* TOPBAR */}

                <header className="topbar">

                    <div className="topbar-left">

                        <span className="breadcrumb">
                            Dashboard
                        </span>

                    </div>


                    <div className="topbar-right">

                        <div className="search-box">

                            <span>
                                ⌕
                            </span>

                            <input
                                type="text"
                                placeholder="Search rooms, problems..."
                            />

                        </div>


                        <button className="notification">
                            <BellIcon />
                        </button>


                        <div className="topbar-user">

                            <div className="user-avatar">
                                {user?.name
                                    ?.charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div>
                                <p className="user-name">
                                    {user?.name}
                                </p>

                                <p className="user-role">
                                    {user?.role}
                                </p>
                            </div>

                        </div>

                    </div>

                </header>


                {/* CONTENT */}

                <section className="dashboard-content">

                    {/* WELCOME */}

                    <div className="welcome-section">

                        <div>

                            <div className="welcome-small">
                                <span className="status-dot" />

                                Welcome back 👋
                            </div>


                            <h1>
                                {user?.name}
                            </h1>


                            <p className="welcome-description">
                                Ready to build something amazing?
                            </p>

                        </div>


                        <button
                            className="primary-button"
                            onClick={() =>
                                navigate("/rooms")
                            }
                        >
                            <span>
                                +
                            </span>

                            Create Coding Room
                        </button>

                    </div>


                    {/* ERROR */}

                    {roomError && (
                        <div className="dashboard-error">
                            {roomError}
                        </div>
                    )}


                    {/* =========================
                        STATS
                    ========================= */}

                    <div className="stats-grid">

                        <div className="stat-card">

                            <div className="stat-icon purple">
                                <CodeIcon />
                            </div>

                            <div className="stat-info">

                                <span>
                                    Total Rooms
                                </span>

                                <strong>
                                    {loadingRooms
                                        ? "—"
                                        : totalRooms}
                                </strong>

                                <small>
                                    Your coding rooms
                                </small>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon green">
                                <span>
                                    ●
                                </span>
                            </div>

                            <div className="stat-info">

                                <span>
                                    Active Sessions
                                </span>

                                <strong>
                                    {loadingRooms
                                        ? "—"
                                        : activeRooms}
                                </strong>

                                <small>
                                    Currently active
                                </small>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon blue">
                                <span>
                                    ◷
                                </span>
                            </div>

                            <div className="stat-info">

                                <span>
                                    Waiting Rooms
                                </span>

                                <strong>
                                    {loadingRooms
                                        ? "—"
                                        : waitingRooms}
                                </strong>

                                <small>
                                    Waiting for participants
                                </small>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon orange">
                                <span>
                                    ✓
                                </span>
                            </div>

                            <div className="stat-info">

                                <span>
                                    Completed
                                </span>

                                <strong>
                                    {loadingRooms
                                        ? "—"
                                        : completedRooms}
                                </strong>

                                <small>
                                    Finished sessions
                                </small>

                            </div>

                        </div>

                    </div>


                    {/* =========================
                        QUICK ACTIONS
                    ========================= */}

                    <div className="section-header">

                        <div>
                            <h2>
                                Quick Actions
                            </h2>

                            <p>
                                Jump into your workflow
                            </p>
                        </div>

                    </div>


                    <div className="quick-actions">

                        {/* CREATE ROOM */}

                        <button
                            className="quick-action-card"
                            onClick={() =>
                                navigate("/rooms")
                            }
                        >

                            <div className="quick-action-icon purple">
                                <CodeIcon />
                            </div>

                            <div className="quick-action-content">

                                <h3>
                                    Create Room
                                </h3>

                                <p>
                                    Start a collaborative coding session with your team.
                                </p>

                                <span>
                                    Start coding
                                    <ArrowIcon />
                                </span>

                            </div>

                        </button>


                        {/* INTERVIEW */}

                        <div className="quick-action-card disabled">

                            <div className="quick-action-icon violet">
                                <InterviewIcon />
                            </div>

                            <div className="quick-action-content">

                                <h3>
                                    Start Interview

                                    <small>
                                        SOON
                                    </small>
                                </h3>

                                <p>
                                    Conduct structured technical interviews with candidates.
                                </p>

                                <span>
                                    Coming soon
                                </span>

                            </div>

                        </div>


                        {/* PROBLEMS */}

                        <div className="quick-action-card disabled">

                            <div className="quick-action-icon teal">
                                <ProblemIcon />
                            </div>

                            <div className="quick-action-content">

                                <h3>
                                    Practice Problems

                                    <small>
                                        SOON
                                    </small>
                                </h3>

                                <p>
                                    Improve your problem solving skills with coding challenges.
                                </p>

                                <span>
                                    Coming soon
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* =========================
                        RECENT ROOMS
                    ========================= */}

                    <div className="section-header recent-header">

                        <div>

                            <h2>
                                Recent Coding Rooms
                            </h2>

                            <p>
                                Your latest collaborative sessions
                            </p>

                        </div>


                        {rooms.length > 0 && (
                            <button
                                className="view-all"
                                onClick={() =>
                                    navigate("/rooms")
                                }
                            >
                                View all

                                <ArrowIcon />
                            </button>
                        )}

                    </div>


                    {/* LOADING */}

                    {loadingRooms ? (

                        <div className="rooms-dashboard-state">

                            <div className="state-spinner" />

                            <h3>
                                Loading your rooms...
                            </h3>

                            <p>
                                Fetching your latest coding sessions.
                            </p>

                        </div>

                    ) : recentRooms.length === 0 ? (

                        /* EMPTY STATE */

                        <div className="empty-state">

                            <div className="empty-icon">
                                &lt;/&gt;
                            </div>

                            <h3>
                                No coding rooms yet
                            </h3>

                            <p>
                                Create your first collaborative coding room and start building together.
                            </p>

                            <button
                                className="primary-button"
                                onClick={() =>
                                    navigate("/rooms")
                                }
                            >
                                <span>
                                    +
                                </span>

                                Create Your First Room
                            </button>

                        </div>

                    ) : (

                        /* ROOM LIST */

                        <div className="dashboard-rooms">

                            {recentRooms.map(
                                (room) => (

                                    <div
                                        className="dashboard-room-card"
                                        key={room._id}
                                    >

                                        <div className="dashboard-room-main">

                                            <div className="dashboard-room-language">
                                                {getLanguageName(
                                                    room.language
                                                )}
                                            </div>


                                            <h3>
                                                {room.name}
                                            </h3>


                                            <p>
                                                Room ID:{" "}
                                                {room.roomId}
                                            </p>

                                        </div>


                                        <div className="dashboard-room-right">

                                            <span
                                                className={`room-status ${room.status}`}
                                            >
                                                {room.status}
                                            </span>


                                            <button
                                                className="dashboard-open-room"
                                                onClick={() =>
                                                    handleOpenRoom(
                                                        room.roomId
                                                    )
                                                }
                                            >
                                                Open Room

                                                <ArrowIcon />
                                            </button>

                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                    )}

                </section>

            </main>

        </div>
    );
};

export default Dashboard;