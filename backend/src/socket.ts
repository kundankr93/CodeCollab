import mongoose from "mongoose";
import { Server, Socket } from "socket.io";

import { ChatMessage } from "./models/ChatMessage.js";

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
}

const getFileRoom = (
    projectId: string,
    fileId: string
): string => {
    return `project:${projectId}:file:${fileId}`;
};

const getRoomParticipants = async (
    io: Server,
    roomId: string
): Promise<RoomParticipant[]> => {
    const sockets = await io
        .in(roomId)
        .fetchSockets();

    const participantMap = new Map<
        string,
        RoomParticipant
    >();

    for (const roomSocket of sockets) {
        const userId = roomSocket.data.userId;
        const userName = roomSocket.data.userName;

        if (!userId) {
            continue;
        }

        if (!participantMap.has(userId)) {
            participantMap.set(userId, {
                userId,
                userName: userName || "Anonymous",
            });
        }
    }

    return Array.from(
        participantMap.values()
    );
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
    } catch (error) {
        console.error(
            "Failed to update room participants:",
            error
        );
    }
};

export const initializeSocket = (
    io: Server
): Server => {
    io.on(
        "connection",
        (socket: Socket) => {
            console.log(
                "Socket connected:",
                socket.id
            );

            // ==========================================
            // CODING ROOM
            // ==========================================

            socket.on(
                "join-room",
                async (data: {
                    roomId: string;
                    userId: string;
                    userName: string;
                }) => {
                    const {
                        roomId,
                        userId,
                        userName,
                    } = data;

                    if (
                        !roomId ||
                        !userId
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

                    socket.data.userId =
                        userId;

                    socket.data.userName =
                        userName ||
                        "Anonymous";

                    socket
                        .to(roomId)
                        .emit(
                            "user-joined",
                            {
                                userId,
                                userName:
                                    userName ||
                                    "Anonymous",
                            }
                        );

                    await broadcastRoomParticipants(
                        io,
                        roomId
                    );

                    console.log(
                        `${userName} joined room ${roomId}`
                    );
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
                    if (!data.roomId) {
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
                            !message
                        ) {
                            return;
                        }

                        const trimmedMessage =
                            message.trim();

                        if (!trimmedMessage) {
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
                            typeof replyTo.message === "string"
                                ? {
                                      messageId: replyTo.messageId,
                                      userId: replyTo.userId,
                                      userName: replyTo.userName.slice(0, 100),
                                      message: replyTo.message.slice(0, 2000),
                                  }
                                : undefined;

                        const savedMessage =
                            await ChatMessage.create({
                                roomId,
                                userId,
                                userName:
                                    userName.trim(),
                                message:
                                    trimmedMessage,
                                replyTo: safeReply,
                            });

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
                            replyTo: savedMessage.replyTo
                                ? {
                                      messageId: savedMessage.replyTo.messageId,
                                      userId: savedMessage.replyTo.userId.toString(),
                                      userName: savedMessage.replyTo.userName,
                                      message: savedMessage.replyTo.message,
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
                            socket.data.userId !== userId ||
                            socket.data.roomId !== roomId
                        ) {
                            return;
                        }

                        const message =
                            await ChatMessage.findOne({
                                _id: messageId,
                                roomId,
                            });

                        if (!message) {
                            return;
                        }

                        if (message.userId.toString() !== userId) {
                            return;
                        }

                        await ChatMessage.deleteOne({
                            _id: messageId,
                            roomId,
                        });

                        io.to(roomId).emit(
                            "chat-message-deleted",
                            { messageId }
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
                            !CHAT_REACTION_EMOJIS.includes(
                                emoji
                            )
                        ) {
                            return;
                        }

                        const message =
                            await ChatMessage.findOne({
                                _id: messageId,
                                roomId,
                            });

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

                        if (existingIndex >= 0) {
                            message.reactions.splice(
                                existingIndex,
                                1
                            );
                        } else {
                            // One reaction of the same emoji
                            // per user on a message.
                            message.reactions.push({
                                emoji,
                                userId:
                                    new (
                                        mongoose.Types.ObjectId
                                    )(userId),
                                userName:
                                    userName.trim(),
                            });
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

                    socket
                        .to(roomId)
                        .emit(
                            "user-left",
                            {
                                userId,
                                userName,
                            }
                        );

                    socket.leave(roomId);

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
            // JOIN FILE
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
                        !userId
                    ) {
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

                    socket.join(fileRoom);

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

                        for (const existingSocket of sockets) {
                            if (
                                existingSocket.id ===
                                socket.id
                            ) {
                                continue;
                            }

                            if (
                                existingSocket.data
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
            // FILE CODE CHANGE
            // ==========================================

            socket.on(
                "file-code-change",
                (
                    data: FileCodeChangeData
                ) => {
                    if (
                        !data.projectId ||
                        !data.fileId
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
            // LIVE CURSOR
            // ==========================================

            socket.on(
                "file-cursor-change",
                (
                    data: FileCursorChangeData
                ) => {
                    if (
                        !data.projectId ||
                        !data.fileId ||
                        !data.userId
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
            // LEAVE FILE
            // ==========================================

            socket.on(
                "leave-file",
                (
                    data: LeaveFileData
                ) => {
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

                    socket.leave(fileRoom);

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
