import { Request, Response } from "express";
import bcrypt from "bcryptjs";

import { User } from "../models/User.js";

import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../utils/jwt.js";


// ==============================
// REGISTER
// ==============================

export const register = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            res.status(400).json({
                success: false,
                message: "Name, email and password are required",
            });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
            return;
        }

        // Check existing user
        const existingUser = await User.findOne({
            email: email.toLowerCase(),
        });

        if (existingUser) {
            res.status(409).json({
                success: false,
                message: "User with this email already exists",
            });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        // Generate tokens
        const accessToken = generateAccessToken(
            user._id.toString()
        );

        const refreshToken = generateRefreshToken(
            user._id.toString()
        );

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // Response
        res.status(201).json({
            success: true,
            message: "User registered successfully",

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },

            accessToken,
            refreshToken,
        });

    } catch (error) {
        console.error("Registration error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==============================
// LOGIN
// ==============================

export const login = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
            return;
        }

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase(),
        });

        if (!user) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
            return;
        }

        // Compare password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
            return;
        }

        // Generate tokens
        const accessToken = generateAccessToken(
            user._id.toString()
        );

        const refreshToken = generateRefreshToken(
            user._id.toString()
        );

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // Response
        res.status(200).json({
            success: true,
            message: "Login successful",

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },

            accessToken,
            refreshToken,
        });

    } catch (error) {
        console.error("Login error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==============================
// REFRESH ACCESS TOKEN
// ==============================

export const refreshAccessToken = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        // Check refresh token
        if (!refreshToken) {
            res.status(401).json({
                success: false,
                message: "Refresh token is required",
            });
            return;
        }

        // Verify JWT refresh token
        const userId = verifyRefreshToken(refreshToken);

        // Find user
        const user = await User.findById(userId);

        if (!user) {
            res.status(401).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // Check stored refresh token
        if (user.refreshToken !== refreshToken) {
            res.status(401).json({
                success: false,
                message: "Invalid refresh token",
            });
            return;
        }

        // Generate new access token
        const accessToken = generateAccessToken(
            user._id.toString()
        );

        res.status(200).json({
            success: true,
            accessToken,
        });

    } catch (error) {
        console.error("Refresh token error ❌", error);

        res.status(401).json({
            success: false,
            message: "Invalid or expired refresh token",
        });
    }
};


// ==============================
// LOGOUT
// ==============================

export const logout = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: "Refresh token is required",
            });
            return;
        }

        // Find user using refresh token
        const user = await User.findOne({
            refreshToken,
        });

        // Remove refresh token
        if (user) {
            user.refreshToken = undefined;
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: "Logout successful",
        });

    } catch (error) {
        console.error("Logout error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};