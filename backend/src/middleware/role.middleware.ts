import {
    Response,
    NextFunction,
} from "express";

import type { AuthRequest } from "./auth.middleware.js";

import { User } from "../models/User.js";


// ==========================================
// USER ROLES
// ==========================================

export type UserRole =
    | "student"
    | "interviewer"
    | "admin"
    | "owner";


// ==========================================
// REQUIRE ROLE
// ==========================================
//
// Usage:
//
// router.get(
//     "/owner-only",
//     authenticate,
//     requireRole("owner"),
//     controller
// );
//
// ==========================================

export const requireRole = (
    ...allowedRoles: UserRole[]
) => {

    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {

        try {

            // ==========================================
            // CHECK AUTHENTICATION
            // ==========================================

            if (!req.userId) {

                res.status(401).json({
                    success: false,
                    message:
                        "Authentication required",
                });

                return;
            }


            // ==========================================
            // FIND USER
            // ==========================================

            const user =
                await User.findById(
                    req.userId
                ).select(
                    "_id name email role"
                );


            if (!user) {

                res.status(401).json({
                    success: false,
                    message:
                        "User not found",
                });

                return;
            }


            // ==========================================
            // CHECK ROLE
            // ==========================================

            if (
                !allowedRoles.includes(
                    user.role
                )
            ) {

                res.status(403).json({
                    success: false,
                    message:
                        "You do not have permission to access this resource",
                });

                return;
            }


            // ==========================================
            // AUTHORIZED
            // ==========================================

            next();

        } catch (error) {

            console.error(
                "Role authorization error ❌",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Internal server error",
            });
        }
    };
};


// ==========================================
// OWNER ONLY
// ==========================================

export const requireOwner =
    requireRole("owner");


// ==========================================
// ADMIN ONLY
// ==========================================

export const requireAdmin =
    requireRole("admin");


// ==========================================
// ADMIN OR OWNER
// ==========================================

export const requireAdminOrOwner =
    requireRole(
        "admin",
        "owner"
    );