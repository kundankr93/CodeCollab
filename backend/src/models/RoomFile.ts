import mongoose, {
    Document,
    Schema,
} from "mongoose";

export interface IRoomFile extends Document {
    roomId: string;
    name: string;
    path: string;
    content: string;
    language?: string;
    size?: number;

    // Version used for concurrent editing conflict detection.
    // Every successful content update increments this value.
    version: number;

    createdAt: Date;
    updatedAt: Date;
}

const roomFileSchema =
    new Schema<IRoomFile>(
        {
            roomId: {
                type: String,
                required: true,
                index: true,
            },

            name: {
                type: String,
                required: true,
                trim: true,
            },

            path: {
                type: String,
                required: true,
                trim: true,
            },

            content: {
                type: String,
                default: "",
            },

            language: {
                type: String,
            },

            size: {
                type: Number,
            },

            /*
             * Version starts at 1.
             *
             * Example:
             *
             * version 1 → initial file
             * version 2 → first successful edit
             * version 3 → second successful edit
             * ...
             */
            version: {
                type: Number,
                required: true,
                default: 1,
                min: 1,
            },
        },
        {
            timestamps: true,
        }
    );

roomFileSchema.index(
    { roomId: 1, path: 1 },
    { unique: true }
);

export const RoomFile =
    mongoose.model<IRoomFile>(
        "RoomFile",
        roomFileSchema
    );