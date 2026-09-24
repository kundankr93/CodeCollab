import mongoose, {
    Document,
    Schema,
} from "mongoose";

export interface IChatReaction {
    emoji: string;
    userId: mongoose.Types.ObjectId;
    userName: string;
}

export interface IChatReply {
    messageId: string;
    userId: mongoose.Types.ObjectId;
    userName: string;
    message: string;
}

export interface IChatMessage
    extends Document {
    roomId: string;
    userId: mongoose.Types.ObjectId;
    userName: string;
    message: string;
    reactions: IChatReaction[];
    replyTo?: IChatReply;
    createdAt: Date;
    updatedAt: Date;
}

const chatReactionSchema =
    new Schema<IChatReaction>(
        {
            emoji: {
                type: String,
                required: true,
                trim: true,
            },

            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            userName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100,
            },
        },
        {
            _id: false,
        }
    );

const chatReplySchema =
    new Schema<IChatReply>(
        {
            messageId: {
                type: String,
                required: true,
            },
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            userName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100,
            },
            message: {
                type: String,
                required: true,
                maxlength: 2000,
            },
        },
        { _id: false }
    );

const chatMessageSchema =
    new Schema<IChatMessage>(
        {
            roomId: {
                type: String,
                required: true,
                index: true,
            },

            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            userName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100,
            },

            message: {
                type: String,
                required: true,
                trim: true,
                maxlength: 2000,
            },

            reactions: {
                type: [chatReactionSchema],
                default: [],
            },

            replyTo: {
                type: chatReplySchema,
                required: false,
            },
        },
        {
            timestamps: true,
        }
    );

chatMessageSchema.index({
    roomId: 1,
    createdAt: 1,
});

export const ChatMessage =
    mongoose.model<IChatMessage>(
        "ChatMessage",
        chatMessageSchema
    );
