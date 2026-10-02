import { Router } from "express";

import {
    register,
    login,
    createOwner,
    refreshAccessToken,
    logout,
} from "../controllers/auth.controller.js";


const router = Router();


// ==========================================
// REGISTER
// ==========================================

router.post(
    "/register",
    register
);


// ==========================================
// LOGIN
// ==========================================

router.post(
    "/login",
    login
);


// ==========================================
// CREATE OWNER
// ==========================================

router.post(
    "/setup-owner",
    createOwner
);


// ==========================================
// REFRESH ACCESS TOKEN
// ==========================================

router.post(
    "/refresh",
    refreshAccessToken
);


// ==========================================
// LOGOUT
// ==========================================

router.post(
    "/logout",
    logout
);


export default router;