import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface Participant {
    id: string;
    name: string;
    email: string;
    role?: string;
}

interface RoomOwner {
    id: string;
    name: string;
    email: string;
    role?: string;
}

interface RoomTestCase {
    id: string;
    input: string;
    expectedOutput: string;
}

interface RoomFile {
    id: string;
    name: string;
    path: string;
    language?: string | null;
    size: number;
    createdAt?: string;
    updatedAt?: string;
}

interface ChatReaction {
    emoji: string;
    userId: string;
    userName: string;
}

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    reactions: ChatReaction[];
    createdAt?: string;
}

interface RoomDetails {
    id: string;
    roomId: string;
    name: string;
    language: string;
    status: string;
    owner: RoomOwner | null;
    participants: Participant[];
    participantCount: number;
    onlineParticipantCount: number;
    code: string;
    testCases: RoomTestCase[];
    interviewMode: boolean;
    interviewDurationMinutes: number;
    interviewStartedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

interface OwnerRoomDetailsResponse {
    room: RoomDetails;
    files: RoomFile[];
    chatMessages: ChatMessage[];
}

interface RoomPresence {
    roomId: string;
    onlineParticipantCount: number;
}

const socketUrl = "https://codecollab-backend-se0p.onrender.com";

const cardStyle: CSSProperties = {
    background: "#111321",
    border: "1px solid #25283a",
    borderRadius: "14px",
    padding: "20px",
};

const buttonStyle: CSSProperties = {
    background: "#1a1d2e",
    color: "#ffffff",
    border: "1px solid #34384f",
    borderRadius: "8px",
    padding: "9px 13px",
    cursor: "pointer",
};

const OwnerRoomDetails = () => {
    const navigate = useNavigate();
    const { roomId } = useParams();
    const { user, logout } = useAuth();

    const [data, setData] =
        useState<OwnerRoomDetailsResponse | null>(
            null
        );

    const [onlineCount, setOnlineCount] =
        useState(0);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [socketConnected, setSocketConnected] =
        useState(false);

    const [activeTab, setActiveTab] =
        useState<
            "overview" | "code" | "files" | "chat"
        >("overview");

    const loadRoomDetails = async () => {
        if (!roomId) {
            setError("Room ID is missing.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await api.get(
                    `/owner/rooms/${encodeURIComponent(
                        roomId
                    )}`
                );

            if (
                !response.data?.room
            ) {
                throw new Error(
                    "Room details were not returned."
                );
            }

            const responseData =
                response.data as {
                    room: RoomDetails;
                    files: RoomFile[];
                    chatMessages: ChatMessage[];
                };

            setData({
                room: responseData.room,
                files:
                    Array.isArray(
                        responseData.files
                    )
                        ? responseData.files
                        : [],
                chatMessages:
                    Array.isArray(
                        responseData.chatMessages
                    )
                        ? responseData.chatMessages
                        : [],
            });

            setOnlineCount(
                Number(
                    responseData.room
                        .onlineParticipantCount
                ) || 0
            );
        } catch (requestError: any) {
            console.error(
                "Failed to load owner room details:",
                requestError
            );

            setError(
                requestError.response?.data
                    ?.message ||
                    requestError.message ||
                    "Failed to load room details."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoomDetails();
    }, [roomId]);

    /*
     * ==========================================
     * LIVE PRESENCE
     * ==========================================
     */

    useEffect(() => {
        const accessToken =
            localStorage.getItem(
                "accessToken"
            );

        if (
            !accessToken ||
            user?.role !== "owner" ||
            !roomId
        ) {
            return;
        }

        const ownerSocket = io(
            socketUrl,
            {
                auth: {
                    accessToken,
                },
            }
        );

        ownerSocket.on(
            "connect",
            () => {
                setSocketConnected(
                    true
                );

                ownerSocket.emit(
                    "owner-monitor"
                );
            }
        );

        ownerSocket.on(
            "disconnect",
            () => {
                setSocketConnected(
                    false
                );
            }
        );

        ownerSocket.on(
            "owner-room-presence",
            (
                presence: RoomPresence[]
            ) => {
                if (
                    !Array.isArray(
                        presence
                    )
                ) {
                    return;
                }

                const currentRoom =
                    presence.find(
                        (item) =>
                            item.roomId ===
                            roomId
                    );

                setOnlineCount(
                    Number(
                        currentRoom
                            ?.onlineParticipantCount ||
                            0
                    )
                );
            }
        );

        ownerSocket.on(
            "connect_error",
            (socketError) => {
                console.error(
                    "Owner room monitor error:",
                    socketError
                );

                setSocketConnected(
                    false
                );
            }
        );

        return () => {
            ownerSocket.removeAllListeners();
            ownerSocket.disconnect();
            setSocketConnected(false);
        };
    }, [
        roomId,
        user?.role,
    ]);

    /*
     * ==========================================
     * HELPERS
     * ==========================================
     */

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const formatDateTime = (
        value?: string | null
    ) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        );
    };

    const formatBytes = (
        value: number
    ) => {
        if (!value) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB",
        ];

        let size = value;
        let index = 0;

        while (
            size >= 1024 &&
            index <
                units.length - 1
        ) {
            size /= 1024;
            index++;
        }

        return `${size.toFixed(
            index === 0 ? 0 : 1
        )} ${units[index]}`;
    };

    const room =
        data?.room || null;

    const files =
        data?.files || [];

    const chatMessages =
        data?.chatMessages || [];

    const totalParticipants =
        room?.participantCount ||
        0;

    const offlineCount =
        Math.max(
            totalParticipants -
                onlineCount,
            0
        );

    const codeLineCount =
        room?.code
            ? room.code.split("\n")
                .length
            : 0;

    const totalFileSize =
        useMemo(
            () =>
                files.reduce(
                    (
                        total,
                        file
                    ) =>
                        total +
                        (Number(
                            file.size
                        ) || 0),
                    0
                ),
            [files]
        );

    const statusColor =
        room?.status ===
        "active"
            ? "#86efac"
            : room?.status ===
              "completed"
            ? "#cbd5e1"
            : "#fde68a";

    const statusBackground =
        room?.status ===
        "active"
            ? "#12331f"
            : room?.status ===
              "completed"
            ? "#25283a"
            : "#332b12";

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

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
                        gap: "18px",
                        flexWrap:
                            "wrap",
                        marginBottom:
                            "24px",
                    }}
                >
                    <div>
                        <button
                            onClick={() =>
                                navigate(
                                    "/owner"
                                )
                            }
                            style={{
                                background:
                                    "transparent",
                                border:
                                    "none",
                                color:
                                    "#a78bfa",
                                cursor:
                                    "pointer",
                                padding: 0,
                                marginBottom:
                                    "12px",
                            }}
                        >
                            ← Back to Owner Dashboard
                        </button>

                        <h1
                            style={{
                                margin: 0,
                                fontSize:
                                    "32px",
                            }}
                        >
                            Room Inspection 🔍
                        </h1>

                        <p
                            style={{
                                color:
                                    "#9ca3af",
                                marginBottom:
                                    0,
                            }}
                        >
                            Detailed
                            owner-level
                            view of a
                            CodeCollab
                            room.
                        </p>
                    </div>

                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            gap: "10px",
                        }}
                    >
                        <span
                            style={{
                                padding:
                                    "8px 12px",
                                borderRadius:
                                    "999px",
                                border:
                                    "1px solid #25283a",
                                background:
                                    "#111321",
                                color:
                                    socketConnected
                                        ? "#86efac"
                                        : "#9ca3af",
                                fontSize:
                                    "13px",
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
                                background:
                                    "#ef4444",
                                color:
                                    "#ffffff",
                                border:
                                    "none",
                                borderRadius:
                                    "8px",
                                padding:
                                    "10px 16px",
                                cursor:
                                    "pointer",
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
                            ...cardStyle,
                            borderColor:
                                "#7f1d1d",
                            color:
                                "#fca5a5",
                            marginBottom:
                                "20px",
                        }}
                    >
                        {error}
                    </div>
                )}

                {loading ? (
                    <div
                        style={
                            cardStyle
                        }
                    >
                        Loading room
                        details...
                    </div>
                ) : !room ? (
                    <div
                        style={
                            cardStyle
                        }
                    >
                        <h2>
                            Room not
                            found
                        </h2>

                        <button
                            onClick={() =>
                                navigate(
                                    "/owner"
                                )
                            }
                            style={
                                buttonStyle
                            }
                        >
                            Return to
                            Owner
                            Dashboard
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ROOM HEADER */}
                        <div
                            style={{
                                ...cardStyle,
                                marginBottom:
                                    "18px",
                            }}
                        >
                            <div
                                style={{
                                    display:
                                        "flex",
                                    justifyContent:
                                        "space-between",
                                    alignItems:
                                        "flex-start",
                                    gap: "20px",
                                    flexWrap:
                                        "wrap",
                                }}
                            >
                                <div>
                                    <h2
                                        style={{
                                            margin:
                                                "0 0 8px",
                                        }}
                                    >
                                        {
                                            room.name
                                        }
                                    </h2>

                                    <div
                                        style={{
                                            color:
                                                "#9ca3af",
                                            fontFamily:
                                                "monospace",
                                            wordBreak:
                                                "break-all",
                                        }}
                                    >
                                        {
                                            room.roomId
                                        }
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display:
                                            "flex",
                                        gap: "8px",
                                        alignItems:
                                            "center",
                                        flexWrap:
                                            "wrap",
                                    }}
                                >
                                    <span
                                        style={{
                                            padding:
                                                "7px 12px",
                                            borderRadius:
                                                "999px",
                                            background:
                                                statusBackground,
                                            color:
                                                statusColor,
                                            fontWeight:
                                                600,
                                            fontSize:
                                                "13px",
                                        }}
                                    >
                                        {
                                            room.status
                                        }
                                    </span>

                                    <span
                                        style={{
                                            padding:
                                                "7px 12px",
                                            borderRadius:
                                                "999px",
                                            background:
                                                "#171a2a",
                                            color:
                                                "#c4b5fd",
                                            fontSize:
                                                "13px",
                                        }}
                                    >
                                        {
                                            room.language
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* KPI CARDS */}
                        <div
                            style={{
                                display:
                                    "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "14px",
                                marginBottom:
                                    "20px",
                            }}
                        >
                            <MetricCard
                                icon="👥"
                                label="Participants"
                                value={
                                    totalParticipants
                                }
                            />

                            <MetricCard
                                icon="🟢"
                                label="Online Now"
                                value={
                                    onlineCount
                                }
                            />

                            <MetricCard
                                icon="⚪"
                                label="Offline"
                                value={
                                    offlineCount
                                }
                            />

                            <MetricCard
                                icon="📄"
                                label="Saved Files"
                                value={
                                    files.length
                                }
                            />

                            <MetricCard
                                icon="💬"
                                label="Recent Messages"
                                value={
                                    chatMessages.length
                                }
                            />

                            <MetricCard
                                icon="🧪"
                                label="Test Cases"
                                value={
                                    room
                                        .testCases
                                        .length
                                }
                            />
                        </div>

                        {/* TABS */}
                        <div
                            style={{
                                ...cardStyle,
                                padding:
                                    "10px",
                                marginBottom:
                                    "18px",
                                display:
                                    "flex",
                                gap: "8px",
                                flexWrap:
                                    "wrap",
                            }}
                        >
                            {[
                                [
                                    "overview",
                                    "Overview",
                                ],
                                [
                                    "code",
                                    "Code",
                                ],
                                [
                                    "files",
                                    "Files",
                                ],
                                [
                                    "chat",
                                    "Chat",
                                ],
                            ].map(
                                ([
                                    value,
                                    label,
                                ]) => {
                                    const active =
                                        activeTab ===
                                        value;

                                    return (
                                        <button
                                            key={
                                                value
                                            }
                                            onClick={() =>
                                                setActiveTab(
                                                    value as
                                                        | "overview"
                                                        | "code"
                                                        | "files"
                                                        | "chat"
                                                )
                                            }
                                            style={{
                                                ...buttonStyle,
                                                background:
                                                    active
                                                        ? "#6d4aff"
                                                        : "#1a1d2e",
                                                borderColor:
                                                    active
                                                        ? "#8b5cf6"
                                                        : "#34384f",
                                                fontWeight:
                                                    active
                                                        ? 700
                                                        : 500,
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                }
                            )}

                            <button
                                onClick={
                                    loadRoomDetails
                                }
                                style={{
                                    ...buttonStyle,
                                    marginLeft:
                                        "auto",
                                }}
                            >
                                Refresh
                            </button>
                        </div>

                        {/* OVERVIEW */}
                        {activeTab ===
                            "overview" && (
                            <div
                                style={{
                                    display:
                                        "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(320px, 1fr))",
                                    gap: "18px",
                                }}
                            >
                                <section
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
                                        Room Information
                                    </h2>

                                    <InfoRow
                                        label="Room ID"
                                        value={
                                            room.roomId
                                        }
                                    />

                                    <InfoRow
                                        label="Language"
                                        value={
                                            room.language
                                        }
                                    />

                                    <InfoRow
                                        label="Status"
                                        value={
                                            room.status
                                        }
                                    />

                                    <InfoRow
                                        label="Created"
                                        value={formatDateTime(
                                            room.createdAt
                                        )}
                                    />

                                    <InfoRow
                                        label="Updated"
                                        value={formatDateTime(
                                            room.updatedAt
                                        )}
                                    />
                                </section>

                                <section
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
                                        Owner
                                    </h2>

                                    {room.owner ? (
                                        <>
                                            <InfoRow
                                                label="Name"
                                                value={
                                                    room
                                                        .owner
                                                        .name
                                                }
                                            />

                                            <InfoRow
                                                label="Email"
                                                value={
                                                    room
                                                        .owner
                                                        .email
                                                }
                                            />

                                            <InfoRow
                                                label="Role"
                                                value={
                                                    room
                                                        .owner
                                                        .role ||
                                                    "owner"
                                                }
                                            />
                                        </>
                                    ) : (
                                        <p
                                            style={{
                                                color:
                                                    "#9ca3af",
                                            }}
                                        >
                                            Owner
                                            information
                                            unavailable.
                                        </p>
                                    )}
                                </section>

                                <section
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
                                        Interview Settings
                                    </h2>

                                    <InfoRow
                                        label="Interview Mode"
                                        value={
                                            room.interviewMode
                                                ? "Enabled"
                                                : "Disabled"
                                        }
                                    />

                                    <InfoRow
                                        label="Duration"
                                        value={`${room.interviewDurationMinutes} minutes`}
                                    />

                                    <InfoRow
                                        label="Started"
                                        value={formatDateTime(
                                            room.interviewStartedAt
                                        )}
                                    />
                                </section>

                                <section
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
                                        Storage
                                    </h2>

                                    <InfoRow
                                        label="Files"
                                        value={`${files.length}`}
                                    />

                                    <InfoRow
                                        label="Total File Size"
                                        value={formatBytes(
                                            totalFileSize
                                        )}
                                    />

                                    <InfoRow
                                        label="Main Code Lines"
                                        value={`${codeLineCount}`}
                                    />
                                </section>

                                <section
                                    style={{
                                        ...cardStyle,
                                        gridColumn:
                                            "1 / -1",
                                    }}
                                >
                                    <h2
                                        style={{
                                            marginTop:
                                                0,
                                        }}
                                    >
                                        Participants
                                    </h2>

                                    {room.participants
                                        .length ===
                                    0 ? (
                                        <p
                                            style={{
                                                color:
                                                    "#9ca3af",
                                            }}
                                        >
                                            No participants
                                            in this
                                            room.
                                        </p>
                                    ) : (
                                        <div
                                            style={{
                                                display:
                                                    "grid",
                                                gridTemplateColumns:
                                                    "repeat(auto-fit, minmax(260px, 1fr))",
                                                gap: "10px",
                                            }}
                                        >
                                            {room.participants.map(
                                                (
                                                    participant
                                                ) => {
                                                    return (
                                                        <div
                                                            key={
                                                                participant.id
                                                            }
                                                            style={{
                                                                border:
                                                                    "1px solid #25283a",
                                                                borderRadius:
                                                                    "10px",
                                                                padding:
                                                                    "13px",
                                                                display:
                                                                    "flex",
                                                                justifyContent:
                                                                    "space-between",
                                                                gap: "12px",
                                                            }}
                                                        >
                                                            <div>
                                                                <strong>
                                                                    {
                                                                        participant.name
                                                                    }
                                                                </strong>

                                                                <div
                                                                    style={{
                                                                        color:
                                                                            "#9ca3af",
                                                                        fontSize:
                                                                            "13px",
                                                                        marginTop:
                                                                            "4px",
                                                                    }}
                                                                >
                                                                    {
                                                                        participant.email
                                                                    }
                                                                </div>
                                                            </div>

                                                            <span
                                                                style={{
                                                                    color:
                                                                        "#9ca3af",
                                                                    fontSize:
                                                                        "12px",
                                                                    whiteSpace:
                                                                        "nowrap",
                                                                }}
                                                            >
                                                                member
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </section>

                                <section
                                    style={{
                                        ...cardStyle,
                                        gridColumn:
                                            "1 / -1",
                                    }}
                                >
                                    <h2
                                        style={{
                                            marginTop:
                                                0,
                                        }}
                                    >
                                        Test Cases
                                    </h2>

                                    {room.testCases
                                        .length ===
                                    0 ? (
                                        <p
                                            style={{
                                                color:
                                                    "#9ca3af",
                                            }}
                                        >
                                            No test
                                            cases
                                            saved.
                                        </p>
                                    ) : (
                                        <div
                                            style={{
                                                display:
                                                    "grid",
                                                gap: "12px",
                                            }}
                                        >
                                            {room.testCases.map(
                                                (
                                                    testCase,
                                                    index
                                                ) => (
                                                    <div
                                                        key={
                                                            testCase.id ||
                                                            index
                                                        }
                                                        style={{
                                                            border:
                                                                "1px solid #25283a",
                                                            borderRadius:
                                                                "10px",
                                                            padding:
                                                                "14px",
                                                        }}
                                                    >
                                                        <strong>
                                                            Test Case{" "}
                                                            {index +
                                                                1}
                                                        </strong>

                                                        <div
                                                            style={{
                                                                display:
                                                                    "grid",
                                                                gridTemplateColumns:
                                                                    "repeat(auto-fit, minmax(250px, 1fr))",
                                                                gap: "12px",
                                                                marginTop:
                                                                    "10px",
                                                            }}
                                                        >
                                                            <CodeBox
                                                                title="Input"
                                                                value={
                                                                    testCase.input
                                                                }
                                                            />

                                                            <CodeBox
                                                                title="Expected Output"
                                                                value={
                                                                    testCase.expectedOutput
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* CODE */}
                        {activeTab ===
                            "code" && (
                            <section
                                style={
                                    cardStyle
                                }
                            >
                                <div
                                    style={{
                                        display:
                                            "flex",
                                        justifyContent:
                                            "space-between",
                                        alignItems:
                                            "center",
                                        gap: "10px",
                                        marginBottom:
                                            "14px",
                                    }}
                                >
                                    <div>
                                        <h2
                                            style={{
                                                margin:
                                                    0,
                                            }}
                                        >
                                            Current Room Code
                                        </h2>

                                        <p
                                            style={{
                                                color:
                                                    "#9ca3af",
                                                margin:
                                                    "5px 0 0",
                                            }}
                                        >
                                            Read-only
                                            owner
                                            inspection.
                                        </p>
                                    </div>

                                    <span
                                        style={{
                                            color:
                                                "#c4b5fd",
                                            fontFamily:
                                                "monospace",
                                        }}
                                    >
                                        {
                                            room.language
                                        }
                                    </span>
                                </div>

                                <pre
                                    style={{
                                        margin: 0,
                                        background:
                                            "#080914",
                                        border:
                                            "1px solid #25283a",
                                        borderRadius:
                                            "10px",
                                        padding:
                                            "18px",
                                        overflow:
                                            "auto",
                                        maxHeight:
                                            "650px",
                                        whiteSpace:
                                            "pre",
                                        fontSize:
                                            "13px",
                                        lineHeight:
                                            1.55,
                                        color:
                                            "#e5e7eb",
                                    }}
                                >
                                    {room.code ||
                                        "// No code saved in this room."}
                                </pre>
                            </section>
                        )}

                        {/* FILES */}
                        {activeTab ===
                            "files" && (
                            <section
                                style={
                                    cardStyle
                                }
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
                                                margin:
                                                    0,
                                            }}
                                        >
                                            Saved Room Files
                                        </h2>

                                        <p
                                            style={{
                                                color:
                                                    "#9ca3af",
                                                margin:
                                                    "5px 0 0",
                                            }}
                                        >
                                            {files.length}{" "}
                                            files ·{" "}
                                            {formatBytes(
                                                totalFileSize
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {files.length ===
                                0 ? (
                                    <p
                                        style={{
                                            color:
                                                "#9ca3af",
                                        }}
                                    >
                                        No saved
                                        room files.
                                    </p>
                                ) : (
                                    <div
                                        style={{
                                            overflowX:
                                                "auto",
                                        }}
                                    >
                                        <table
                                            style={{
                                                width:
                                                    "100%",
                                                borderCollapse:
                                                    "collapse",
                                                minWidth:
                                                    "750px",
                                            }}
                                        >
                                            <thead>
                                                <tr
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    <th
                                                        style={{
                                                            padding:
                                                                "11px",
                                                        }}
                                                    >
                                                        File
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding:
                                                                "11px",
                                                        }}
                                                    >
                                                        Path
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding:
                                                                "11px",
                                                        }}
                                                    >
                                                        Language
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding:
                                                                "11px",
                                                        }}
                                                    >
                                                        Size
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding:
                                                                "11px",
                                                        }}
                                                    >
                                                        Updated
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {files.map(
                                                    (
                                                        file
                                                    ) => (
                                                        <tr
                                                            key={
                                                                file.id
                                                            }
                                                            style={{
                                                                borderTop:
                                                                    "1px solid #25283a",
                                                            }}
                                                        >
                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "13px 11px",
                                                                    fontWeight:
                                                                        600,
                                                                }}
                                                            >
                                                                📄{" "}
                                                                {
                                                                    file.name
                                                                }
                                                            </td>

                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "13px 11px",
                                                                    color:
                                                                        "#cbd5e1",
                                                                    fontFamily:
                                                                        "monospace",
                                                                    fontSize:
                                                                        "12px",
                                                                }}
                                                            >
                                                                {
                                                                    file.path
                                                                }
                                                            </td>

                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "13px 11px",
                                                                }}
                                                            >
                                                                {
                                                                    file.language ||
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "13px 11px",
                                                                }}
                                                            >
                                                                {formatBytes(
                                                                    file.size
                                                                )}
                                                            </td>

                                                            <td
                                                                style={{
                                                                    padding:
                                                                        "13px 11px",
                                                                    color:
                                                                        "#9ca3af",
                                                                }}
                                                            >
                                                                {formatDateTime(
                                                                    file.updatedAt
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* CHAT */}
                        {activeTab ===
                            "chat" && (
                            <section
                                style={
                                    cardStyle
                                }
                            >
                                <div
                                    style={{
                                        marginBottom:
                                            "16px",
                                    }}
                                >
                                    <h2
                                        style={{
                                            margin:
                                                0,
                                        }}
                                    >
                                        Recent Chat
                                    </h2>

                                    <p
                                        style={{
                                            color:
                                                "#9ca3af",
                                            margin:
                                                "5px 0 0",
                                        }}
                                    >
                                        Latest saved
                                        messages from
                                        this room.
                                    </p>
                                </div>

                                {chatMessages.length ===
                                0 ? (
                                    <p
                                        style={{
                                            color:
                                                "#9ca3af",
                                        }}
                                    >
                                        No chat
                                        messages
                                        found.
                                    </p>
                                ) : (
                                    <div
                                        style={{
                                            display:
                                                "grid",
                                            gap: "10px",
                                            maxHeight:
                                                "650px",
                                            overflowY:
                                                "auto",
                                        }}
                                    >
                                        {chatMessages.map(
                                            (
                                                message
                                            ) => (
                                                <div
                                                    key={
                                                        message.id
                                                    }
                                                    style={{
                                                        border:
                                                            "1px solid #25283a",
                                                        borderRadius:
                                                            "10px",
                                                        padding:
                                                            "13px",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display:
                                                                "flex",
                                                            justifyContent:
                                                                "space-between",
                                                            gap: "12px",
                                                        }}
                                                    >
                                                        <strong>
                                                            {
                                                                message.userName
                                                            }
                                                        </strong>

                                                        <span
                                                            style={{
                                                                color:
                                                                    "#6b7280",
                                                                fontSize:
                                                                    "12px",
                                                            }}
                                                        >
                                                            {formatDateTime(
                                                                message.createdAt
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div
                                                        style={{
                                                            marginTop:
                                                                "8px",
                                                            color:
                                                                "#d1d5db",
                                                            whiteSpace:
                                                                "pre-wrap",
                                                            wordBreak:
                                                                "break-word",
                                                        }}
                                                    >
                                                        {
                                                            message.message
                                                        }
                                                    </div>

                                                    {message
                                                        .reactions
                                                        ?.length >
                                                        0 && (
                                                        <div
                                                            style={{
                                                                marginTop:
                                                                    "8px",
                                                                color:
                                                                    "#9ca3af",
                                                                fontSize:
                                                                    "12px",
                                                            }}
                                                        >
                                                            {message.reactions
                                                                .map(
                                                                    (
                                                                        reaction
                                                                    ) =>
                                                                        `${reaction.emoji} ${reaction.userName}`
                                                                )
                                                                .join(
                                                                    " · "
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const MetricCard = ({
    icon,
    label,
    value,
}: {
    icon: string;
    label: string;
    value: number | string;
}) => (
    <div
        style={
            cardStyle
        }
    >
        <div
            style={{
                fontSize:
                    "23px",
            }}
        >
            {icon}
        </div>

        <div
            style={{
                color:
                    "#9ca3af",
                marginTop:
                    "10px",
                fontSize:
                    "13px",
            }}
        >
            {label}
        </div>

        <strong
            style={{
                display:
                    "block",
                marginTop:
                    "5px",
                fontSize:
                    "26px",
            }}
        >
            {value}
        </strong>
    </div>
);

const InfoRow = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <div
        style={{
            display:
                "flex",
            justifyContent:
                "space-between",
            gap: "16px",
            padding:
                "10px 0",
            borderBottom:
                "1px solid #25283a",
        }}
    >
        <span
            style={{
                color:
                    "#9ca3af",
            }}
        >
            {label}
        </span>

        <strong
            style={{
                textAlign:
                    "right",
                wordBreak:
                    "break-word",
            }}
        >
            {value}
        </strong>
    </div>
);

const CodeBox = ({
    title,
    value,
}: {
    title: string;
    value: string;
}) => (
    <div>
        <div
            style={{
                color:
                    "#9ca3af",
                fontSize:
                    "12px",
                marginBottom:
                    "5px",
            }}
        >
            {title}
        </div>

        <pre
            style={{
                margin: 0,
                background:
                    "#080914",
                border:
                    "1px solid #25283a",
                borderRadius:
                    "8px",
                padding:
                    "11px",
                minHeight:
                    "55px",
                overflow:
                    "auto",
                whiteSpace:
                    "pre-wrap",
                wordBreak:
                    "break-word",
                color:
                    "#d1d5db",
                fontSize:
                    "12px",
            }}
        >
            {value || "—"}
        </pre>
    </div>
);

export default OwnerRoomDetails;
