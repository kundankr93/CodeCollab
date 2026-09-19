import jwt from "jsonwebtoken";

export const generateAccessToken = (userId: string): string => {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }

    return jwt.sign(
        { userId },
        secret,
        { expiresIn: "15m" }
    );
};

export const generateRefreshToken = (userId: string): string => {
    const secret = process.env.JWT_REFRESH_SECRET;

    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined");
    }

    return jwt.sign(
        { userId },
        secret,
        { expiresIn: "7d" }
    );
};

export const verifyRefreshToken = (token: string): string => {
    const secret = process.env.JWT_REFRESH_SECRET;

    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined");
    }

    const decoded = jwt.verify(token, secret) as {
        userId: string;
    };

    return decoded.userId;
};