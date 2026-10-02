import mongoose, { Document, Schema } from "mongoose";

export type RoomStatus = "waiting" | "active" | "completed";

export interface RoomTestCase {
    id: string;
    input: string;
    expectedOutput: string;
}

export interface IRoom extends Document {
    roomId: string;
    name: string;
    owner: mongoose.Types.ObjectId;
    participants: mongoose.Types.ObjectId[];
    language: string;
    code: string;
    testCases: RoomTestCase[];
    status: RoomStatus;
    interviewMode: boolean;
    interviewDurationMinutes: number;
    interviewStartedAt: Date | null;
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

        testCases: {
            type: [
                {
                    id: {
                        type: String,
                        required: true,
                    },
                    input: {
                        type: String,
                        default: "",
                    },
                    expectedOutput: {
                        type: String,
                        default: "",
                    },
                },
            ],
            default: [],
        },

        status: {
            type: String,
            enum: ["waiting", "active", "completed"],
            default: "waiting",
        },

        // Interview settings are completely optional for a normal
        // collaborative coding room. Normal rooms always start with
        // interview mode disabled.
        interviewMode: {
            type: Boolean,
            default: false,
        },

        interviewDurationMinutes: {
            type: Number,
            default: 60,
            min: 1,
            max: 240,
        },

        interviewStartedAt: {
            type: Date,
            default: null,
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
