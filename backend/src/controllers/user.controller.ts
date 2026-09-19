import { Response } from "express";
import { User } from "../models/User.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

export const getMe = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = await User.findById(req.userId).select("-password");

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
                id: user._id,
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