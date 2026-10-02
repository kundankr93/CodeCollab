import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/role.middleware.js";

import {
    getAllUsers,
    updateUserRole,
    deleteUser,
    getAllRooms,
    getRoomDetails,
    updateRoomStatus,
    deleteRoom,
    removeRoomParticipant,
} from "../controllers/owner.controller.js";

const router = Router();

// ==========================================
// USER MANAGEMENT
// ==========================================

router.get(
    "/users",
    authenticate,
    requireOwner,
    getAllUsers
);

router.patch(
    "/users/:userId/role",
    authenticate,
    requireOwner,
    updateUserRole
);

router.delete(
    "/users/:userId",
    authenticate,
    requireOwner,
    deleteUser
);

// ==========================================
// ROOM MANAGEMENT
// ==========================================

router.get(
    "/rooms",
    authenticate,
    requireOwner,
    getAllRooms
);

router.get(
    "/rooms/:roomId",
    authenticate,
    requireOwner,
    getRoomDetails
);

router.patch(
    "/rooms/:roomId/status",
    authenticate,
    requireOwner,
    updateRoomStatus
);

// Remove a participant from a room
router.delete(
    "/rooms/:roomId/participants/:userId",
    authenticate,
    requireOwner,
    removeRoomParticipant
);

router.delete(
    "/rooms/:roomId",
    authenticate,
    requireOwner,
    deleteRoom
);

// ==========================================
// OWNER AUTHORIZATION TEST
// ==========================================

router.get(
    "/test",
    authenticate,
    requireOwner,
    (_req, res) => {
        res.status(200).json({
            success: true,
            message: "Owner authorization successful 👑",
            role: "owner",
        });
    }
);

export default router;