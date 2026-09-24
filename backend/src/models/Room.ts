import mongoose, { Document, Schema } from "mongoose";

export type RoomStatus = "waiting" | "active" | "completed";

export interface IRoom extends Document {
    roomId: string;
    name: string;
    owner: mongoose.Types.ObjectId;
    participants: mongoose.Types.ObjectId[];
    language: string;
    code: string;
    status: RoomStatus;
    createdAt: Date;
    updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
    {
        roomId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },

        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        language: {
            type: String,
            default: "cpp",
        },

        code: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: ["waiting", "active", "completed"],
            default: "waiting",
        },
    },
    {
        timestamps: true,
    }
);

export const Room = mongoose.model<IRoom>(
    "Room",
    roomSchema
);
