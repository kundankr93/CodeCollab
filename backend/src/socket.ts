import { Server, Socket } from "socket.io";

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

const getFileRoom = (
    projectId: string,
    fileId: string
): string => {
    return `project:${projectId}:file:${fileId}`;
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
                (data: {
                    roomId: string;
                    userId: string;
                    userName: string;
                }) => {
                    const {
                        roomId,
                        userId,
                        userName,
                    } = data;

                    if (!roomId) {
                        return;
                    }

                    socket.join(roomId);

                    socket.data.roomId =
                        roomId;

                    socket.data.userId =
                        userId;

                    socket.data.userName =
                        userName;

                    socket.to(roomId).emit(
                        "user-joined",
                        {
                            userId,
                            userName,
                        }
                    );

                    console.log(
                        `${userName} joined room ${roomId}`
                    );
                }
            );

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

            socket.on(
                "leave-room",
                (data: {
                    roomId: string;
                    userId: string;
                    userName: string;
                }) => {
                    if (!data.roomId) {
                        return;
                    }

                    socket
                        .to(data.roomId)
                        .emit(
                            "user-left",
                            {
                                userId:
                                    data.userId,
                                userName:
                                    data.userName,
                            }
                        );

                    socket.leave(
                        data.roomId
                    );

                    socket.data.roomId =
                        undefined;
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

                    // Leave previous file room
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

                    // Send existing users
                    // to the newly joined user.
                    try {
                        const sockets =
                            await io
                                .in(fileRoom)
                                .fetchSockets();

                        for (
                            const existingSocket
                            of sockets
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
                    } catch (
                        error
                    ) {
                        console.error(
                            "Failed to fetch file users:",
                            error
                        );
                    }

                    // Notify existing users
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
                () => {
                    const fileRoom =
                        socket.data.fileRoom;

                    const fileId =
                        socket.data.fileId;

                    const userId =
                        socket.data.fileUserId;

                    const userName =
                        socket.data.fileUserName;

                    if (
                        fileRoom &&
                        fileId &&
                        userId
                    ) {
                        socket
                            .to(fileRoom)
                            .emit(
                                "file-user-left",
                                {
                                    userId,
                                    userName:
                                        userName ||
                                        "Anonymous",
                                    fileId,
                                }
                            );
                    }

                    const roomId =
                        socket.data.roomId;

                    if (
                        roomId &&
                        userId
                    ) {
                        socket
                            .to(roomId)
                            .emit(
                                "user-left",
                                {
                                    userId,
                                    userName:
                                        userName ||
                                        "Anonymous",
                                }
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