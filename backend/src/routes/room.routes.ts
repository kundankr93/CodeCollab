
import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import {
    createRoom,
    getMyRooms,
    getRoom,
    updateRoomCode,
    updateRoomTestCases,
    getChatMessages,
    joinRoom,
    startRoom,
    completeRoom,
    reopenRoom,
    toggleInterviewMode,
} from "../controllers/room.controller.js";

import {
    getRoomFiles,
    upsertRoomFiles,
    updateRoomFile,
} from "../controllers/roomFile.controller.js";

const router = Router();

router.post("/", authenticate, createRoom);
router.get("/", authenticate, getMyRooms);
router.get("/:roomId", authenticate, getRoom);

router.get("/:roomId/files", authenticate, getRoomFiles);
router.post("/:roomId/files", authenticate, upsertRoomFiles);
router.put("/:roomId/files/:fileId", authenticate, updateRoomFile);

router.put("/:roomId/code", authenticate, updateRoomCode);
router.put("/:roomId/test-cases", authenticate, updateRoomTestCases);
router.get("/:roomId/messages", authenticate, getChatMessages);
router.post("/:roomId/join", authenticate, joinRoom);
router.put("/:roomId/start", authenticate, startRoom);
router.put("/:roomId/complete", authenticate, completeRoom);
router.put("/:roomId/reopen", authenticate, reopenRoom);
router.put("/:roomId/interview-mode", authenticate, toggleInterviewMode);

export default router;