import mongoose, { Document, Schema } from "mongoose";

export type UserRole =
    | "student"
    | "interviewer"
    | "admin"
    | "owner";

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    avatar?: string;
    refreshToken?: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ["student", "interviewer", "admin", "owner"],
            default: "student",
        },
        avatar: { type: String },
        refreshToken: { type: String },
        // Only a SHA-256 hash of the emailed reset token is stored.
        passwordResetToken: { type: String, select: false },
        passwordResetExpires: { type: Date, select: false },
    },
    { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
