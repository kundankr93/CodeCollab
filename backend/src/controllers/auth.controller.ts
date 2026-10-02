import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
        /*
         * IMPORTANT:
         *
         * Public registration NEVER accepts
         * a role from the client.
         *
         * Every normal registration creates
         * a student account.
         */

        const {
            name,
            email,
            password,
        } = req.body;

        // Validation
        if (
            !name ||
            !email ||
            !password
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Name, email and password are required",
            });

            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters",
            });

            return;
        }

        const normalizedEmail =
            email.toLowerCase().trim();

        // Check existing user
        const existingUser =
            await User.findOne({
                email: normalizedEmail,
            });

        if (existingUser) {
            res.status(409).json({
                success: false,
                message:
                    "User with this email already exists",
            });

            return;
        }

        // Hash password
        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );

        /*
         * Explicitly create student.
         *
         * The client cannot choose the role.
         */
        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: "student",
        });

        // Generate tokens
        const accessToken =
            generateAccessToken(
                user._id.toString()
            );

        const refreshToken =
            generateRefreshToken(
                user._id.toString()
            );

        // Save refresh token
        user.refreshToken =
            refreshToken;

        await user.save();

        // Response
        res.status(201).json({
            success: true,
            message:
                "User registered successfully",

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
        console.error(
            "Registration error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
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
        const {
            email,
            password,
        } = req.body;

        // Validation
        if (
            !email ||
            !password
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Email and password are required",
            });

            return;
        }

        const normalizedEmail =
            email.toLowerCase().trim();

        // Find user
        const user =
            await User.findOne({
                email: normalizedEmail,
            });

        if (!user) {
            res.status(401).json({
                success: false,
                message:
                    "Invalid email or password",
            });

            return;
        }

        // Compare password
        const isPasswordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!isPasswordCorrect) {
            res.status(401).json({
                success: false,
                message:
                    "Invalid email or password",
            });

            return;
        }

        // Generate tokens
        const accessToken =
            generateAccessToken(
                user._id.toString()
            );

        const refreshToken =
            generateRefreshToken(
                user._id.toString()
            );

        // Save refresh token
        user.refreshToken =
            refreshToken;

        await user.save();

        // Response
        res.status(200).json({
            success: true,
            message:
                "Login successful",

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
        console.error(
            "Login error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};


// ==============================
// CREATE OWNER
// ==============================

export const createOwner = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        /*
         * The owner setup secret must exist
         * on the backend server.
         *
         * It must NEVER be stored in the
         * frontend.
         */
        const configuredSecret =
            process.env.OWNER_SETUP_SECRET;

        if (!configuredSecret) {
            console.error(
                "OWNER_SETUP_SECRET is not configured ❌"
            );

            res.status(503).json({
                success: false,
                message:
                    "Owner setup is not configured",
            });

            return;
        }

        /*
         * Read secret from a request header.
         *
         * Example:
         *
         * x-owner-setup-secret:
         * your-secret
         */
        const providedSecret =
            req.header(
                "x-owner-setup-secret"
            );

        if (!providedSecret) {
            res.status(401).json({
                success: false,
                message:
                    "Owner setup secret is required",
            });

            return;
        }

        /*
         * Compare secrets safely.
         *
         * Hashing both values gives us
         * fixed-length buffers for
         * timingSafeEqual.
         */
        const configuredHash =
            crypto
                .createHash("sha256")
                .update(configuredSecret)
                .digest();

        const providedHash =
            crypto
                .createHash("sha256")
                .update(providedSecret)
                .digest();

        const secretMatches =
            crypto.timingSafeEqual(
                configuredHash,
                providedHash
            );

        if (!secretMatches) {
            res.status(403).json({
                success: false,
                message:
                    "Invalid owner setup secret",
            });

            return;
        }

        /*
         * Only one owner can be created
         * through this bootstrap endpoint.
         */
        const existingOwner =
            await User.findOne({
                role: "owner",
            });

        if (existingOwner) {
            res.status(409).json({
                success: false,
                message:
                    "An owner account already exists",
            });

            return;
        }

        const {
            name,
            email,
            password,
        } = req.body;

        // Validation
        if (
            !name ||
            !email ||
            !password
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Name, email and password are required",
            });

            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters",
            });

            return;
        }

        const normalizedEmail =
            email.toLowerCase().trim();

        // Check email
        const existingUser =
            await User.findOne({
                email: normalizedEmail,
            });

        if (existingUser) {
            res.status(409).json({
                success: false,
                message:
                    "User with this email already exists",
            });

            return;
        }

        // Hash owner password
        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );

        /*
         * Create owner.
         *
         * This is the ONLY place where
         * the backend creates an owner.
         */
        const owner =
            await User.create({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                role: "owner",
            });

        // Generate tokens
        const accessToken =
            generateAccessToken(
                owner._id.toString()
            );

        const refreshToken =
            generateRefreshToken(
                owner._id.toString()
            );

        // Save refresh token
        owner.refreshToken =
            refreshToken;

        await owner.save();

        res.status(201).json({
            success: true,
            message:
                "Owner account created successfully",

            user: {
                id: owner._id,
                name: owner.name,
                email: owner.email,
                role: owner.role,
            },

            accessToken,
            refreshToken,
        });

    } catch (error) {
        console.error(
            "Owner creation error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};


// ==============================
// REFRESH ACCESS TOKEN
// ==============================

export const refreshAccessToken =
    async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const {
                refreshToken,
            } = req.body;

            if (!refreshToken) {
                res.status(401).json({
                    success: false,
                    message:
                        "Refresh token is required",
                });

                return;
            }

            // Verify JWT refresh token
            const userId =
                verifyRefreshToken(
                    refreshToken
                );

            // Find user
            const user =
                await User.findById(
                    userId
                );

            if (!user) {
                res.status(401).json({
                    success: false,
                    message:
                        "User not found",
                });

                return;
            }

            // Check stored refresh token
            if (
                user.refreshToken !==
                refreshToken
            ) {
                res.status(401).json({
                    success: false,
                    message:
                        "Invalid refresh token",
                });

                return;
            }

            // Generate new access token
            const accessToken =
                generateAccessToken(
                    user._id.toString()
                );

            res.status(200).json({
                success: true,
                accessToken,
            });

        } catch (error) {
            console.error(
                "Refresh token error ❌",
                error
            );

            res.status(401).json({
                success: false,
                message:
                    "Invalid or expired refresh token",
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
        const {
            refreshToken,
        } = req.body;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message:
                    "Refresh token is required",
            });

            return;
        }

        // Find user using refresh token
        const user =
            await User.findOne({
                refreshToken,
            });

        // Remove refresh token
        if (user) {
            user.refreshToken =
                undefined;

            await user.save();
        }

        res.status(200).json({
            success: true,
            message:
                "Logout successful",
        });

    } catch (error) {
        console.error(
            "Logout error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};