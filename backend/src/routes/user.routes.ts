import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import {
    changePassword,
    getMe,
    updateMe,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);
router.patch("/me/password", authenticate, changePassword);

export default router;
