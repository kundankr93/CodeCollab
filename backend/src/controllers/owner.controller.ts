import { Response } from "express";

import type { AuthRequest } from "../middleware/auth.middleware.js";

import { User } from "../models/User.js";
import { Room } from "../models/Room.js";
import { RoomFile } from "../models/RoomFile.js";
import { ChatMessage } from "../models/ChatMessage.js";

type EditableRole =
    | "student"
    | "interviewer"
    | "admin";

type RoomStatus =
    | "waiting"
    | "active"
    | "completed";

// ==========================================
// GET ALL USERS
// ==========================================

export const getAllUsers = async (
    _req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const users = await User.find()
            .select(
                "_id name email role createdAt updatedAt"
            )
            .sort({
                createdAt: -1,
            });

        res.status(200).json({
            success: true,
            count: users.length,
            users: users.map((user) => ({
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })),
        });
    } catch (error) {
        console.error(
            "Get all users error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// UPDATE USER ROLE
// ==========================================

export const updateUserRole = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId } = req.params;
        const { role } = req.body as {
            role?: EditableRole;
        };

        if (!userId) {
            res.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }

        if (
            !role ||
            ![
                "student",
                "interviewer",
                "admin",
            ].includes(role)
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Invalid role. Allowed roles are student, interviewer, and admin.",
            });
            return;
        }

        const targetUser =
            await User.findById(userId);

        if (!targetUser) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        if (targetUser.role === "owner") {
            res.status(403).json({
                success: false,
                message:
                    "The owner role cannot be changed.",
            });
            return;
        }

        targetUser.role = role;

        await targetUser.save();

        res.status(200).json({
            success: true,
            message: "User role updated successfully",
            user: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
            },
        });
    } catch (error) {
        console.error(
            "Update user role error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// DELETE USER
// ==========================================

export const deleteUser = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId } = req.params;

        if (!userId) {
            res.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }

        if (req.userId === userId) {
            res.status(400).json({
                success: false,
                message:
                    "The owner cannot delete their own account from the owner dashboard.",
            });
            return;
        }

        const targetUser =
            await User.findById(userId);

        if (!targetUser) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        if (targetUser.role === "owner") {
            res.status(403).json({
                success: false,
                message:
                    "The owner account cannot be deleted.",
            });
            return;
        }

        // Do not allow an account with owned rooms
        // to be deleted, because Room.owner is required.
        const ownedRoomCount =
            await Room.countDocuments({
                owner: targetUser._id,
            });

        if (ownedRoomCount > 0) {
            res.status(409).json({
                success: false,
                message:
                    "This user owns coding rooms. Reassign or remove those rooms before deleting the user.",
                ownedRoomCount,
            });
            return;
        }

        // Remove the user from participant lists.
        await Room.updateMany(
            {
                participants: targetUser._id,
            },
            {
                $pull: {
                    participants: targetUser._id,
                },
            }
        );

        await User.deleteOne({
            _id: targetUser._id,
        });

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
            userId,
        });
    } catch (error) {
        console.error(
            "Delete user error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// GET ALL ROOMS
// ==========================================

export const getAllRooms = async (
    _req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const rooms = await Room.find()
            .select(
                "_id roomId name owner participants language status createdAt updatedAt"
            )
            .populate(
                "owner",
                "_id name email"
            )
            .populate(
                "participants",
                "_id name email"
            )
            .sort({
                createdAt: -1,
            });

        res.status(200).json({
            success: true,
            count: rooms.length,
            rooms: rooms.map((room: any) => ({
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                language: room.language,
                status: room.status,
                owner: room.owner
                    ? {
                        id: room.owner._id,
                        name: room.owner.name,
                        email: room.owner.email,
                    }
                    : null,
                participants:
                    Array.isArray(
                        room.participants
                    )
                        ? room.participants.map(
                            (participant: any) => ({
                                id:
                                    participant._id,
                                name:
                                    participant.name,
                                email:
                                    participant.email,
                            })
                        )
                        : [],
                participantCount:
                    Array.isArray(
                        room.participants
                    )
                        ? room.participants.length
                        : 0,
                createdAt:
                    room.createdAt,
                updatedAt:
                    room.updatedAt,
            })),
        });
    } catch (error) {
        console.error(
            "Get all rooms error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// GET ROOM DETAILS
// ==========================================
//
// Returns the complete owner-level snapshot for
// one room:
// - room metadata
// - owner
// - participants
// - current online participant count
// - current code
// - test cases
// - interview settings
// - saved room files (metadata only)
// - recent chat messages
//
// File contents are intentionally not returned for
// every file because a room can contain many large
// files. The main Room.code is returned separately.
// ==========================================

export const getRoomDetails = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!roomId) {
            res.status(400).json({
                success: false,
                message: "Room ID is required",
            });
            return;
        }

        const room = await Room.findOne({
            roomId,
        })
            .populate(
                "owner",
                "_id name email role"
            )
            .populate(
                "participants",
                "_id name email role"
            );

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });
            return;
        }

        const [
            roomFiles,
            chatMessages,
        ] = await Promise.all([
            RoomFile.find({
                roomId: room.roomId,
            })
                .select(
                    "_id name path language size createdAt updatedAt"
                )
                .sort({
                    path: 1,
                }),

            ChatMessage.find({
                roomId: room.roomId,
            })
                .sort({
                    createdAt: -1,
                })
                .limit(50),
        ]);

        let onlineParticipantCount = 0;

        const io = req.app.get("io");

        if (io) {
            try {
                const sockets =
                    await io.fetchSockets();

                const participantIds =
                    new Set(
                        (
                            room.participants as any[]
                        ).map((participant: any) =>
                            String(
                                participant._id ||
                                participant.id
                            )
                        )
                    );

                for (const socket of sockets) {
                    if (
                        socket.data?.roomId !==
                        room.roomId
                    ) {
                        continue;
                    }

                    const socketUserId =
                        socket.data?.userId;

                    if (
                        socketUserId &&
                        participantIds.has(
                            String(socketUserId)
                        )
                    ) {
                        onlineParticipantCount++;
                    }
                }
            } catch (socketError) {
                console.error(
                    "Failed to calculate room online count:",
                    socketError
                );
            }
        }

        const owner: any =
            room.owner;

        const participants: any[] =
            Array.isArray(
                room.participants
            )
                ? room.participants
                : [];

        res.status(200).json({
            success: true,

            room: {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                language: room.language,
                status: room.status,

                owner: owner
                    ? {
                        id: owner._id,
                        name: owner.name,
                        email: owner.email,
                        role: owner.role,
                    }
                    : null,

                participants:
                    participants.map(
                        (participant: any) => ({
                            id:
                                participant._id,
                            name:
                                participant.name,
                            email:
                                participant.email,
                            role:
                                participant.role,
                        })
                    ),

                participantCount:
                    participants.length,

                onlineParticipantCount,

                code:
                    typeof room.code ===
                    "string"
                        ? room.code
                        : "",

                testCases:
                    Array.isArray(
                        room.testCases
                    )
                        ? room.testCases
                        : [],

                interviewMode:
                    Boolean(
                        room.interviewMode
                    ),

                interviewDurationMinutes:
                    Number(
                        room.interviewDurationMinutes ||
                            60
                    ),

                interviewStartedAt:
                    room.interviewStartedAt ||
                    null,

                createdAt:
                    room.createdAt,

                updatedAt:
                    room.updatedAt,
            },

            files: roomFiles.map(
                (file) => ({
                    id: file._id,
                    name: file.name,
                    path: file.path,
                    language:
                        file.language ||
                        null,
                    size:
                        file.size ||
                        0,
                    createdAt:
                        file.createdAt,
                    updatedAt:
                        file.updatedAt,
                })
            ),

            chatMessages:
                chatMessages
                    .reverse()
                    .map(
                        (message) => ({
                            id:
                                message._id,
                            userId:
                                message.userId,
                            userName:
                                message.userName,
                            message:
                                message.message,
                            reactions:
                                message.reactions ||
                                [],
                            createdAt:
                                message.createdAt,
                        })
                    ),
        });
    } catch (error) {
        console.error(
            "Get room details error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// UPDATE ROOM STATUS
// ==========================================

export const updateRoomStatus = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;
        const { status } = req.body as {
            status?: RoomStatus;
        };

        if (!roomId) {
            res.status(400).json({
                success: false,
                message: "Room ID is required",
            });
            return;
        }

        if (
            !status ||
            ![
                "waiting",
                "active",
                "completed",
            ].includes(status)
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Invalid room status. Allowed statuses are waiting, active, and completed.",
            });
            return;
        }

        const room =
            await Room.findOne({
                roomId,
            });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });
            return;
        }

        room.status = status;

        // A manually completed room should no longer
        // retain interview start state.
        if (status === "completed") {
            if ("interviewStartedAt" in room) {
                room.interviewStartedAt = null;
            }
        }

        await room.save();

        res.status(200).json({
            success: true,
            message:
                "Room status updated successfully",
            room: {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                language: room.language,
                status: room.status,
                updatedAt: room.updatedAt,
            },
        });
    } catch (error) {
        console.error(
            "Update room status error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// DELETE ROOM
// ==========================================

export const deleteRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!roomId) {
            res.status(400).json({
                success: false,
                message: "Room ID is required",
            });
            return;
        }

        const room =
            await Room.findOne({
                roomId,
            });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });
            return;
        }

        await Room.deleteOne({
            _id: room._id,
        });

        res.status(200).json({
            success: true,
            message: "Room deleted successfully",
            roomId,
        });
    } catch (error) {
        console.error(
            "Delete room error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// REMOVE ROOM PARTICIPANT
// ==========================================

export const removeRoomParticipant = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId, userId } = req.params;

        if (!roomId || !userId) {
            res.status(400).json({
                success: false,
                message: "Room ID and participant ID are required",
            });
            return;
        }

        const room = await Room.findOne({ roomId });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });
            return;
        }

        const ownerId = room.owner.toString();

        // The owner cannot remove themself.
        if (userId === ownerId || userId === req.userId) {
            res.status(400).json({
                success: false,
                message: "The room owner cannot be removed",
            });
            return;
        }

        const isParticipant = room.participants.some(
            (participant) => participant.toString() === userId
        );

        if (!isParticipant) {
            res.status(404).json({
                success: false,
                message: "Participant not found in this room",
            });
            return;
        }

        const participant = await User.findById(userId).select(
            "_id name email"
        );

        if (!participant) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // Remove the participant from room membership.
        room.participants = room.participants.filter(
            (participantId) => participantId.toString() !== userId
        );

        await room.save();

        const io = req.app.get("io") as any;

        if (io) {
            // Notify and disconnect this user's active room sockets.
            const roomSockets = await io.in(roomId).fetchSockets();

            for (const socket of roomSockets) {
                if (String(socket.data?.userId) === userId) {
                    socket.emit("room-participant-removed", {
                        roomId,
                        message: "You have been removed from this room.",
                    });

                    await socket.leave(roomId);
                    socket.data.roomId = null;
                }
            }

            // Build the updated participant list, including offline users.
            const updatedRoom = await Room.findOne({ roomId }).select(
                "owner participants"
            );

            if (updatedRoom) {
                const memberIds = new Set<string>([
                    updatedRoom.owner.toString(),
                    ...updatedRoom.participants.map((id) => id.toString()),
                ]);

                const users = await User.find({
                    _id: { $in: Array.from(memberIds) },
                }).select("_id name");

                const remainingSockets = await io.in(roomId).fetchSockets();

                const onlineUserIds = new Set<string>();

                for (const socket of remainingSockets) {
                    if (socket.data?.userId) {
                        onlineUserIds.add(String(socket.data.userId));
                    }
                }

                const participants = users.map((user) => {
                    const id = user._id.toString();

                    return {
                        userId: id,
                        userName: user.name,
                        online: onlineUserIds.has(id),
                    };
                });

                io.to(roomId).emit("room-participants", participants);
            }
        }

        res.status(200).json({
            success: true,
            message: "Participant removed from room successfully",
            roomId,
            userId,
        });
    } catch (error) {
        console.error("Remove room participant error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
