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

            if (
                typeof refreshToken !== "string" ||
                !refreshToken.trim()
            ) {
                res.status(401).json({
                    success: false,
                    message:
                        "Refresh token is required",
                });

                return;
            }

            // Verify the refresh token and extract its user ID.
            const userId =
                verifyRefreshToken(
                    refreshToken
                );

            /*
             * Rotate the refresh token atomically.
             *
             * Matching the old token in the update query prevents
             * two concurrent refresh requests from both succeeding.
             * Only the request that replaces the currently stored
             * token receives a new token pair.
             */
            const newRefreshToken =
                generateRefreshToken(userId);

            const updatedUser =
                await User.findOneAndUpdate(
                    {
                        _id: userId,
                        refreshToken,
                    },
                    {
                        $set: {
                            refreshToken:
                                newRefreshToken,
                        },
                    },
                    {
                        new: true,
                    }
                );

            if (!updatedUser) {
                res.status(401).json({
                    success: false,
                    message:
                        "Invalid or expired refresh token",
                });

                return;
            }

            const accessToken =
                generateAccessToken(
                    updatedUser._id.toString()
                );

            res.status(200).json({
                success: true,
                accessToken,
                refreshToken:
                    newRefreshToken,
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

// ==============================
// FORGOT PASSWORD
// ==============================

export const forgotPassword = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const email =
            typeof req.body.email === "string"
                ? req.body.email.toLowerCase().trim()
                : "";

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({
                success: false,
                message: "Please provide a valid email address",
            });
            return;
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESET_EMAIL_FROM;
        const frontendUrl = process.env.FRONTEND_URL;

        if (!resendApiKey || !fromEmail || !frontendUrl) {
            console.error(
                "Password reset email is not configured. Set RESEND_API_KEY, RESET_EMAIL_FROM and FRONTEND_URL."
            );
            res.status(503).json({
                success: false,
                message: "Password reset email is temporarily unavailable",
            });
            return;
        }

        // Always return the same public response to avoid account enumeration.
        const genericMessage =
            "If an account exists for this email, a password reset link will be sent.";
        const user = await User.findOne({ email }).select(
            "+passwordResetToken +passwordResetExpires"
        );

        if (!user) {
            res.status(200).json({ success: true, message: genericMessage });
            return;
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        user.passwordResetToken = tokenHash;
        user.passwordResetExpires = expiresAt;
        await user.save();

        const resetUrl = new URL("/reset-password", frontendUrl);
        resetUrl.searchParams.set("token", rawToken);

        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: fromEmail,
                to: [user.email],
                subject: "Reset your CodeCollab password",
                html: `
                    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#20243a">
                        <h2>Reset your CodeCollab password</h2>
                        <p>We received a request to reset the password for your account.</p>
                        <p><a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 20px;background:#6557f5;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
                        <p>This link expires in 15 minutes and can only be used once.</p>
                        <p>If you did not request this, you can ignore this email.</p>
                    </div>
                `,
            }),
        });

        if (!emailResponse.ok) {
            const providerMessage = await emailResponse.text();
            console.error("Resend email error:", providerMessage);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            res.status(502).json({
                success: false,
                message: "Unable to send the reset email. Please try again later.",
            });
            return;
        }

        res.status(200).json({ success: true, message: genericMessage });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to process the request right now",
        });
    }
};

// ==============================
// RESET PASSWORD
// ==============================

export const resetPassword = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { token, password } = req.body;

        if (
            typeof token !== "string" ||
            !token.trim() ||
            typeof password !== "string" ||
            password.length < 6
        ) {
            res.status(400).json({
                success: false,
                message: "A valid reset token and a password of at least 6 characters are required",
            });
            return;
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const hashedPassword = await bcrypt.hash(password, 12);

        // Atomic consume: expired, unknown, or already-used tokens cannot reset again.
        const user = await User.findOneAndUpdate(
            {
                passwordResetToken: tokenHash,
                passwordResetExpires: { $gt: new Date() },
            },
            {
                $set: { password: hashedPassword },
                $unset: {
                    passwordResetToken: 1,
                    passwordResetExpires: 1,
                    refreshToken: 1,
                },
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            res.status(400).json({
                success: false,
                message: "This password reset link is invalid or has expired. Please request a new one.",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Password reset successfully. Please sign in with your new password.",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to reset password right now",
        });
    }
};
