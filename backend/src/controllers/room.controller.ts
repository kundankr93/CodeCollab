
import mongoose from "mongoose";
import { Response } from "express";
import { v4 as uuidv4 } from "uuid";

import { Room } from "../models/Room.js";
import type { RoomTestCase } from "../models/Room.js";
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
        const {
            name,
            language,
            code,
            interviewMode = false,
            interviewDurationMinutes = 60,
        } = req.body;

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

        if (typeof interviewMode !== "boolean") {
            res.status(400).json({
                success: false,
                message: "interviewMode must be a boolean",
            });
            return;
        }

        if (
            interviewMode &&
            (!Number.isInteger(interviewDurationMinutes) ||
                interviewDurationMinutes < 1 ||
                interviewDurationMinutes > 240)
        ) {
            res.status(400).json({
                success: false,
                message: "Interview duration must be a whole number between 1 and 240 minutes",
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
            testCases: [],
            status: "waiting",
            interviewMode,
            interviewDurationMinutes: interviewMode
                ? interviewDurationMinutes
                : 60,
            interviewStartedAt: null,
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
                testCases: room.testCases,
                status: room.status,
                owner: room.owner,
                participants: room.participants,
                interviewMode: room.interviewMode,
                interviewDurationMinutes: room.interviewDurationMinutes,
                interviewStartedAt: room.interviewStartedAt,
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

        const isOwner =
            room.owner.toString() === req.userId;

        const isParticipant = room.participants.some(
            (participant) =>
                participant.toString() === req.userId
        );

        if (!isOwner && !isParticipant) {
            res.status(403).json({
                success: false,
                message: "You are not a member of this room",
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

        // Update only if the authenticated user is a room member
        // and the room has not been completed.
        const updatedRoom = await Room.findOneAndUpdate(
            {
                roomId,
                status: { $ne: "completed" },
                $or: [
                    { owner: req.userId },
                    { participants: req.userId },
                ],
            },
            {
                $set: { code },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedRoom) {
            const room = await Room.findOne({ roomId }).select(
                "owner participants status"
            );

            if (!room) {
                res.status(404).json({
                    success: false,
                    message: "Room not found",
                });
                return;
            }

            const isMember =
                room.owner.toString() === req.userId ||
                room.participants.some(
                    (participant) =>
                        participant.toString() === req.userId
                );

            if (!isMember) {
                res.status(403).json({
                    success: false,
                    message: "You are not a member of this room",
                });
                return;
            }

            res.status(400).json({
                success: false,
                message: "Completed rooms are read-only",
            });
            return;
        }

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
// UPDATE ROOM TEST CASES
// ==============================

export const updateRoomTestCases = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;
        const { testCases } = req.body as {
            testCases?: RoomTestCase[];
        };

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        if (!Array.isArray(testCases)) {
            res.status(400).json({
                success: false,
                message: "Test cases must be an array",
            });
            return;
        }

        if (testCases.length > 20) {
            res.status(400).json({
                success: false,
                message: "Maximum 20 test cases are allowed",
            });
            return;
        }

        const sanitizedTestCases: RoomTestCase[] = [];

        for (const testCase of testCases) {
            if (
                !testCase ||
                typeof testCase.id !== "string" ||
                typeof testCase.input !== "string" ||
                typeof testCase.expectedOutput !== "string"
            ) {
                res.status(400).json({
                    success: false,
                    message: "Invalid test case format",
                });
                return;
            }

            if (
                testCase.id.length > 100 ||
                testCase.input.length > 20_000 ||
                testCase.expectedOutput.length > 20_000
            ) {
                res.status(400).json({
                    success: false,
                    message: "Test case data is too large",
                });
                return;
            }

            sanitizedTestCases.push({
                id: testCase.id,
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
            });
        }

        // Update only if the authenticated user is a room member
        // and the room has not been completed.
        const updatedRoom = await Room.findOneAndUpdate(
            {
                roomId,
                status: { $ne: "completed" },
                $or: [
                    { owner: req.userId },
                    { participants: req.userId },
                ],
            },
            {
                $set: { testCases: sanitizedTestCases },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedRoom) {
            const room = await Room.findOne({ roomId }).select(
                "owner participants status"
            );

            if (!room) {
                res.status(404).json({
                    success: false,
                    message: "Room not found",
                });
                return;
            }

            const isMember =
                room.owner.toString() === req.userId ||
                room.participants.some(
                    (participant) =>
                        participant.toString() === req.userId
                );

            if (!isMember) {
                res.status(403).json({
                    success: false,
                    message: "You are not a member of this room",
                });
                return;
            }

            res.status(400).json({
                success: false,
                message: "Completed rooms are read-only",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Test cases saved successfully",
            testCases: updatedRoom.testCases,
        });
    } catch (error) {
        console.error("Update room test cases error ❌", error);

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

// ==============================
// TOGGLE INTERVIEW MODE
// ==============================

export const toggleInterviewMode = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;
        const { enabled, durationMinutes } = req.body as {
            enabled?: boolean;
            durationMinutes?: number;
        };

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        if (typeof enabled !== "boolean") {
            res.status(400).json({
                success: false,
                message: "enabled must be a boolean",
            });
            return;
        }

        if (
            enabled &&
            (!Number.isInteger(durationMinutes) ||
                (durationMinutes as number) < 1 ||
                (durationMinutes as number) > 240)
        ) {
            res.status(400).json({
                success: false,
                message: "Interview duration must be a whole number between 1 and 240 minutes",
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

        if (room.owner.toString() !== req.userId) {
            res.status(403).json({
                success: false,
                message: "Only the room owner can change interview mode",
            });
            return;
        }

        // A completed room stays completed. Its owner may only turn OFF
        // interview mode; enabling it again requires reopening the room.
        if (room.status === "completed") {
            if (enabled) {
                res.status(400).json({
                    success: false,
                    message: "Interview mode cannot be enabled on a completed room. Reopen the room first.",
                });
                return;
            }

            if (!room.interviewMode) {
                res.status(200).json({
                    success: true,
                    message: "Interview mode is already disabled",
                    interviewMode: false,
                    interviewDurationMinutes: room.interviewDurationMinutes,
                    interviewStartedAt: null,
                });
                return;
            }

            const disabledRoom = await Room.findOneAndUpdate(
                {
                    _id: room._id,
                    roomId,
                    owner: req.userId,
                    status: "completed",
                    interviewMode: true,
                },
                {
                    $set: {
                        interviewMode: false,
                        interviewStartedAt: null,
                    },
                },
                { new: true }
            );

            if (!disabledRoom) {
                res.status(409).json({
                    success: false,
                    message: "Room changed while updating interview mode. Please refresh and try again.",
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: "Interview mode disabled successfully. The room remains completed.",
                interviewMode: disabledRoom.interviewMode,
                interviewDurationMinutes: disabledRoom.interviewDurationMinutes,
                interviewStartedAt: disabledRoom.interviewStartedAt,
            });
            return;
        }

        // Before a session starts, preserve the existing behavior: the owner
        // can enable or disable interview mode only while the room is waiting.
        if (room.status !== "waiting") {
            res.status(400).json({
                success: false,
                message: "Interview mode can only be changed before the session starts",
            });
            return;
        }

        const update: {
            interviewMode: boolean;
            interviewStartedAt: Date | null;
            interviewDurationMinutes?: number;
        } = {
            interviewMode: enabled,
            interviewStartedAt: null,
        };

        if (enabled) {
            update.interviewDurationMinutes = durationMinutes as number;
        }

        const updatedRoom = await Room.findOneAndUpdate(
            {
                _id: room._id,
                roomId,
                owner: req.userId,
                status: "waiting",
            },
            { $set: update },
            { new: true }
        );

        if (!updatedRoom) {
            res.status(409).json({
                success: false,
                message: "Room changed while updating interview mode. Please refresh and try again.",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Interview mode updated successfully",
            interviewMode: updatedRoom.interviewMode,
            interviewDurationMinutes: updatedRoom.interviewDurationMinutes,
            interviewStartedAt: updatedRoom.interviewStartedAt,
        });
    } catch (error) {
        console.error("Toggle interview mode error ❌", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==============================
// START ROOM SESSION
// ==============================

export const startRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!req.userId) {
            res.status(401).json({ success: false, message: "Authentication required" });
            return;
        }

        const room = await Room.findOne({ roomId });

        if (!room) {
            res.status(404).json({ success: false, message: "Room not found" });
            return;
        }

        if (room.owner.toString() !== req.userId) {
            res.status(403).json({ success: false, message: "Only the room owner can start the session" });
            return;
        }

        // Conditional update prevents two concurrent requests from starting
        // the same waiting room more than once.
        const startedRoom = await Room.findOneAndUpdate(
            { _id: room._id, owner: req.userId, status: "waiting" },
            {
                $set: {
                    status: "active",
                    interviewStartedAt: room.interviewMode ? new Date() : null,
                },
            },
            { new: true }
        );

        if (!startedRoom) {
            const latestRoom = await Room.findById(room._id).select("status");
            res.status(400).json({
                success: false,
                message: `Room cannot be started because it is already ${latestRoom?.status ?? "unavailable"}`,
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Room session started successfully",
            status: startedRoom.status,
            interviewMode: startedRoom.interviewMode,
            interviewDurationMinutes: startedRoom.interviewDurationMinutes,
            interviewStartedAt: startedRoom.interviewStartedAt,
        });
    } catch (error) {
        console.error("Start room error ❌", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==============================
// COMPLETE ROOM SESSION
// ==============================

export const completeRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!req.userId) {
            res.status(401).json({ success: false, message: "Authentication required" });
            return;
        }

        const room = await Room.findOne({ roomId });

        if (!room) {
            res.status(404).json({ success: false, message: "Room not found" });
            return;
        }

        if (room.owner.toString() !== req.userId) {
            res.status(403).json({ success: false, message: "Only the room owner can end the session" });
            return;
        }

        // Only the request that observes status=active can complete it.
        const completedRoom = await Room.findOneAndUpdate(
            { _id: room._id, owner: req.userId, status: "active" },
            { $set: { status: "completed" } },
            { new: true }
        );

        if (!completedRoom) {
            const latestRoom = await Room.findById(room._id).select("status");
            res.status(400).json({
                success: false,
                message: `Room cannot be completed because it is ${latestRoom?.status ?? "unavailable"}`,
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Room session completed successfully",
            status: completedRoom.status,
        });
    } catch (error) {
        console.error("Complete room error ❌", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==============================
// REOPEN ROOM SESSION
// ==============================

export const reopenRoom = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { roomId } = req.params;

        if (!req.userId) {
            res.status(401).json({ success: false, message: "Authentication required" });
            return;
        }

        const room = await Room.findOne({ roomId });

        if (!room) {
            res.status(404).json({ success: false, message: "Room not found" });
            return;
        }

        if (room.owner.toString() !== req.userId) {
            res.status(403).json({
                success: false,
                message: "Only the room owner can reopen the room",
            });
            return;
        }

        // Prevent a stale reopen request from overwriting a newer room state.
        const reopenedRoom = await Room.findOneAndUpdate(
            { _id: room._id, owner: req.userId, status: "completed" },
            { $set: { status: "waiting" } },
            { new: true }
        );

        if (!reopenedRoom) {
            const latestRoom = await Room.findById(room._id).select("status");
            res.status(400).json({
                success: false,
                message: `Room cannot be reopened because it is ${latestRoom?.status ?? "unavailable"}`,
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Room reopened successfully",
            status: reopenedRoom.status,
        });
    } catch (error) {
        console.error("Reopen room error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};