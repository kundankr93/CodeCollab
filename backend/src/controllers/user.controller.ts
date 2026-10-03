import { Response } from "express";
import bcrypt from "bcryptjs";

import { User } from "../models/User.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

// ==========================================
// GET CURRENT USER
// ==========================================

export const getMe = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = await User.findById(req.userId).select("-password -refreshToken");

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        console.error("Get profile error ❌", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// UPDATE CURRENT USER PROFILE
// ==========================================

export const updateMe = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { name, avatar } = req.body as {
            name?: unknown;
            avatar?: unknown;
        };

        const updates: {
            name?: string;
            avatar?: string;
        } = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
                res.status(400).json({
                    success: false,
                    message: "Name must be between 2 and 50 characters",
                });
                return;
            }
            updates.name = name.trim();
        }

        if (avatar !== undefined) {
            if (typeof avatar !== "string" || avatar.trim().length > 500) {
                res.status(400).json({
                    success: false,
                    message: "Avatar must be a valid URL or empty",
                });
                return;
            }
            updates.avatar = avatar.trim();
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({
                success: false,
                message: "No profile changes were provided",
            });
            return;
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("-password -refreshToken");

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        console.error("Update profile error ❌", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ==========================================
// CHANGE CURRENT USER PASSWORD
// ==========================================

export const changePassword = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body as {
            currentPassword?: unknown;
            newPassword?: unknown;
        };

        if (
            typeof currentPassword !== "string" ||
            !currentPassword ||
            typeof newPassword !== "string" ||
            !newPassword
        ) {
            res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            });
            return;
        }

        if (currentPassword === newPassword) {
            res.status(400).json({
                success: false,
                message: "New password must be different from current password",
            });
            return;
        }

        const user = await User.findById(req.userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        const matches = await bcrypt.compare(currentPassword, user.password);

        if (!matches) {
            res.status(401).json({
                success: false,
                message: "Current password is incorrect",
            });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 12);
        // Revoke the stored refresh token. The frontend signs the user out
        // after a successful password change, requiring login with the new password.
        user.refreshToken = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully. Please log in again.",
        });
    } catch (error) {
        console.error("Change password error ❌", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
