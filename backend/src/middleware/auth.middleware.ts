import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    userId: string;
}

export interface AuthRequest extends Request {
    userId?: string;
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        // 1. Get Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        // 2. Check Bearer format
        if (!authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                message: "Invalid authorization format",
            });
            return;
        }

        // 3. Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            res.status(401).json({
                success: false,
                message: "Access token is missing",
            });
            return;
        }

        // 4. Get JWT secret
        const secret = process.env.JWT_ACCESS_SECRET;

        if (!secret) {
            throw new Error("JWT_ACCESS_SECRET is not defined");
        }

        // 5. Verify token
        const decoded = jwt.verify(token, secret) as JwtPayload;

        // 6. Attach user ID to request
        req.userId = decoded.userId;

        // 7. Continue to controller
        next();

    } catch (error) {
        console.error("Authentication failed:", error);

        res.status(401).json({
            success: false,
            message: "Invalid or expired access token",
        });
    }
};