import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import {
    createRoom,
    getMyRooms,
    getRoom,
    updateRoomCode,
    getChatMessages,
    joinRoom,
} from "../controllers/room.controller.js";

const router = Router();

// Create room
router.post(
    "/",
    authenticate,
    createRoom
);

// Get my rooms
router.get(
    "/",
    authenticate,
    getMyRooms
);

// Get specific room
router.get(
    "/:roomId",
    authenticate,
    getRoom
);

// Save room code
router.put(
    "/:roomId/code",
    authenticate,
    updateRoomCode
);

// Get persistent chat history
router.get(
    "/:roomId/messages",
    authenticate,
    getChatMessages
);

// Join room
router.post(
    "/:roomId/join",
    authenticate,
    joinRoom
);

export default router;
