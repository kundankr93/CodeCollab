import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

const Dashboard = () => {
    const navigate = useNavigate();

    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="dashboard">

            {/* SIDEBAR */}

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

                    <button className="nav-item active">
                        <span>⌂</span>
                        Dashboard
                    </button>

                    <button className="nav-item">
                        <span>💻</span>
                        Coding Rooms
                    </button>

                    <button className="nav-item">
                        <span>🎯</span>
                        Interviews
                    </button>

                    <button className="nav-item">
                        <span>🧩</span>
                        Problems
                    </button>

                    <button className="nav-item">
                        <span>⚙</span>
                        Settings
                    </button>

                </nav>


                <div className="sidebar-bottom">

                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        <span>↪</span>
                        Logout
                    </button>

                </div>

            </aside>


            {/* MAIN CONTENT */}

            <main className="dashboard-main">

                {/* TOPBAR */}

                <header className="topbar">

                    <div className="search-box">

                        <span>⌕</span>

                        <input
                            type="text"
                            placeholder="Search rooms, problems..."
                        />

                    </div>


                    <div className="user-section">

                        <div className="notification">
                            🔔
                        </div>

                        <div className="user-info">

                            <div className="user-avatar">
                                {user?.name?.charAt(0).toUpperCase()}
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

                            <p className="welcome-small">
                                Welcome back 👋
                            </p>

                            <h1>
                                {user?.name}
                            </h1>

                            <p className="welcome-description">
                                Ready to build something amazing?
                            </p>

                        </div>


                        <button
                            className="primary-button"
                            onClick={() => navigate("/rooms")}
                        >
                            + Create Coding Room
                        </button>

                    </div>


                    {/* STATS */}

                    <div className="stats-grid">

                        <div className="stat-card">

                            <div className="stat-icon">
                                💻
                            </div>

                            <div>

                                <p>
                                    Coding Rooms
                                </p>

                                <h2>
                                    0
                                </h2>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon">
                                🎯
                            </div>

                            <div>

                                <p>
                                    Interviews
                                </p>

                                <h2>
                                    0
                                </h2>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon">
                                🧩
                            </div>

                            <div>

                                <p>
                                    Problems Solved
                                </p>

                                <h2>
                                    0
                                </h2>

                            </div>

                        </div>


                        <div className="stat-card">

                            <div className="stat-icon">
                                ⭐
                            </div>

                            <div>

                                <p>
                                    Sessions
                                </p>

                                <h2>
                                    0
                                </h2>

                            </div>

                        </div>

                    </div>


                    {/* QUICK ACTIONS */}

                    <div className="section-header">

                        <div>

                            <h2>
                                Quick Actions
                            </h2>

                            <p>
                                Start coding in seconds
                            </p>

                        </div>

                    </div>


                    <div className="quick-actions">

                        <button
                            className="action-card"
                            onClick={() => navigate("/rooms")}
                        >

                            <div className="action-icon">
                                ⚡
                            </div>

                            <div>

                                <h3>
                                    Create Room
                                </h3>

                                <p>
                                    Start a collaborative coding session
                                </p>

                            </div>

                        </button>


                        <button
                            className="action-card"
                        >

                            <div className="action-icon">
                                🎯
                            </div>

                            <div>

                                <h3>
                                    Start Interview
                                </h3>

                                <p>
                                    Conduct a coding interview
                                </p>

                            </div>

                        </button>


                        <button
                            className="action-card"
                        >

                            <div className="action-icon">
                                🧩
                            </div>

                            <div>

                                <h3>
                                    Practice Problems
                                </h3>

                                <p>
                                    Improve your coding skills
                                </p>

                            </div>

                        </button>

                    </div>


                    {/* RECENT ROOMS */}

                    <div className="section-header recent-header">

                        <div>

                            <h2>
                                Recent Coding Rooms
                            </h2>

                            <p>
                                Your latest collaborative sessions
                            </p>

                        </div>

                        <button className="view-all">
                            View all →
                        </button>

                    </div>


                    <div className="empty-state">

                        <div className="empty-icon">
                            💻
                        </div>

                        <h3>
                            No coding rooms yet
                        </h3>

                        <p>
                            Create your first collaborative coding room
                            and start building together.
                        </p>

                        <button
                            className="primary-button"
                            onClick={() => navigate("/rooms")}
                        >
                            Create Your First Room
                        </button>

                    </div>

                </section>

            </main>

        </div>
    );
};

export default Dashboard;