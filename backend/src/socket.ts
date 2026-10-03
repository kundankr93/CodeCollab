import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";

import { ChatMessage } from "./models/ChatMessage.js";
import { Room } from "./models/Room.js";
import { User } from "./models/User.js";
import { Project } from "./models/Project.js";
import { ProjectFile } from "./models/ProjectFile.js";
import { RoomFile } from "./models/RoomFile.js";

interface FileJoinData {
    projectId: string;
    fileId: string;
    userId: string;
    userName: string;
}

interface FileCodeChangeData {
    projectId: string;
    fileId: string;
    code: string;
}

interface FileCursorChangeData {
    projectId: string;
    fileId: string;
    userId: string;
    userName: string;
    lineNumber: number;
    column: number;
}

interface LeaveFileData {
    projectId: string;
    fileId: string;
    userId: string;
    userName: string;
}

interface RoomFileJoinData {
    roomId: string;
    fileId: string;
    userId: string;
    userName: string;
}

interface RoomFileCodeChangeData {
    roomId: string;
    fileId: string;
    code: string;
    /*
     * Optional:
     * - omitted = low-latency live preview
     * - present = persisted/versioned update
     */
    version?: number;
}

interface RoomFileCursorChangeData {
    roomId: string;
    fileId: string;
    userId: string;
    userName: string;
    lineNumber: number;
    column: number;
}

interface ChatReplyData {
    messageId: string;
    userId: string;
    userName: string;
    message: string;
}

interface ChatMessageData {
    roomId: string;
    userId: string;
    userName: string;
    message: string;
    replyTo?: ChatReplyData;
}

interface ChatTypingData {
    roomId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
}

interface ChatReactionData {
    roomId: string;
    messageId: string;
    userId: string;
    userName: string;
    emoji: string;
}

const CHAT_REACTION_EMOJIS = [
    "👍",
    "❤️",
    "😂",
    "🔥",
    "👏",
    "😮",
];

interface RoomParticipant {
    userId: string;
    userName: string;
    online: boolean;
}

interface CodeExecutionStartData {
    roomId: string;
    userId: string;
    userName: string;
    language: string;
}

interface CodeExecutionResultData {
    roomId: string;
    userId: string;
    userName: string;
    language: string;
    output: string;
    error: string;
    executionTime: number | null;
}


const getFileRoom = (
    projectId: string,
    fileId: string
): string => {
    return `project:${projectId}:file:${fileId}`;
};

const authorizeProjectFile = async (
    userId: string,
    projectId: string,
    fileId: string
): Promise<boolean> => {
    if (!userId || !projectId || !fileId) return false;

    if (
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(projectId) ||
        !mongoose.Types.ObjectId.isValid(fileId)
    ) {
        return false;
    }

    const project = await Project.findById(projectId)
        .select("owner collaborators");

    if (!project) return false;

    const isOwner = project.owner.toString() === userId;

    const isCollaborator = project.collaborators.some(
        (collaborator) => collaborator.toString() === userId
    );

    if (!isOwner && !isCollaborator) return false;

    const file = await ProjectFile.findOne({
        _id: fileId,
        projectId,
    }).select("_id");

    return Boolean(file);
};

const getRoomFileRoom = (
    roomId: string,
    fileId: string
): string => {
    return `room:${roomId}:file:${fileId}`;
};

const authorizeRoomFile = async (
    userId: string,
    roomId: string,
    fileId: string
): Promise<boolean> => {
    if (!userId || !roomId || !fileId) {
        return false;
    }

    if (
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(fileId)
    ) {
        return false;
    }

    const room = await Room.findOne({ roomId })
        .select("owner participants status");

    if (!room || room.status === "completed") {
        return false;
    }

    const isOwner =
        room.owner.toString() === userId;

    const isParticipant =
        room.participants.some(
            (participant) =>
                participant.toString() === userId
        );

    if (!isOwner && !isParticipant) {
        return false;
    }

    const file = await RoomFile.findOne({
        _id: fileId,
        roomId,
    }).select("_id");

    return Boolean(file);
};

const getRoomParticipants = async (
    io: Server,
    roomId: string
): Promise<RoomParticipant[]> => {
    // Get all members of the room from MongoDB.
    const room = await Room.findOne({ roomId })
        .select("owner participants");

    if (!room) {
        return [];
    }

    // Collect owner + participants without duplicates.
    const memberIds = new Set<string>();

    memberIds.add(room.owner.toString());

    for (const participant of room.participants) {
        memberIds.add(participant.toString());
    }

    const userIds = Array.from(memberIds);

    if (userIds.length === 0) {
        return [];
    }

    // Fetch names for all room members, including offline users.
    const users = await User.find({
        _id: {
            $in: userIds,
        },
    }).select("_id name");

    // Find sockets currently connected to this room.
    const sockets = await io
        .in(roomId)
        .fetchSockets();

    const onlineUserIds = new Set<string>();

    for (const roomSocket of sockets) {
        const userId = roomSocket.data.userId;

        if (userId) {
            onlineUserIds.add(userId);
        }
    }

    // Combine database membership with Socket.IO presence.
    return users.map((user) => {
        const userId = user._id.toString();

        return {
            userId,
            userName: user.name,
            online: onlineUserIds.has(userId),
        };
    });
};

const broadcastOwnerRoomPresence = async (
    io: Server
): Promise<void> => {
    try {
        const rooms = await Room.find()
            .select("roomId")
            .lean();

        const presence = await Promise.all(
            rooms.map(async (room) => {
                const sockets = await io
                    .in(room.roomId)
                    .fetchSockets();

                const onlineUserIds = new Set<string>();

                for (const roomSocket of sockets) {
                    const userId = roomSocket.data.userId;

                    if (userId) {
                        onlineUserIds.add(userId);
                    }
                }

                return {
                    roomId: room.roomId,
                    onlineParticipantCount:
                        onlineUserIds.size,
                };
            })
        );

        io.to("owner-monitor").emit(
            "owner-room-presence",
            presence
        );
    } catch (error) {
        console.error(
            "Failed to broadcast owner room presence:",
            error
        );
    }
};

/**
 * Broadcast that a coding room has been deleted.
 *
 * HTTP controllers use this helper to notify users who are
 * currently connected to the deleted coding room.
 */
export const broadcastRoomDeleted = (
    io: Server,
    roomId: string
): void => {
    if (!roomId) {
        return;
    }

    io.to(roomId).emit("room-deleted", {
        roomId,
    });
};

const broadcastRoomParticipants = async (
    io: Server,
    roomId: string
): Promise<void> => {
    try {
        const participants =
            await getRoomParticipants(
                io,
                roomId
            );

        io.to(roomId).emit(
            "room-participants",
            participants
        );

        await broadcastOwnerRoomPresence(io);
    } catch (error) {
        console.error(
            "Failed to update room participants:",
            error
        );
    }
};

// Prevent overlapping timeout scans when a database query takes longer
// than the polling interval.
let isCheckingInterviewTimeouts = false;

const checkInterviewTimeouts = async (io: Server) => {
    if (isCheckingInterviewTimeouts) {
        return;
    }

    isCheckingInterviewTimeouts = true;

    try {
        const now = Date.now();

        const rooms = await Room.find({
            status: "active",
            interviewMode: true,
            interviewStartedAt: { $ne: null },
        }).select(
            "roomId owner interviewStartedAt interviewDurationMinutes status"
        );

        for (const room of rooms) {
            if (!room.interviewStartedAt) continue;

            const durationMinutes =
                room.interviewDurationMinutes || 60;
            const expiresAt =
                room.interviewStartedAt.getTime() +
                durationMinutes * 60_000;

            if (now < expiresAt) continue;

            // Complete only the same active interview that was checked.
            // If the session was restarted, its new start time won't match.
            const updatedRoom = await Room.findOneAndUpdate(
                {
                    _id: room._id,
                    status: "active",
                    interviewMode: true,
                    interviewStartedAt: room.interviewStartedAt,
                },
                { $set: { status: "completed" } },
                { new: true }
            );

            if (!updatedRoom) continue;

            const ownerId = room.owner.toString();
            const sockets = await io
                .in(room.roomId)
                .fetchSockets();

            for (const roomSocket of sockets) {
                roomSocket.emit(
                    "interview-timeout",
                    {
                        roomId: room.roomId,
                        ownerId,
                        durationMinutes,
                    }
                );

                if (roomSocket.data.userId !== ownerId) {
                    io.to(room.roomId).emit(
                        "user-left",
                        {
                            userId: roomSocket.data.userId,
                            userName:
                                roomSocket.data.userName ||
                                "Anonymous",
                        }
                    );

                    roomSocket.leave(room.roomId);
                    roomSocket.data.roomId = undefined;
                }
            }

            io.to(room.roomId).emit(
                "room-status-changed",
                {
                    status: "completed",
                    interviewMode: true,
                    interviewDurationMinutes: durationMinutes,
                    interviewStartedAt: room.interviewStartedAt,
                }
            );

            await broadcastRoomParticipants(io, room.roomId);

            console.log(
                `Interview timed out for room ${room.roomId} ⏰`
            );
        }
    } catch (error) {
        console.error(
            "Interview timeout check failed ❌",
            error
        );
    } finally {
        isCheckingInterviewTimeouts = false;
    }
};

export const initializeSocket = (
    io: Server
): Server => {
    // ==========================================
    // INTERVIEW TIMEOUT MONITOR
    // ==========================================

    // Poll every 10 seconds. The overlap guard prevents concurrent scans.
    setInterval(() => {
        void checkInterviewTimeouts(io);
    }, 10_000);

    // Run once immediately on startup.
    void checkInterviewTimeouts(io);

    // ==========================================
    // SOCKET AUTHENTICATION
    // ==========================================

    io.use((socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.auth?.accessToken;

            if (!token) {
                return next(
                    new Error(
                        "Authentication required"
                    )
                );
            }

            const secret =
                process.env.JWT_ACCESS_SECRET;

            if (!secret) {
                return next(
                    new Error(
                        "JWT_ACCESS_SECRET is not defined"
                    )
                );
            }

            const decoded =
                jwt.verify(
                    token,
                    secret
                ) as {
                    userId?: string;
                };

            if (!decoded.userId) {
                return next(
                    new Error(
                        "Invalid access token"
                    )
                );
            }

            socket.data.userId =
                decoded.userId;

            next();
        } catch (error) {
            console.error(
                "Socket authentication failed:",
                error
            );

            next(
                new Error(
                    "Invalid or expired access token"
                )
            );
        }
    });

    io.on(
        "connection",
        (socket: Socket) => {
            console.log(
                "Socket connected:",
                socket.id
            );

            // ==========================================
            // OWNER MONITOR
            // ==========================================

            socket.on(
                "owner-monitor",
                async () => {
                    try {
                        const user = await User.findById(
                            socket.data.userId
                        ).select("role");

                        if (!user || user.role !== "owner") {
                            return;
                        }

                        socket.join("owner-monitor");

                        await broadcastOwnerRoomPresence(io);
                    } catch (error) {
                        console.error(
                            "Owner monitor authorization failed:",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // CODING ROOM
            // ==========================================

            socket.on(
                "join-room",
                async (data: {
                    roomId: string;
                    // Kept optional for compatibility with existing clients.
                    // These values are never trusted by the server.
                    userId?: string;
                    userName?: string;
                }) => {
                    try {
                        const roomId =
                            typeof data?.roomId === "string"
                                ? data.roomId.trim()
                                : "";

                        // The authenticated identity is established by the
                        // Socket.IO JWT middleware, not by client payloads.
                        const userId = socket.data.userId;

                        if (
                            !roomId ||
                            roomId.length > 128 ||
                            !userId ||
                            !mongoose.Types.ObjectId.isValid(userId)
                        ) {
                            socket.emit("room-join-error", {
                                message: "Invalid room or authentication",
                            });
                            return;
                        }

                        // Always use the database as the source of truth for
                        // the participant's display name.
                        const authenticatedUser = await User.findById(
                            userId
                        ).select("name");

                        if (!authenticatedUser) {
                            socket.emit("room-join-error", {
                                message: "Authenticated user was not found",
                            });
                            return;
                        }

                        const userName =
                            authenticatedUser.name || "User";

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                    if (!room) {
                        return;
                    }

                    const isOwner =
                        room.owner.toString() ===
                        userId;

                    const isParticipant =
                        room.participants.some(
                            (participant) =>
                                participant.toString() ===
                                userId
                        );

                    if (
                        !isOwner &&
                        !isParticipant
                    ) {
                        return;
                    }

                    // If this socket was already connected
                    // to another coding room, clean that room
                    // up before joining the new one.
                    const previousRoomId =
                        socket.data.roomId;

                    if (
                        previousRoomId &&
                        previousRoomId !== roomId
                    ) {
                        socket
                            .to(previousRoomId)
                            .emit(
                                "user-left",
                                {
                                    userId:
                                        socket.data.userId,
                                    userName:
                                        socket.data.userName ||
                                        "Anonymous",
                                }
                            );

                        socket.leave(
                            previousRoomId
                        );

                        await broadcastRoomParticipants(
                            io,
                            previousRoomId
                        );
                    }

                    socket.join(roomId);

                    socket.data.roomId =
                        roomId;

                    socket.data.userName = userName;

                    socket
                        .to(roomId)
                        .emit(
                            "user-joined",
                            {
                                userId,
                                userName,
                            }
                        );

                    await broadcastRoomParticipants(
                        io,
                        roomId
                    );

                    // Send the authoritative room lifecycle state to every
                    // connected client. This includes the interview timer
                    // start timestamp so all browsers calculate the same
                    // remaining time.
                    io.to(roomId).emit(
                        "room-status-changed",
                        {
                            status: room.status,
                            interviewMode:
                                room.interviewMode === true,
                            interviewDurationMinutes:
                                room.interviewDurationMinutes || 60,
                            interviewStartedAt:
                                room.interviewStartedAt || null,
                        }
                    );

                        console.log(
                            `${userName} joined room ${roomId}`
                        );
                    } catch (error) {
                        console.error("Join room error:", error);
                        socket.emit("room-join-error", {
                            message: "Unable to join the room",
                        });
                    }
                }
            );

            // ==========================================
            // ROOM ACTIVE FILE SELECTION
            // ==========================================

            socket.on(
                "room-active-file-change",
                async (data: {
                    roomId: string;
                    fileId: string;
                }) => {
                    try {
                        const roomId =
                            typeof data?.roomId === "string"
                                ? data.roomId.trim()
                                : "";
                        const fileId =
                            typeof data?.fileId === "string"
                                ? data.fileId.trim()
                                : "";
                        const userId = socket.data.userId;

                        // Only a socket already authenticated into this room
                        // may change the room-wide active file.
                        if (
                            !roomId ||
                            socket.data.roomId !== roomId ||
                            !userId ||
                            !mongoose.Types.ObjectId.isValid(fileId)
                        ) {
                            return;
                        }

                        const room = await Room.findOne({ roomId })
                            .select("owner participants");

                        if (!room) {
                            return;
                        }

                        const isRoomMember =
                            room.owner.toString() === userId ||
                            room.participants.some(
                                (participant) =>
                                    participant.toString() === userId
                            );

                        if (!isRoomMember) {
                            return;
                        }

                        const fileExists = await RoomFile.exists({
                            _id: fileId,
                            roomId,
                        });

                        if (!fileExists) {
                            return;
                        }

                        // Exclude only the originating socket, not every
                        // socket belonging to the same user. This lets the
                        // user's other browser tabs/windows stay in sync.
                        socket.to(roomId).emit(
                            "room-active-file-changed",
                            {
                                roomId,
                                fileId,
                                userId,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Room active file broadcast error:",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // ROOM LIFECYCLE
            // ==========================================

            socket.on(
                "room-status-changed",
                async (data: {
                    roomId: string;
                    userId: string;
                    status:
                        | "waiting"
                        | "active"
                        | "completed";
                }) => {
                    try {
                        const {
                            roomId,
                            userId,
                            status,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId ||
                            (
                                status !== "waiting" &&
                                status !== "active" &&
                                status !== "completed"
                            )
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                        if (
                            !room ||
                            room.owner.toString() !==
                                userId
                        ) {
                            return;
                        }

                        if (
                            (
                                status === "waiting" &&
                                room.status !== "waiting"
                            ) ||
                            (
                                status === "active" &&
                                room.status !== "active"
                            ) ||
                            (
                                status === "completed" &&
                                room.status !== "completed"
                            )
                        ) {
                            return;
                        }

                        io.to(roomId).emit(
                            "room-status-changed",
                            {
                                status,
                                interviewMode:
                                    room.interviewMode === true,
                                interviewDurationMinutes:
                                    room.interviewDurationMinutes || 60,
                                interviewStartedAt:
                                    room.interviewStartedAt || null,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Room lifecycle broadcast error ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // INTERVIEW MODE
            // ==========================================

            socket.on(
                "interview-mode-changed",
                async (data: {
                    roomId: string;
                    userId: string;
                    enabled: boolean;
                    durationMinutes?: number;
                }) => {
                    try {
                        const { roomId, userId, enabled } = data;

                        if (
                            !roomId ||
                            !userId ||
                            socket.data.roomId !== roomId ||
                            socket.data.userId !== userId ||
                            typeof enabled !== "boolean"
                        ) {
                            return;
                        }

                        const room = await Room.findOne({ roomId });

                        if (!room) {
                            return;
                        }

                        if (room.owner.toString() !== userId) {
                            return;
                        }

                        if (room.status === "completed") {
                            return;
                        }

                        // The REST endpoint is the source of truth.
                        if (room.interviewMode !== enabled) {
                            return;
                        }

                        io.to(roomId).emit(
                            "interview-mode-changed",
                            {
                                enabled: room.interviewMode,
                                userId,
                                durationMinutes:
                                    room.interviewDurationMinutes || 60,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Interview mode broadcast error ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // CODE CHANGE
            // ==========================================

            socket.on(
                "code-change",
                (data: {
                    roomId: string;
                    code: string;
                }) => {
                    if (
                        !data.roomId ||
                        socket.data.roomId !==
                            data.roomId ||
                        typeof data.code !==
                            "string"
                    ) {
                        return;
                    }

                    void Room.findOne({
                        roomId: data.roomId,
                    })
                        .then((room) => {
                            if (!room) {
                                return;
                            }

                            const userId =
                                socket.data.userId;

                            const isParticipant =
                                !!userId &&
                                room.participants.some(
                                    (participant) =>
                                        participant.toString() ===
                                        userId
                                );

                            const isOwner =
                                !!userId &&
                                room.owner.toString() ===
                                    userId;

                            if (
                                !isParticipant &&
                                !isOwner
                            ) {
                                return;
                            }

                            if (
                                room.status ===
                                "completed"
                            ) {
                                return;
                            }

                            socket
                                .to(data.roomId)
                                .emit(
                                    "code-update",
                                    {
                                        code:
                                            data.code,
                                    }
                                );
                        })
                        .catch((error) => {
                            console.error(
                                "Code access validation error ❌",
                                error
                            );
                        });
                }
            );

            // ==========================================
            // CODE EXECUTION SYNC
            // ==========================================

            socket.on(
                "code-execution-start",
                async (
                    data: CodeExecutionStartData
                ) => {
                    try {
                        const {
                            roomId,
                            userId,
                            userName,
                            language,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            !language ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            }).select(
                                "owner participants status"
                            );

                        if (!room || room.status === "completed") {
                            return;
                        }

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        if (!isOwner && !isParticipant) {
                            return;
                        }

                        socket.to(roomId).emit(
                            "code-execution-started",
                            {
                                roomId,
                                userId,
                                userName:
                                    socket.data.userName ||
                                    userName ||
                                    "Anonymous",
                                language: language.slice(0, 30),
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Code execution start sync error ❌",
                            error
                        );
                    }
                }
            );

            socket.on(
                "code-execution-result",
                async (
                    data: CodeExecutionResultData
                ) => {
                    try {
                        const {
                            roomId,
                            userId,
                            userName,
                            language,
                            output,
                            error,
                            executionTime,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            !language ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId ||
                            typeof output !== "string" ||
                            typeof error !== "string"
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            }).select(
                                "owner participants status"
                            );

                        if (!room || room.status === "completed") {
                            return;
                        }

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        if (!isOwner && !isParticipant) {
                            return;
                        }

                        const safeExecutionTime =
                            typeof executionTime === "number" &&
                            Number.isFinite(executionTime) &&
                            executionTime >= 0
                                ? executionTime
                                : null;

                        socket.to(roomId).emit(
                            "code-execution-result",
                            {
                                roomId,
                                userId,
                                userName:
                                    socket.data.userName ||
                                    userName ||
                                    "Anonymous",
                                language: language.slice(0, 30),
                                output: output.slice(0, 30_000),
                                error: error.slice(0, 30_000),
                                executionTime:
                                    safeExecutionTime,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Code execution result sync error ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // TEST CASES
            // ==========================================

            socket.on(
                "test-cases-update",
                async (data: {
                    roomId: string;
                    userId: string;
                    testCases: Array<{
                        id: string;
                        input: string;
                        expectedOutput: string;
                    }>;
                }) => {
                    try {
                        const {
                            roomId,
                            userId,
                            testCases,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId ||
                            !Array.isArray(
                                testCases
                            ) ||
                            testCases.length > 20
                        ) {
                            return;
                        }

                        const sanitizedTestCases =
                            testCases
                                .filter(
                                    (testCase) =>
                                        testCase &&
                                        typeof testCase.id ===
                                            "string" &&
                                        typeof testCase.input ===
                                            "string" &&
                                        typeof testCase.expectedOutput ===
                                            "string"
                                )
                                .map(
                                    (
                                        testCase
                                    ) => ({
                                        id: testCase.id.slice(
                                            0,
                                            100
                                        ),
                                        input: testCase.input.slice(
                                            0,
                                            20_000
                                        ),
                                        expectedOutput:
                                            testCase.expectedOutput.slice(
                                                0,
                                                20_000
                                            ),
                                    })
                                );

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                        if (!room) {
                            return;
                        }

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        if (
                            !isParticipant &&
                            !isOwner
                        ) {
                            return;
                        }

                        if (
                            room.interviewMode &&
                            !isOwner
                        ) {
                            return;
                        }

                        if (room.status === "completed") {
                            return;
                        }

                        // Update only testCases atomically instead of saving the
                        // entire stale Mongoose document. Other room updates can
                        // change __v while this socket handler is running.
                        const updateResult = await Room.updateOne(
                            {
                                _id: room._id,
                                status: { $ne: "completed" },
                                $or: [
                                    { owner: userId },
                                    {
                                        participants: userId,
                                        interviewMode: { $ne: true },
                                    },
                                ],
                            },
                            {
                                $set: {
                                    testCases: sanitizedTestCases,
                                },
                            }
                        );

                        if (updateResult.matchedCount === 0) {
                            return;
                        }

                        io.to(roomId).emit(
                            "test-cases-update",
                            sanitizedTestCases
                        );
                    } catch (error) {
                        console.error(
                            "Failed to save test cases ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // CHAT MESSAGE
            // ==========================================

            socket.on(
                "send-chat-message",
                async (
                    data: ChatMessageData
                ) => {
                    try {
                        const {
                            roomId,
                            userId,
                            userName,
                            message,
                            replyTo,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            !userName ||
                            !message ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                        if (!room) {
                            return;
                        }

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        if (
                            !isParticipant &&
                            !isOwner
                        ) {
                            return;
                        }

                        const trimmedMessage =
                            message.trim();

                        if (
                            !trimmedMessage
                        ) {
                            return;
                        }

                        if (
                            trimmedMessage.length >
                            2000
                        ) {
                            return;
                        }

                        const safeReply =
                            replyTo &&
                            replyTo.messageId &&
                            replyTo.userId &&
                            replyTo.userName &&
                            typeof replyTo.message ===
                                "string"
                                ? {
                                      messageId:
                                          replyTo.messageId,
                                      userId:
                                          replyTo.userId,
                                      userName:
                                          replyTo.userName.slice(
                                              0,
                                              100
                                          ),
                                      message:
                                          replyTo.message.slice(
                                              0,
                                              2000
                                          ),
                                  }
                                : undefined;

                        const savedMessage =
                            await ChatMessage.create(
                                {
                                    roomId,
                                    userId,
                                    userName:
                                        userName.trim(),
                                    message:
                                        trimmedMessage,
                                    replyTo:
                                        safeReply,
                                }
                            );

                        const chatMessage = {
                            id: savedMessage._id.toString(),
                            userId:
                                savedMessage.userId.toString(),
                            userName:
                                savedMessage.userName,
                            message:
                                savedMessage.message,
                            timestamp:
                                savedMessage.createdAt.toISOString(),
                            reactions: [],
                            replyTo:
                                savedMessage.replyTo
                                    ? {
                                          messageId:
                                              savedMessage.replyTo.messageId,
                                          userId:
                                              savedMessage.replyTo.userId.toString(),
                                          userName:
                                              savedMessage.replyTo.userName,
                                          message:
                                              savedMessage.replyTo.message,
                                      }
                                    : undefined,
                        };

                        io.to(roomId).emit(
                            "chat-message",
                            chatMessage
                        );

                        console.log(
                            `${userName} sent a message in room ${roomId}`
                        );
                    } catch (error) {
                        console.error(
                            "Failed to save chat message ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // CHAT TYPING INDICATOR
            // ==========================================

            socket.on(
                "chat-typing",
                async (data: ChatTypingData) => {
                    try {
                        const {
                            roomId,
                            userId,
                            userName,
                            isTyping,
                        } = data;

                        if (
                            !roomId ||
                            !userId ||
                            !userName ||
                            typeof isTyping !==
                                "boolean" ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            }).select(
                                "owner participants"
                            );

                        if (!room) {
                            return;
                        }

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        if (!isOwner && !isParticipant) {
                            return;
                        }

                        socket.to(roomId).emit(
                            "chat-typing",
                            {
                                roomId,
                                userId,
                                userName: userName.trim().slice(
                                    0,
                                    100
                                ),
                                isTyping,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Failed to broadcast chat typing state ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // DELETE CHAT MESSAGE
            // ==========================================

            socket.on(
                "delete-chat-message",
                async (data: {
                    roomId: string;
                    messageId: string;
                    userId: string;
                }) => {
                    try {
                        const {
                            roomId,
                            messageId,
                            userId,
                        } = data;

                        if (
                            !roomId ||
                            !messageId ||
                            !userId ||
                            socket.data.userId !==
                                userId ||
                            socket.data.roomId !==
                                roomId
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                        if (!room) {
                            return;
                        }

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        if (
                            !isParticipant &&
                            !isOwner
                        ) {
                            return;
                        }

                        const message =
                            await ChatMessage.findOne(
                                {
                                    _id: messageId,
                                    roomId,
                                }
                            );

                        if (!message) {
                            return;
                        }

                        if (
                            message.userId.toString() !==
                            userId
                        ) {
                            return;
                        }

                        await ChatMessage.deleteOne(
                            {
                                _id: messageId,
                                roomId,
                            }
                        );

                        io.to(roomId).emit(
                            "chat-message-deleted",
                            {
                                messageId,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Failed to delete chat message ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // CHAT REACTION
            // ==========================================

            socket.on(
                "toggle-chat-reaction",
                async (
                    data: ChatReactionData
                ) => {
                    try {
                        const {
                            roomId,
                            messageId,
                            userId,
                            userName,
                            emoji,
                        } = data;

                        if (
                            !roomId ||
                            !messageId ||
                            !userId ||
                            !userName ||
                            socket.data.roomId !==
                                roomId ||
                            socket.data.userId !==
                                userId ||
                            !CHAT_REACTION_EMOJIS.includes(
                                emoji
                            )
                        ) {
                            return;
                        }

                        const room =
                            await Room.findOne({
                                roomId,
                            });

                        if (!room) {
                            return;
                        }

                        const isParticipant =
                            room.participants.some(
                                (participant) =>
                                    participant.toString() ===
                                    userId
                            );

                        const isOwner =
                            room.owner.toString() ===
                            userId;

                        if (
                            !isParticipant &&
                            !isOwner
                        ) {
                            return;
                        }

                        const message =
                            await ChatMessage.findOne(
                                {
                                    _id: messageId,
                                    roomId,
                                }
                            );

                        if (!message) {
                            return;
                        }

                        const existingIndex =
                            message.reactions.findIndex(
                                (reaction) =>
                                    reaction.userId.toString() ===
                                        userId &&
                                    reaction.emoji ===
                                        emoji
                            );

                        if (
                            existingIndex >= 0
                        ) {
                            message.reactions.splice(
                                existingIndex,
                                1
                            );
                        } else {
                            message.reactions.push(
                                {
                                    emoji,
                                    userId:
                                        new mongoose.Types.ObjectId(
                                            userId
                                        ),
                                    userName:
                                        userName.trim(),
                                }
                            );
                        }

                        await message.save();

                        const reactions =
                            message.reactions.map(
                                (reaction) => ({
                                    emoji:
                                        reaction.emoji,
                                    userId:
                                        reaction.userId.toString(),
                                    userName:
                                        reaction.userName,
                                })
                            );

                        io.to(roomId).emit(
                            "chat-reactions-updated",
                            {
                                messageId:
                                    message._id.toString(),
                                reactions,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Failed to update chat reaction ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // LEAVE ROOM
            // ==========================================

            socket.on(
                "leave-room",
                async (data?: {
                    roomId?: string;
                    userId?: string;
                    userName?: string;
                }) => {
                    const roomId =
                        data?.roomId ||
                        socket.data.roomId;

                    const userId =
                        data?.userId ||
                        socket.data.userId;

                    const userName =
                        data?.userName ||
                        socket.data.userName;

                    if (!roomId) {
                        return;
                    }

                    if (userId) {
                        socket
                            .to(roomId)
                            .emit(
                                "chat-typing",
                                {
                                    roomId,
                                    userId,
                                    userName:
                                        userName ||
                                        "Anonymous",
                                    isTyping: false,
                                }
                            );
                    }

                    socket
                        .to(roomId)
                        .emit(
                            "user-left",
                            {
                                userId,
                                userName,
                            }
                        );

                    socket.leave(
                        roomId
                    );

                    if (
                        socket.data.roomId ===
                        roomId
                    ) {
                        socket.data.roomId =
                            undefined;
                    }

                    await broadcastRoomParticipants(
                        io,
                        roomId
                    );

                    console.log(
                        `${userName || "User"} left room ${roomId}`
                    );
                }
            );

            // ==========================================
            // ROOM FILE COLLABORATION
            // ==========================================

            socket.on(
                "join-room-file",
                async (
                    data: RoomFileJoinData
                ) => {
                    try {
                        const {
                            roomId,
                            fileId,
                            userId,
                            userName,
                        } = data;

                        /*
                         * IMPORTANT:
                         *
                         * Do NOT require:
                         *
                         * socket.data.roomId === roomId
                         *
                         * here.
                         *
                         * join-room performs an async database
                         * lookup before socket.data.roomId is set.
                         * The frontend can therefore send
                         * join-room-file immediately after joining.
                         *
                         * authorizeRoomFile independently verifies:
                         * - authenticated user
                         * - room membership
                         * - room status
                         * - file ownership by room
                         */
                        if (
                            !roomId ||
                            !fileId ||
                            !userId ||
                            socket.data.userId !==
                                userId
                        ) {
                            return;
                        }

                        const authorized =
                            await authorizeRoomFile(
                                userId,
                                roomId,
                                fileId
                            );

                        if (!authorized) {
                            return;
                        }

                        const fileRoom =
                            getRoomFileRoom(
                                roomId,
                                fileId
                            );

                        /*
                         * Leave the previous room-file room
                         * if this socket was editing another file.
                         */
                        if (
                            socket.data.roomFileRoom
                        ) {
                            socket
                                .to(
                                    socket.data
                                        .roomFileRoom
                                )
                                .emit(
                                    "room-file-user-left",
                                    {
                                        userId:
                                            socket.data
                                                .roomFileUserId,
                                        userName:
                                            socket.data
                                                .roomFileUserName ||
                                            "Anonymous",
                                        fileId:
                                            socket.data
                                                .roomFileId,
                                    }
                                );

                            socket.leave(
                                socket.data
                                    .roomFileRoom
                            );
                        }

                        socket.join(
                            fileRoom
                        );

                        socket.data.roomFileRoom =
                            fileRoom;

                        socket.data.roomFileRoomId =
                            roomId;

                        socket.data.roomFileId =
                            fileId;

                        socket.data.roomFileUserId =
                            userId;

                        socket.data.roomFileUserName =
                            userName ||
                            "Anonymous";

                        /*
                         * Send the current file-room users
                         * to the newly joined socket.
                         */
                        try {
                            const sockets =
                                await io
                                    .in(fileRoom)
                                    .fetchSockets();

                            for (
                                const existingSocket of sockets
                            ) {
                                if (
                                    existingSocket.id ===
                                    socket.id
                                ) {
                                    continue;
                                }

                                if (
                                    existingSocket
                                        .data
                                        .roomFileUserId
                                ) {
                                    socket.emit(
                                        "room-file-user-joined",
                                        {
                                            userId:
                                                existingSocket
                                                    .data
                                                    .roomFileUserId,
                                            userName:
                                                existingSocket
                                                    .data
                                                    .roomFileUserName ||
                                                "Anonymous",
                                            fileId,
                                        }
                                    );
                                }
                            }
                        } catch (error) {
                            console.error(
                                "Failed to fetch room file users:",
                                error
                            );
                        }

                        socket
                            .to(fileRoom)
                            .emit(
                                "room-file-user-joined",
                                {
                                    userId,
                                    userName:
                                        userName ||
                                        "Anonymous",
                                    fileId,
                                }
                            );

                        /*
                         * Explicit acknowledgement for the client.
                         * The client uses this to know that the socket is
                         * actually inside the file room before publishing
                         * cursor/code updates.
                         */
                        socket.emit(
                            "room-file-joined",
                            {
                                roomId,
                                fileId,
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Failed to join room file ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // ROOM FILE CODE CHANGE
            // ==========================================

            socket.on(
                "room-file-code-change",
                async (
                    data: RoomFileCodeChangeData
                ) => {
                    try {
                        if (
                            !data.roomId ||
                            !data.fileId ||
                            typeof data.code !==
                                "string" ||
                            socket.data.roomFileRoomId !==
                                data.roomId ||
                            socket.data.roomFileId !==
                                data.fileId ||
                            socket.data.userId !==
                                socket.data.roomFileUserId
                        ) {
                            return;
                        }

                        /*
                         * The editor sends two kinds of updates:
                         *
                         * 1. Live preview:
                         *    version is omitted so other users receive
                         *    the keystroke immediately.
                         *
                         * 2. Persisted update:
                         *    version is present after the HTTP save and
                         *    must match MongoDB's current version.
                         *
                         * This keeps realtime typing fast while the
                         * database remains authoritative.
                         */
                        const hasVersion =
                            typeof data.version ===
                                "number" &&
                            Number.isInteger(
                                data.version
                            ) &&
                            data.version >= 1;

                        if (
                            data.version !==
                                undefined &&
                            !hasVersion
                        ) {
                            return;
                        }

                        const userId =
                            socket.data.userId;

                        if (!userId) {
                            return;
                        }

                        const authorized =
                            await authorizeRoomFile(
                                userId,
                                data.roomId,
                                data.fileId
                            );

                        if (!authorized) {
                            return;
                        }

                        /*
                         * A versioned update is authoritative and must
                         * match MongoDB before it is broadcast.
                         *
                         * An unversioned update is a live typing preview.
                         * It is deliberately broadcast immediately and
                         * does not change or advance the database version.
                         */
                        if (hasVersion) {
                            const file =
                                await RoomFile.findOne({
                                    _id: data.fileId,
                                    roomId: data.roomId,
                                }).select(
                                    "version"
                                );

                            if (!file) {
                                return;
                            }

                            if (
                                file.version !==
                                data.version
                            ) {
                                return;
                            }
                        }

                        socket
                            .to(
                                getRoomFileRoom(
                                    data.roomId,
                                    data.fileId
                                )
                            )
                            .emit(
                                "room-file-code-update",
                                {
                                    roomId:
                                        data.roomId,
                                    fileId:
                                        data.fileId,
                                    code:
                                        data.code,
                                    ...(hasVersion
                                        ? {
                                              version:
                                                  data.version,
                                          }
                                        : {}),
                                }
                            );
                    } catch (error) {
                        console.error(
                            "Room file code sync error ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================

            // ROOM FILE CURSOR CHANGE
            // ==========================================

            socket.on(
                "room-file-cursor-change",
                async (
                    data: RoomFileCursorChangeData
                ) => {
                    try {
                        if (
                            !data.roomId ||
                            !data.fileId ||
                            !data.userId ||
                            typeof data.userName !==
                                "string" ||
                            !Number.isInteger(
                                data.lineNumber
                            ) ||
                            !Number.isInteger(
                                data.column
                            ) ||
                            data.lineNumber < 1 ||
                            data.column < 1 ||
                            socket.data.userId !==
                                data.userId ||
                            socket.data.roomFileRoomId !==
                                data.roomId ||
                            socket.data.roomFileId !==
                                data.fileId ||
                            socket.data.roomFileUserId !==
                                data.userId
                        ) {
                            return;
                        }

                        const authorized =
                            await authorizeRoomFile(
                                data.userId,
                                data.roomId,
                                data.fileId
                            );

                        if (!authorized) {
                            return;
                        }

                        socket
                            .to(
                                getRoomFileRoom(
                                    data.roomId,
                                    data.fileId
                                )
                            )
                            .emit(
                                "room-file-cursor-update",
                                {
                                    roomId:
                                        data.roomId,
                                    fileId:
                                        data.fileId,
                                    userId:
                                        data.userId,
                                    userName:
                                        data.userName.slice(
                                            0,
                                            100
                                        ),
                                    lineNumber:
                                        data.lineNumber,
                                    column:
                                        data.column,
                                }
                            );
                    } catch (error) {
                        console.error(
                            "Room file cursor sync error ❌",
                            error
                        );
                    }
                }
            );

            // ==========================================
            // LEAVE ROOM FILE
            // ==========================================

            socket.on(
                "leave-room-file",
                (
                    data?: {
                        roomId?: string;
                        fileId?: string;
                    }
                ) => {
                    const fileRoom =
                        socket.data.roomFileRoom;

                    if (!fileRoom) {
                        return;
                    }

                    socket
                        .to(fileRoom)
                        .emit(
                            "room-file-user-left",
                            {
                                userId:
                                    socket.data
                                        .roomFileUserId,
                                userName:
                                    socket.data
                                        .roomFileUserName ||
                                    "Anonymous",
                                fileId:
                                    data?.fileId ||
                                    socket.data
                                        .roomFileId,
                            }
                        );

                    socket.leave(
                        fileRoom
                    );

                    socket.data.roomFileRoom =
                        undefined;

                    socket.data.roomFileRoomId =
                        undefined;

                    socket.data.roomFileId =
                        undefined;

                    socket.data.roomFileUserId =
                        undefined;

                    socket.data.roomFileUserName =
                        undefined;
                }
            );

            // ==========================================
            // JOIN PROJECT FILE
            // ==========================================

            socket.on(
                "join-file",
                async (
                    data: FileJoinData
                ) => {
                    const {
                        projectId,
                        fileId,
                        userId,
                        userName,
                    } = data;

                    if (
                        !projectId ||
                        !fileId ||
                        !userId ||
                        socket.data.userId !==
                            userId
                    ) {
                        return;
                    }

                    const authorized =
                        await authorizeProjectFile(
                            userId,
                            projectId,
                            fileId
                        );

                    if (!authorized) {
                        return;
                    }

                    const fileRoom =
                        getFileRoom(
                            projectId,
                            fileId
                        );

                    if (
                        socket.data.fileRoom
                    ) {
                        socket.leave(
                            socket.data.fileRoom
                        );
                    }

                    socket.join(
                        fileRoom
                    );

                    socket.data.fileRoom =
                        fileRoom;

                    socket.data.fileProjectId =
                        projectId;

                    socket.data.fileId =
                        fileId;

                    socket.data.fileUserId =
                        userId;

                    socket.data.fileUserName =
                        userName;

                    try {
                        const sockets =
                            await io
                                .in(fileRoom)
                                .fetchSockets();

                        for (
                            const existingSocket of sockets
                        ) {
                            if (
                                existingSocket.id ===
                                socket.id
                            ) {
                                continue;
                            }

                            if (
                                existingSocket
                                    .data
                                    .fileUserId
                            ) {
                                socket.emit(
                                    "file-user-joined",
                                    {
                                        userId:
                                            existingSocket
                                                .data
                                                .fileUserId,
                                        userName:
                                            existingSocket
                                                .data
                                                .fileUserName ||
                                            "Anonymous",
                                        fileId,
                                    }
                                );
                            }
                        }
                    } catch (error) {
                        console.error(
                            "Failed to fetch file users:",
                            error
                        );
                    }

                    socket
                        .to(fileRoom)
                        .emit(
                            "file-user-joined",
                            {
                                userId,
                                userName,
                                fileId,
                            }
                        );

                    console.log(
                        `${userName} joined file ${fileId}`
                    );
                }
            );

            // ==========================================
            // PROJECT FILE CODE CHANGE
            // ==========================================

            socket.on(
                "file-code-change",
                async (
                    data: FileCodeChangeData
                ) => {
                    if (
                        !data.projectId ||
                        !data.fileId ||
                        typeof data.code !==
                            "string" ||
                        socket.data.fileProjectId !==
                            data.projectId ||
                        socket.data.fileId !==
                            data.fileId ||
                        !socket.data.fileUserId ||
                        socket.data.userId !==
                            socket.data.fileUserId
                    ) {
                        return;
                    }

                    const authorized =
                        await authorizeProjectFile(
                            socket.data.userId,
                            data.projectId,
                            data.fileId
                        );

                    if (!authorized) {
                        return;
                    }

                    const fileRoom =
                        getFileRoom(
                            data.projectId,
                            data.fileId
                        );

                    socket
                        .to(fileRoom)
                        .emit(
                            "file-code-update",
                            {
                                projectId:
                                    data.projectId,
                                fileId:
                                    data.fileId,
                                code:
                                    data.code,
                            }
                        );
                }
            );

            // ==========================================
            // PROJECT FILE LIVE CURSOR
            // ==========================================

            socket.on(
                "file-cursor-change",
                async (
                    data: FileCursorChangeData
                ) => {
                    if (
                        !data.projectId ||
                        !data.fileId ||
                        !data.userId ||
                        socket.data.fileProjectId !==
                            data.projectId ||
                        socket.data.fileId !==
                            data.fileId ||
                        socket.data.fileUserId !==
                            data.userId ||
                        socket.data.userId !==
                            data.userId
                    ) {
                        return;
                    }

                    const authorized =
                        await authorizeProjectFile(
                            data.userId,
                            data.projectId,
                            data.fileId
                        );

                    if (!authorized) {
                        return;
                    }

                    const fileRoom =
                        getFileRoom(
                            data.projectId,
                            data.fileId
                        );

                    socket
                        .to(fileRoom)
                        .emit(
                            "file-cursor-update",
                            {
                                projectId:
                                    data.projectId,
                                fileId:
                                    data.fileId,
                                userId:
                                    data.userId,
                                userName:
                                    data.userName,
                                lineNumber:
                                    data.lineNumber,
                                column:
                                    data.column,
                            }
                        );
                }
            );

            // ==========================================
            // LEAVE PROJECT FILE
            // ==========================================

            socket.on(
                "leave-file",
                (
                    data: LeaveFileData
                ) => {
                    if (
                        !data?.projectId ||
                        !data?.fileId ||
                        !data?.userId ||
                        socket.data.userId !==
                            data.userId ||
                        socket.data.fileProjectId !==
                            data.projectId ||
                        socket.data.fileId !==
                            data.fileId ||
                        socket.data.fileUserId !==
                            data.userId
                    ) {
                        return;
                    }

                    const fileRoom =
                        getFileRoom(
                            data.projectId,
                            data.fileId
                        );

                    socket
                        .to(fileRoom)
                        .emit(
                            "file-user-left",
                            {
                                userId:
                                    data.userId,
                                userName:
                                    data.userName,
                                fileId:
                                    data.fileId,
                            }
                        );

                    socket.leave(
                        fileRoom
                    );

                    if (
                        socket.data.fileRoom ===
                        fileRoom
                    ) {
                        socket.data.fileRoom =
                            undefined;

                        socket.data.fileId =
                            undefined;

                        socket.data.fileUserId =
                            undefined;

                        socket.data.fileUserName =
                            undefined;
                    }

                    console.log(
                        `${data.userName} left file ${data.fileId}`
                    );
                }
            );

            // ==========================================
            // DISCONNECT
            // ==========================================

            socket.on(
                "disconnect",
                async () => {
                    const roomFileRoom =
                        socket.data.roomFileRoom;

                    if (
                        roomFileRoom
                    ) {
                        socket
                            .to(roomFileRoom)
                            .emit(
                                "room-file-user-left",
                                {
                                    userId:
                                        socket.data
                                            .roomFileUserId,
                                    userName:
                                        socket.data
                                            .roomFileUserName ||
                                        "Anonymous",
                                    fileId:
                                        socket.data
                                            .roomFileId,
                                }
                            );
                    }

                    const fileRoom =
                        socket.data.fileRoom;

                    const fileId =
                        socket.data.fileId;

                    const fileUserId =
                        socket.data.fileUserId;

                    const fileUserName =
                        socket.data.fileUserName;

                    if (
                        fileRoom &&
                        fileId &&
                        fileUserId
                    ) {
                        socket
                            .to(fileRoom)
                            .emit(
                                "file-user-left",
                                {
                                    userId:
                                        fileUserId,
                                    userName:
                                        fileUserName ||
                                        "Anonymous",
                                    fileId,
                                }
                            );
                    }

                    const roomId =
                        socket.data.roomId;

                    const roomUserId =
                        socket.data.userId;

                    const roomUserName =
                        socket.data.userName;

                    if (
                        roomId &&
                        roomUserId
                    ) {
                        socket
                            .to(roomId)
                            .emit(
                                "chat-typing",
                                {
                                    roomId,
                                    userId: roomUserId,
                                    userName:
                                        roomUserName ||
                                        "Anonymous",
                                    isTyping: false,
                                }
                            );

                        socket
                            .to(roomId)
                            .emit(
                                "user-left",
                                {
                                    userId:
                                        roomUserId,
                                    userName:
                                        roomUserName ||
                                        "Anonymous",
                                }
                            );

                        // Socket.IO removes a disconnected socket
                        // from its rooms. fetchSockets() therefore
                        // gives us the remaining online users.
                        await broadcastRoomParticipants(
                            io,
                            roomId
                        );
                    }

                    console.log(
                        "Socket disconnected:",
                        socket.id
                    );
                }
            );
        }
    );

    console.log(
        "Socket.IO event handlers initialized 🔥"
    );

    return io;
};