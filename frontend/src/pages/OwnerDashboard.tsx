import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface OwnerUser {
    id: string;
    name: string;
    email: string;
    role:
        | "student"
        | "interviewer"
        | "admin"
        | "owner";
    createdAt?: string;
}

type EditableRole =
    | "student"
    | "interviewer"
    | "admin";

interface RoomOwner {
    id: string;
    name: string;
    email: string;
}

interface RoomParticipant {
    id: string;
    name: string;
    email: string;
}

interface OwnerRoom {
    id: string;
    roomId: string;
    name: string;
    language: string;
    status: string;
    owner: RoomOwner | null;
    participants: RoomParticipant[];
    participantCount: number;
    createdAt?: string;
    updatedAt?: string;
}

interface RoomPresence {
    roomId: string;
    onlineParticipantCount: number;
}

const socketUrl = "http://https://codecollab-backend-se0p.onrender.com";

const OwnerDashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [users, setUsers] = useState<OwnerUser[]>([]);
    const [rooms, setRooms] = useState<OwnerRoom[]>([]);
    const [onlineCounts, setOnlineCounts] =
        useState<Record<string, number>>({});

    const [loadingUsers, setLoadingUsers] =
        useState(true);
    const [loadingRooms, setLoadingRooms] =
        useState(true);
    const [actionUserId, setActionUserId] =
        useState<string | null>(null);
    const [actionRoomId, setActionRoomId] =
        useState<string | null>(null);
    const [error, setError] = useState("");
    const [socketConnected, setSocketConnected] =
        useState(false);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const loadUsers = async () => {
        try {
            setLoadingUsers(true);
            setError("");

            const response =
                await api.get("/owner/users");

            setUsers(
                Array.isArray(response.data.users)
                    ? response.data.users
                    : []
            );
        } catch (requestError: any) {
            console.error(
                "Failed to load users:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    "Failed to load users."
            );
        } finally {
            setLoadingUsers(false);
        }
    };

    const loadRooms = async () => {
        try {
            setLoadingRooms(true);
            setError("");

            const response =
                await api.get("/owner/rooms");

            setRooms(
                Array.isArray(response.data.rooms)
                    ? response.data.rooms
                    : []
            );
        } catch (requestError: any) {
            console.error(
                "Failed to load rooms:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    "Failed to load rooms."
            );
        } finally {
            setLoadingRooms(false);
        }
    };

    useEffect(() => {
        loadUsers();
        loadRooms();
    }, []);

    /*
     * ==========================================
     * LIVE ROOM PRESENCE
     * ==========================================
     */

    useEffect(() => {
        const accessToken =
            localStorage.getItem(
                "accessToken"
            );

        if (
            !accessToken ||
            user?.role !== "owner"
        ) {
            return;
        }

        const ownerSocket = io(socketUrl, {
            auth: {
                accessToken,
            },
        });

        ownerSocket.on("connect", () => {
            setSocketConnected(true);

            ownerSocket.emit(
                "owner-monitor"
            );
        });

        ownerSocket.on(
            "disconnect",
            () => {
                setSocketConnected(false);
            }
        );

        ownerSocket.on(
            "owner-room-presence",
            (
                presence: RoomPresence[]
            ) => {
                const nextCounts:
                    Record<string, number> = {};

                if (Array.isArray(presence)) {
                    for (const item of presence) {
                        if (!item?.roomId) {
                            continue;
                        }

                        nextCounts[
                            item.roomId
                        ] =
                            Number(
                                item.onlineParticipantCount
                            ) || 0;
                    }
                }

                setOnlineCounts(nextCounts);
            }
        );

        ownerSocket.on(
            "connect_error",
            (socketError) => {
                console.error(
                    "Owner monitor socket error:",
                    socketError
                );

                setSocketConnected(false);
            }
        );

        return () => {
            ownerSocket.removeAllListeners();
            ownerSocket.disconnect();
            setSocketConnected(false);
        };
    }, [user?.role]);

    /*
     * ==========================================
     * USER MANAGEMENT
     * ==========================================
     */

    const handleRoleChange = async (
        targetUser: OwnerUser,
        role: EditableRole
    ) => {
        if (
            targetUser.role === "owner"
        ) {
            return;
        }

        try {
            setActionUserId(
                targetUser.id
            );
            setError("");

            const response =
                await api.patch(
                    `/owner/users/${targetUser.id}/role`,
                    { role }
                );

            const updatedUser =
                response.data.user;

            setUsers(
                (currentUsers) =>
                    currentUsers.map(
                        (item) =>
                            item.id ===
                            targetUser.id
                                ? {
                                    ...item,
                                    role:
                                        updatedUser?.role ||
                                        role,
                                }
                                : item
                    )
            );
        } catch (requestError: any) {
            console.error(
                "Failed to update role:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    "Failed to update user role."
            );
        } finally {
            setActionUserId(null);
        }
    };

    const handleDeleteUser = async (
        targetUser: OwnerUser
    ) => {
        if (
            targetUser.role === "owner"
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                `Delete user "${targetUser.name}"? This action cannot be undone.`
            );

        if (!confirmed) {
            return;
        }

        try {
            setActionUserId(
                targetUser.id
            );
            setError("");

            await api.delete(
                `/owner/users/${targetUser.id}`
            );

            setUsers(
                (currentUsers) =>
                    currentUsers.filter(
                        (item) =>
                            item.id !==
                            targetUser.id
                    )
            );
        } catch (requestError: any) {
            console.error(
                "Failed to delete user:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    "Failed to delete user."
            );
        } finally {
            setActionUserId(null);
        }
    };

    /*
     * ==========================================
     * ROOM MANAGEMENT
     * ==========================================
     */

    const handleRoomStatusChange =
        async (
            room: OwnerRoom,
            status:
                | "waiting"
                | "active"
                | "completed"
        ) => {
            if (
                room.status === status
            ) {
                return;
            }

            try {
                setActionRoomId(
                    room.roomId
                );
                setError("");

                const response =
                    await api.patch(
                        `/owner/rooms/${room.roomId}/status`,
                        { status }
                    );

                const updatedStatus =
                    response.data.room
                        ?.status || status;

                setRooms(
                    (currentRooms) =>
                        currentRooms.map(
                            (item) =>
                                item.roomId ===
                                room.roomId
                                    ? {
                                        ...item,
                                        status:
                                            updatedStatus,
                                    }
                                    : item
                        )
                );
            } catch (requestError: any) {
                console.error(
                    "Failed to update room status:",
                    requestError
                );

                setError(
                    requestError.response?.data
                        ?.message ||
                        "Failed to update room status."
                );
            } finally {
                setActionRoomId(null);
            }
        };

    const handleDeleteRoom = async (
        room: OwnerRoom
    ) => {
        const confirmed =
            window.confirm(
                `Delete room "${room.name}" (${room.roomId})? This action cannot be undone.`
            );

        if (!confirmed) {
            return;
        }

        try {
            setActionRoomId(
                room.roomId
            );
            setError("");

            await api.delete(
                `/owner/rooms/${room.roomId}`
            );

            setRooms(
                (currentRooms) =>
                    currentRooms.filter(
                        (item) =>
                            item.roomId !==
                            room.roomId
                    )
            );

            setOnlineCounts(
                (currentCounts) => {
                    const nextCounts = {
                        ...currentCounts,
                    };

                    delete nextCounts[
                        room.roomId
                    ];

                    return nextCounts;
                }
            );
        } catch (requestError: any) {
            console.error(
                "Failed to delete room:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    "Failed to delete room."
            );
        } finally {
            setActionRoomId(null);
        }
    };

    /*
     * ==========================================
     * ANALYTICS
     * ==========================================
     */

    const totalUsers = users.length;

    const students =
        users.filter(
            (item) =>
                item.role === "student"
        ).length;

    const interviewers =
        users.filter(
            (item) =>
                item.role === "interviewer"
        ).length;

    const admins =
        users.filter(
            (item) =>
                item.role === "admin"
        ).length;

    const owners =
        users.filter(
            (item) =>
                item.role === "owner"
        ).length;

    const totalRooms = rooms.length;

    const activeRooms =
        rooms.filter(
            (room) =>
                room.status === "active"
        ).length;

    const waitingRooms =
        rooms.filter(
            (room) =>
                room.status === "waiting"
        ).length;

    const completedRooms =
        rooms.filter(
            (room) =>
                room.status === "completed"
        ).length;

    const onlineUsersInRooms =
        useMemo(
            () =>
                Object.values(
                    onlineCounts
                ).reduce(
                    (
                        total,
                        count
                    ) =>
                        total +
                        count,
                    0
                ),
            [onlineCounts]
        );

    const userRoleData = [
        {
            label: "Students",
            value: students,
            icon: "🎓",
        },
        {
            label: "Interviewers",
            value: interviewers,
            icon: "🧑‍💻",
        },
        {
            label: "Admins",
            value: admins,
            icon: "🛡️",
        },
        {
            label: "Owners",
            value: owners,
            icon: "👑",
        },
    ];

    const roomStatusData = [
        {
            label: "Active",
            value: activeRooms,
            icon: "🟢",
        },
        {
            label: "Waiting",
            value: waitingRooms,
            icon: "🟡",
        },
        {
            label: "Completed",
            value: completedRooms,
            icon: "✅",
        },
    ];

    const languageData = useMemo(() => {
        const counts: Record<
            string,
            number
        > = {};

        for (const room of rooms) {
            const language =
                String(
                    room.language ||
                        "unknown"
                ).toLowerCase();

            counts[language] =
                (counts[language] ||
                    0) + 1;
        }

        return Object.entries(
            counts
        )
            .map(
                ([
                    language,
                    value,
                ]) => ({
                    language,
                    value,
                })
            )
            .sort(
                (a, b) =>
                    b.value -
                    a.value
            );
    }, [rooms]);

    const maxUserRoleValue =
        Math.max(
            1,
            ...userRoleData.map(
                (item) =>
                    item.value
            )
        );

    const maxRoomStatusValue =
        Math.max(
            1,
            ...roomStatusData.map(
                (item) =>
                    item.value
            )
        );

    const maxLanguageValue =
        Math.max(
            1,
            ...languageData.map(
                (item) =>
                    item.value
            )
        );

    const recentRooms =
        useMemo(
            () =>
                [...rooms]
                    .sort(
                        (a, b) =>
                            new Date(
                                b.createdAt ||
                                    0
                            ).getTime() -
                            new Date(
                                a.createdAt ||
                                    0
                            ).getTime()
                    )
                    .slice(0, 5),
            [rooms]
        );

    const formatDate = (
        value?: string
    ) => {
        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    const cardStyle:
        CSSProperties = {
        background:
            "#111321",
        border:
            "1px solid #25283a",
        borderRadius: "14px",
        padding: "20px",
    };

    const smallButtonStyle:
        CSSProperties = {
        background:
            "#1a1d2e",
        color: "#ffffff",
        border:
            "1px solid #34384f",
        borderRadius: "8px",
        padding:
            "8px 12px",
        cursor: "pointer",
    };

    return (
        <div
            style={{
                minHeight:
                    "100vh",
                background:
                    "#080914",
                color:
                    "#ffffff",
                padding:
                    "32px",
                boxSizing:
                    "border-box",
            }}
        >
            <div
                style={{
                    maxWidth:
                        "1250px",
                    margin:
                        "0 auto",
                }}
            >
                {/* HEADER */}
                <div
                    style={{
                        display:
                            "flex",
                        justifyContent:
                            "space-between",
                        alignItems:
                            "center",
                        gap: "20px",
                        marginBottom:
                            "28px",
                        flexWrap:
                            "wrap",
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontSize:
                                    "32px",
                            }}
                        >
                            Owner Dashboard 👑
                        </h1>

                        <p
                            style={{
                                margin:
                                    "8px 0 0",
                                color:
                                    "#9ca3af",
                            }}
                        >
                            Manage users,
                            rooms and
                            monitor
                            CodeCollab.
                        </p>
                    </div>

                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            gap: "12px",
                        }}
                    >
                        <span
                            style={{
                                fontSize:
                                    "13px",
                                color:
                                    socketConnected
                                        ? "#86efac"
                                        : "#9ca3af",
                                background:
                                    "#111321",
                                border:
                                    "1px solid #25283a",
                                padding:
                                    "8px 12px",
                                borderRadius:
                                    "999px",
                            }}
                        >
                            {socketConnected
                                ? "● Live monitoring"
                                : "○ Monitoring offline"}
                        </span>

                        <button
                            onClick={
                                handleLogout
                            }
                            style={{
                                padding:
                                    "10px 18px",
                                borderRadius:
                                    "8px",
                                border:
                                    "none",
                                cursor:
                                    "pointer",
                                background:
                                    "#ef4444",
                                color:
                                    "#ffffff",
                                fontWeight:
                                    600,
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {error && (
                    <div
                        style={{
                            background:
                                "#2a1418",
                            border:
                                "1px solid #7f1d1d",
                            color:
                                "#fca5a5",
                            padding:
                                "14px 16px",
                            borderRadius:
                                "10px",
                            marginBottom:
                                "20px",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* OWNER INFORMATION */}
                <div
                    style={{
                        ...cardStyle,
                        marginBottom:
                            "22px",
                    }}
                >
                    <h2
                        style={{
                            marginTop: 0,
                        }}
                    >
                        Owner Information
                    </h2>

                    <div
                        style={{
                            display:
                                "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "16px",
                        }}
                    >
                        <InfoItem
                            label="Name"
                            value={
                                user?.name ||
                                "—"
                            }
                        />

                        <InfoItem
                            label="Email"
                            value={
                                user?.email ||
                                "—"
                            }
                        />

                        <InfoItem
                            label="Role"
                            value={
                                user?.role ||
                                "—"
                            }
                        />
                    </div>
                </div>

                {/* KPI CARDS */}
                <h2
                    style={{
                        marginBottom:
                            "14px",
                    }}
                >
                    Overview
                </h2>

                <div
                    style={{
                        display:
                            "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: "16px",
                        marginBottom:
                            "28px",
                    }}
                >
                    <StatCard
                        icon="👥"
                        label="Total Users"
                        value={
                            loadingUsers
                                ? "—"
                                : totalUsers
                        }
                    />

                    <StatCard
                        icon="🟢"
                        label="Online Participants"
                        value={
                            onlineUsersInRooms
                        }
                    />

                    <StatCard
                        icon="💻"
                        label="Total Rooms"
                        value={
                            loadingRooms
                                ? "—"
                                : totalRooms
                        }
                    />

                    <StatCard
                        icon="⚡"
                        label="Active Rooms"
                        value={
                            loadingRooms
                                ? "—"
                                : activeRooms
                        }
                    />

                    <StatCard
                        icon="⏳"
                        label="Waiting Rooms"
                        value={
                            loadingRooms
                                ? "—"
                                : waitingRooms
                        }
                    />
                </div>

                {/* ANALYTICS GRID */}
                <div
                    style={{
                        display:
                            "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "18px",
                        marginBottom:
                            "28px",
                    }}
                >
                    {/* USER DISTRIBUTION */}
                    <div
                        style={
                            cardStyle
                        }
                    >
                        <h2
                            style={{
                                marginTop:
                                    0,
                            }}
                        >
                            User Distribution
                        </h2>

                        <p
                            style={{
                                color:
                                    "#9ca3af",
                                fontSize:
                                    "13px",
                                marginTop:
                                    "-6px",
                            }}
                        >
                            Current
                            registered
                            accounts by
                            role.
                        </p>

                        {userRoleData.map(
                            (item) => (
                                <BarRow
                                    key={
                                        item.label
                                    }
                                    icon={
                                        item.icon
                                    }
                                    label={
                                        item.label
                                    }
                                    value={
                                        item.value
                                    }
                                    max={
                                        maxUserRoleValue
                                    }
                                />
                            )
                        )}
                    </div>

                    {/* ROOM STATUS */}
                    <div
                        style={
                            cardStyle
                        }
                    >
                        <h2
                            style={{
                                marginTop:
                                    0,
                            }}
                        >
                            Room Status
                        </h2>

                        <p
                            style={{
                                color:
                                    "#9ca3af",
                                fontSize:
                                    "13px",
                                marginTop:
                                    "-6px",
                            }}
                        >
                            Current
                            coding-room
                            lifecycle
                            status.
                        </p>

                        {roomStatusData.map(
                            (item) => (
                                <BarRow
                                    key={
                                        item.label
                                    }
                                    icon={
                                        item.icon
                                    }
                                    label={
                                        item.label
                                    }
                                    value={
                                        item.value
                                    }
                                    max={
                                        maxRoomStatusValue
                                    }
                                />
                            )
                        )}

                        <div
                            style={{
                                marginTop:
                                    "18px",
                                paddingTop:
                                    "16px",
                                borderTop:
                                    "1px solid #25283a",
                                display:
                                    "flex",
                                justifyContent:
                                    "space-between",
                                color:
                                    "#9ca3af",
                            }}
                        >
                            <span>
                                Completed
                            </span>
                            <strong
                                style={{
                                    color:
                                        "#ffffff",
                                }}
                            >
                                {
                                    completedRooms
                                }
                            </strong>
                        </div>
                    </div>

                    {/* LANGUAGE USAGE */}
                    <div
                        style={
                            cardStyle
                        }
                    >
                        <h2
                            style={{
                                marginTop:
                                    0,
                            }}
                        >
                            Language Usage
                        </h2>

                        <p
                            style={{
                                color:
                                    "#9ca3af",
                                fontSize:
                                    "13px",
                                marginTop:
                                    "-6px",
                            }}
                        >
                            Languages
                            selected by
                            coding
                            rooms.
                        </p>

                        {languageData.length ===
                        0 ? (
                            <div
                                style={{
                                    color:
                                        "#6b7280",
                                    padding:
                                        "20px 0",
                                }}
                            >
                                No room
                                language
                                data yet.
                            </div>
                        ) : (
                            languageData.map(
                                (
                                    item
                                ) => (
                                    <BarRow
                                        key={
                                            item.language
                                        }
                                        icon="💻"
                                        label={
                                            item.language
                                        }
                                        value={
                                            item.value
                                        }
                                        max={
                                            maxLanguageValue
                                        }
                                    />
                                )
                            )
                        )}
                    </div>
                </div>

                {/* RECENT ROOMS */}
                <div
                    style={{
                        ...cardStyle,
                        marginBottom:
                            "28px",
                        overflowX:
                            "auto",
                    }}
                >
                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center",
                            marginBottom:
                                "16px",
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                }}
                            >
                                Recent Rooms
                            </h2>

                            <p
                                style={{
                                    color:
                                        "#9ca3af",
                                    marginBottom:
                                        0,
                                }}
                            >
                                Five most recently
                                created coding
                                rooms.
                            </p>
                        </div>

                        <button
                            onClick={
                                loadRooms
                            }
                            style={
                                smallButtonStyle
                            }
                        >
                            Refresh
                        </button>
                    </div>

                    {recentRooms.length ===
                    0 ? (
                        <div
                            style={{
                                color:
                                    "#6b7280",
                                padding:
                                    "20px 0",
                            }}
                        >
                            No coding
                            rooms found.
                        </div>
                    ) : (
                        <div
                            style={{
                                display:
                                    "grid",
                                gap: "10px",
                            }}
                        >
                            {recentRooms.map(
                                (
                                    room
                                ) => {
                                    const online =
                                        onlineCounts[
                                            room.roomId
                                        ] ??
                                        0;

                                    return (
                                        <div
                                            key={
                                                room.id ||
                                                room.roomId
                                            }
                                            style={{
                                                display:
                                                    "grid",
                                                gridTemplateColumns:
                                                    "minmax(180px, 1.5fr) repeat(4, minmax(100px, 1fr)) auto",
                                                gap: "14px",
                                                alignItems:
                                                    "center",
                                                minWidth:
                                                    "760px",
                                                padding:
                                                    "14px",
                                                border:
                                                    "1px solid #25283a",
                                                borderRadius:
                                                    "10px",
                                            }}
                                        >
                                            <div>
                                                <strong>
                                                    {
                                                        room.name
                                                    }
                                                </strong>

                                                <div
                                                    style={{
                                                        color:
                                                            "#6b7280",
                                                        fontSize:
                                                            "12px",
                                                        marginTop:
                                                            "4px",
                                                    }}
                                                >
                                                    {
                                                        room.roomId
                                                    }
                                                </div>
                                            </div>

                                            <span>
                                                {room.language}
                                            </span>

                                            <span>
                                                {room.status}
                                            </span>

                                            <span>
                                                {online}/
                                                {
                                                    room.participantCount
                                                } online
                                            </span>

                                            <span
                                                style={{
                                                    color:
                                                        "#9ca3af",
                                                }}
                                            >
                                                {
                                                    formatDate(
                                                        room.createdAt
                                                    )
                                                }
                                            </span>

                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/owner/rooms/${room.roomId}`
                                                    )
                                                }
                                                style={{
                                                    ...smallButtonStyle,
                                                    color:
                                                        "#c4b5fd",
                                                    border:
                                                        "1px solid #4c4680",
                                                    whiteSpace:
                                                        "nowrap",
                                                }}
                                            >
                                                View
                                            </button>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                {/* USER MANAGEMENT */}
                <div
                    style={{
                        ...cardStyle,
                        marginBottom:
                            "28px",
                        overflowX:
                            "auto",
                    }}
                >
                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center",
                            marginBottom:
                                "16px",
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                }}
                            >
                                User Management
                            </h2>

                            <p
                                style={{
                                    color:
                                        "#9ca3af",
                                    marginBottom:
                                        0,
                                }}
                            >
                                Change roles or
                                remove registered
                                users.
                            </p>
                        </div>

                        <button
                            onClick={
                                loadUsers
                            }
                            style={
                                smallButtonStyle
                            }
                        >
                            Refresh
                        </button>
                    </div>

                    <table
                        style={{
                            width:
                                "100%",
                            borderCollapse:
                                "collapse",
                            minWidth:
                                "760px",
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    color:
                                        "#9ca3af",
                                    textAlign:
                                        "left",
                                }}
                            >
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Name
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Email
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Role
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Created
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Manage
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loadingUsers ? (
                                <EmptyRow
                                    colSpan={
                                        5
                                    }
                                    text="Loading users..."
                                />
                            ) : users.length ===
                              0 ? (
                                <EmptyRow
                                    colSpan={
                                        5
                                    }
                                    text="No users found."
                                />
                            ) : (
                                users.map(
                                    (
                                        targetUser
                                    ) => {
                                        const isOwnerUser =
                                            targetUser.role ===
                                            "owner";

                                        const busy =
                                            actionUserId ===
                                            targetUser.id;

                                        return (
                                            <tr
                                                key={
                                                    targetUser.id
                                                }
                                                style={{
                                                    borderTop:
                                                        "1px solid #25283a",
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        fontWeight:
                                                            600,
                                                    }}
                                                >
                                                    {
                                                        targetUser.name
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        color:
                                                            "#cbd5e1",
                                                    }}
                                                >
                                                    {
                                                        targetUser.email
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    <select
                                                        value={
                                                            targetUser.role
                                                        }
                                                        disabled={
                                                            isOwnerUser ||
                                                            busy
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            handleRoleChange(
                                                                targetUser,
                                                                event
                                                                    .target
                                                                    .value as EditableRole
                                                            )
                                                        }
                                                        style={{
                                                            background:
                                                                "#080914",
                                                            color:
                                                                "#ffffff",
                                                            border:
                                                                "1px solid #34384f",
                                                            borderRadius:
                                                                "7px",
                                                            padding:
                                                                "7px 10px",
                                                        }}
                                                    >
                                                        <option value="student">
                                                            student
                                                        </option>
                                                        <option value="interviewer">
                                                            interviewer
                                                        </option>
                                                        <option value="admin">
                                                            admin
                                                        </option>

                                                        {isOwnerUser && (
                                                            <option value="owner">
                                                                owner
                                                            </option>
                                                        )}
                                                    </select>
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    {
                                                        formatDate(
                                                            targetUser.createdAt
                                                        )
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    <button
                                                        disabled={
                                                            isOwnerUser ||
                                                            busy
                                                        }
                                                        onClick={() =>
                                                            handleDeleteUser(
                                                                targetUser
                                                            )
                                                        }
                                                        style={{
                                                            background:
                                                                isOwnerUser
                                                                    ? "#25283a"
                                                                    : "#3a171b",
                                                            color:
                                                                isOwnerUser
                                                                    ? "#6b7280"
                                                                    : "#fca5a5",
                                                            border:
                                                                "1px solid #5b2028",
                                                            borderRadius:
                                                                "7px",
                                                            padding:
                                                                "7px 10px",
                                                            cursor:
                                                                isOwnerUser ||
                                                                busy
                                                                    ? "not-allowed"
                                                                    : "pointer",
                                                        }}
                                                    >
                                                        {busy
                                                            ? "Working..."
                                                            : "Delete"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ROOM MANAGEMENT */}
                <div
                    style={{
                        ...cardStyle,
                        overflowX:
                            "auto",
                    }}
                >
                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center",
                            marginBottom:
                                "16px",
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                }}
                            >
                                Room Monitoring
                            </h2>

                            <p
                                style={{
                                    color:
                                        "#9ca3af",
                                    marginBottom:
                                        0,
                                }}
                            >
                                Manage room status,
                                participants and
                                deletion.
                            </p>
                        </div>

                        <button
                            onClick={
                                loadRooms
                            }
                            style={
                                smallButtonStyle
                            }
                        >
                            Refresh
                        </button>
                    </div>

                    <table
                        style={{
                            width:
                                "100%",
                            borderCollapse:
                                "collapse",
                            minWidth:
                                "1050px",
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    color:
                                        "#9ca3af",
                                    textAlign:
                                        "left",
                                }}
                            >
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Room
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Room ID
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Owner
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Language
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Participants
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Status
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Created
                                </th>
                                <th
                                    style={{
                                        padding:
                                            "12px",
                                    }}
                                >
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loadingRooms ? (
                                <EmptyRow
                                    colSpan={
                                        8
                                    }
                                    text="Loading rooms..."
                                />
                            ) : rooms.length ===
                              0 ? (
                                <EmptyRow
                                    colSpan={
                                        8
                                    }
                                    text="No coding rooms found."
                                />
                            ) : (
                                rooms.map(
                                    (
                                        room
                                    ) => {
                                        const online =
                                            onlineCounts[
                                                room.roomId
                                            ] ??
                                            0;

                                        return (
                                            <tr
                                                key={
                                                    room.id ||
                                                    room.roomId
                                                }
                                                style={{
                                                    borderTop:
                                                        "1px solid #25283a",
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        fontWeight:
                                                            600,
                                                    }}
                                                >
                                                    {
                                                        room.name
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    {
                                                        room.roomId
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    {
                                                        room
                                                            .owner
                                                            ?.name ||
                                                        "—"
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    {
                                                        room.language
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    <strong>
                                                        {
                                                            online
                                                        }
                                                    </strong>

                                                    <span
                                                        style={{
                                                            color:
                                                                "#9ca3af",
                                                        }}
                                                    >
                                                        {" "}
                                                        /
                                                        {
                                                            room.participantCount
                                                        }
                                                    </span>

                                                    <div
                                                        style={{
                                                            color:
                                                                online >
                                                                0
                                                                    ? "#86efac"
                                                                    : "#6b7280",
                                                            fontSize:
                                                                "12px",
                                                            marginTop:
                                                                "3px",
                                                        }}
                                                    >
                                                        {online >
                                                        0
                                                            ? "online now"
                                                            : "none online"}
                                                    </div>
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-block",
                                                            padding:
                                                                "5px 9px",
                                                            borderRadius:
                                                                "999px",
                                                            background:
                                                                room.status ===
                                                                "active"
                                                                    ? "#12331f"
                                                                    : room.status ===
                                                                      "completed"
                                                                    ? "#25283a"
                                                                    : "#332b12",
                                                            color:
                                                                room.status ===
                                                                "active"
                                                                    ? "#86efac"
                                                                    : room.status ===
                                                                      "completed"
                                                                    ? "#cbd5e1"
                                                                    : "#fde68a",
                                                            fontSize:
                                                                "12px",
                                                            fontWeight:
                                                                600,
                                                        }}
                                                    >
                                                        {
                                                            room.status
                                                        }
                                                    </span>
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    {
                                                        formatDate(
                                                            room.createdAt
                                                        )
                                                    }
                                                </td>

                                                <td
                                                    style={{
                                                        padding:
                                                            "14px 12px",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display:
                                                                "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: "8px",
                                                            flexWrap:
                                                                "wrap",
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                navigate(
                                                                    `/owner/rooms/${room.roomId}`
                                                                )
                                                            }
                                                            style={{
                                                                background:
                                                                    "#171a2a",
                                                                color:
                                                                    "#c4b5fd",
                                                                border:
                                                                    "1px solid #4c4680",
                                                                borderRadius:
                                                                    "7px",
                                                                padding:
                                                                    "7px 11px",
                                                                cursor:
                                                                    "pointer",
                                                                fontWeight:
                                                                    600,
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            View Room
                                                        </button>

                                                        <select
                                                            value={
                                                                room.status
                                                            }
                                                            disabled={
                                                                actionRoomId ===
                                                                room.roomId
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                handleRoomStatusChange(
                                                                    room,
                                                                    event
                                                                        .target
                                                                        .value as
                                                                        | "waiting"
                                                                        | "active"
                                                                        | "completed"
                                                                )
                                                            }
                                                            style={{
                                                                background:
                                                                    "#080914",
                                                                color:
                                                                    "#ffffff",
                                                                border:
                                                                    "1px solid #34384f",
                                                                borderRadius:
                                                                    "7px",
                                                                padding:
                                                                    "7px 8px",
                                                                cursor:
                                                                    actionRoomId ===
                                                                    room.roomId
                                                                        ? "not-allowed"
                                                                        : "pointer",
                                                            }}
                                                        >
                                                            <option value="waiting">
                                                                waiting
                                                            </option>
                                                            <option value="active">
                                                                active
                                                            </option>
                                                            <option value="completed">
                                                                completed
                                                            </option>
                                                        </select>

                                                        <button
                                                            disabled={
                                                                actionRoomId ===
                                                                room.roomId
                                                            }
                                                            onClick={() =>
                                                                handleDeleteRoom(
                                                                    room
                                                                )
                                                            }
                                                            style={{
                                                                background:
                                                                    "#3a171b",
                                                                color:
                                                                    "#fca5a5",
                                                                border:
                                                                    "1px solid #5b2028",
                                                                borderRadius:
                                                                    "7px",
                                                                padding:
                                                                    "7px 10px",
                                                                cursor:
                                                                    actionRoomId ===
                                                                    room.roomId
                                                                        ? "not-allowed"
                                                                        : "pointer",
                                                                fontWeight:
                                                                    600,
                                                            }}
                                                        >
                                                            {actionRoomId ===
                                                            room.roomId
                                                                ? "Working..."
                                                                : "Delete"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                <button
                    onClick={() =>
                        navigate(
                            "/dashboard"
                        )
                    }
                    style={{
                        marginTop:
                            "24px",
                        padding:
                            "10px 18px",
                        borderRadius:
                            "8px",
                        border:
                            "1px solid #34384f",
                        cursor:
                            "pointer",
                        background:
                            "#111321",
                        color:
                            "#ffffff",
                    }}
                >
                    ← Back to Dashboard
                </button>
            </div>
        </div>
    );
};

const InfoItem = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <div>
        <span
            style={{
                color:
                    "#9ca3af",
                fontSize:
                    "13px",
            }}
        >
            {label}
        </span>

        <div
            style={{
                marginTop:
                    "5px",
                fontWeight:
                    600,
            }}
        >
            {value}
        </div>
    </div>
);

const StatCard = ({
    icon,
    label,
    value,
}: {
    icon: string;
    label: string;
    value: number | string;
}) => (
    <div
        style={{
            background:
                "#111321",
            border:
                "1px solid #25283a",
            borderRadius:
                "14px",
            padding:
                "20px",
        }}
    >
        <div
            style={{
                fontSize:
                    "24px",
            }}
        >
            {icon}
        </div>

        <div
            style={{
                color:
                    "#9ca3af",
                marginTop:
                    "12px",
                fontSize:
                    "14px",
            }}
        >
            {label}
        </div>

        <strong
            style={{
                display:
                    "block",
                marginTop:
                    "4px",
                fontSize:
                    "28px",
            }}
        >
            {value}
        </strong>
    </div>
);

const BarRow = ({
    icon,
    label,
    value,
    max,
}: {
    icon: string;
    label: string;
    value: number;
    max: number;
}) => {
    const percentage =
        max > 0
            ? Math.round(
                (value / max) *
                    100
            )
            : 0;

    return (
        <div
            style={{
                marginTop:
                    "15px",
            }}
        >
            <div
                style={{
                    display:
                        "flex",
                    justifyContent:
                        "space-between",
                    alignItems:
                        "center",
                    marginBottom:
                        "7px",
                }}
            >
                <span>
                    {icon}{" "}
                    {label}
                </span>

                <strong>
                    {value}
                </strong>
            </div>

            <div
                style={{
                    width:
                        "100%",
                    height:
                        "8px",
                    background:
                        "#25283a",
                    borderRadius:
                        "999px",
                    overflow:
                        "hidden",
                }}
            >
                <div
                    style={{
                        width:
                            `${percentage}%`,
                        height:
                            "100%",
                        background:
                            "#8b5cf6",
                        borderRadius:
                            "999px",
                        transition:
                            "width 0.3s ease",
                    }}
                />
            </div>
        </div>
    );
};

const EmptyRow = ({
    colSpan,
    text,
}: {
    colSpan: number;
    text: string;
}) => (
    <tr>
        <td
            colSpan={
                colSpan
            }
            style={{
                padding:
                    "20px",
                color:
                    "#9ca3af",
            }}
        >
            {text}
        </td>
    </tr>
);

export default OwnerDashboard;
