import mongoose, {
    Document,
    Schema,
} from "mongoose";

export interface IProject extends Document {
    name: string;

    owner: mongoose.Types.ObjectId;

    collaborators: mongoose.Types.ObjectId[];

    roomId?: string;

    createdAt: Date;

    updatedAt: Date;
}

const projectSchema =
    new Schema<IProject>(
        {
            name: {
                type: String,
                required: true,
                trim: true,
                minlength: 1,
                maxlength: 100,
            },

            owner: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            collaborators: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                },
            ],

            roomId: {
                type: String,
                index: true,
            },
        },
        {
            timestamps: true,
        }
    );

export const Project =
    mongoose.model<IProject>(
        "Project",
        projectSchema
    );