import { Router } from "express";

import {
    register,
    login,
    createOwner,
    refreshAccessToken,
    logout,
    forgotPassword,
    resetPassword,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/setup-owner", createOwner);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

export default router;
