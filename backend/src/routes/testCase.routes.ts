import { Router } from "express";

import {
    executeTestCases,
} from "../controllers/testCase.controller.js";

import {
    authenticate,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post(
    "/run",
    authenticate,
    executeTestCases
);

export default router;