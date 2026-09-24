import mongoose from "mongoose";
import { Response } from "express";
import { v4 as uuidv4 } from "uuid";

import { Room } from "../models/Room.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

// ==============================
// CREATE ROOM
// ==============================

export const createRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { name, language, code } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                message: "Room name is required",
            });

            return;
        }

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        const roomId = uuidv4();

        const room = await Room.create({
            roomId,
            name,
            owner: req.userId,
            participants: [req.userId],
            language: language || "cpp",
            code: typeof code === "string" ? code : "",
            status: "waiting",
        });

        res.status(201).json({
            success: true,
            message: "Room created successfully",
            room: {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                language: room.language,
                code: room.code,
                status: room.status,
                owner: room.owner,
                participants: room.participants,
                createdAt: room.createdAt,
            },
        });
    } catch (error) {
        console.error("Create room error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// GET MY ROOMS
// ==============================

export const getMyRooms = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        const rooms = await Room.find({
            $or: [
                { owner: req.userId },
                { participants: req.userId },
            ],
        })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            rooms,
        });
    } catch (error) {
        console.error("Get rooms error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// GET ROOM BY ID
// ==============================

export const getRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        const room = await Room.findOne({
            roomId,
        });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });

            return;
        }

        res.status(200).json({
            success: true,
            room,
        });
    } catch (error) {
        console.error("Get room error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// UPDATE ROOM CODE
// ==============================

export const updateRoomCode = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;
        const { code } = req.body;

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        if (typeof code !== "string") {
            res.status(400).json({
                success: false,
                message: "Code must be a string",
            });

            return;
        }

        if (code.length > 200_000) {
            res.status(400).json({
                success: false,
                message: "Code is too large",
            });

            return;
        }

        const room = await Room.findOne({
            roomId,
        });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });

            return;
        }

        const isParticipant = room.participants.some(
            (participant) =>
                participant.toString() === req.userId
        );

        const isOwner =
            room.owner.toString() === req.userId;

        if (!isParticipant && !isOwner) {
            res.status(403).json({
                success: false,
                message: "You are not a member of this room",
            });

            return;
        }

        room.code = code;

        await room.save();

        res.status(200).json({
            success: true,
            message: "Room code saved successfully",
        });
    } catch (error) {
        console.error("Update room code error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// GET CHAT MESSAGES
// ==============================

export const getChatMessages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        const room = await Room.findOne({
            roomId,
        });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });

            return;
        }

        const isParticipant = room.participants.some(
            (participant) =>
                participant.toString() === req.userId ||
                room.owner.toString() === req.userId
        );

        if (!isParticipant) {
            res.status(403).json({
                success: false,
                message: "You are not a member of this room",
            });

            return;
        }

        const messages = await ChatMessage.find({
            roomId,
        })
            .sort({ createdAt: 1 })
            .limit(200)
            .lean();

        const formattedMessages = messages.map(
            (message) => ({
                id: message._id.toString(),
                userId: message.userId.toString(),
                userName: message.userName,
                message: message.message,
                timestamp: message.createdAt.toISOString(),
                reactions: (message.reactions || []).map(
                    (reaction) => ({
                        emoji: reaction.emoji,
                        userId: reaction.userId.toString(),
                        userName: reaction.userName,
                    })
                ),
                replyTo: message.replyTo
                    ? {
                          messageId: message.replyTo.messageId,
                          userId: message.replyTo.userId.toString(),
                          userName: message.replyTo.userName,
                          message: message.replyTo.message,
                      }
                    : undefined,
            })
        );

        res.status(200).json({
            success: true,
            messages: formattedMessages,
        });
    } catch (error) {
        console.error(
            "Get chat messages error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// JOIN ROOM
// ==============================

export const joinRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        const room = await Room.findOne({
            roomId,
        });

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });

            return;
        }

        const alreadyJoined = room.participants.some(
            (participant) =>
                participant.toString() === req.userId
        );

        if (!alreadyJoined) {
            room.participants.push(
                new mongoose.Types.ObjectId(req.userId)
            );

            await room.save();
        }

        res.status(200).json({
            success: true,
            message: "Joined room successfully",
            room,
        });
    } catch (error) {
        console.error("Join room error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
