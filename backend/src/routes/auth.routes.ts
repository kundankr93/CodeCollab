import { Router } from "express";

import {
    register,
    login,
    refreshAccessToken,
    logout,
} from "../controllers/auth.controller.js";


const router = Router();


// Register
router.post(
    "/register",
    register
);


// Login
router.post(
    "/login",
    login
);


// Refresh access token
router.post(
    "/refresh",
    refreshAccessToken
);


// Logout
router.post(
    "/logout",
    logout
);


export default router;