import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import {
    createRoom,
    getMyRooms,
    getRoom,
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


// Join room
router.post(
    "/:roomId/join",
    authenticate,
    joinRoom
);


export default router;