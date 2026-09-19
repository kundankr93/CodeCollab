import mongoose, {
    Document,
    Schema,
} from "mongoose";

export type ProjectFileType =
    "file" | "folder";

export interface IProjectFile
    extends Document {
    projectId: mongoose.Types.ObjectId;
    name: string;
    path: string;
    type: ProjectFileType;
    size?: number;
    language?: string;
    storageName?: string;
    storagePath?: string;
    createdAt: Date;
    updatedAt: Date;
}

const projectFileSchema =
    new Schema<IProjectFile>(
        {
            projectId: {
                type:
                    Schema.Types.ObjectId,
                ref: "Project",
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

            type: {
                type: String,
                enum: [
                    "file",
                    "folder",
                ],
                default: "file",
            },

            size: {
                type: Number,
            },

            language: {
                type: String,
            },

            storageName: {
                type: String,
            },

            storagePath: {
                type: String,
            },
        },
        {
            timestamps: true,
        }
    );

projectFileSchema.index(
    {
        projectId: 1,
        path: 1,
    },
    {
        unique: true,
    }
);

export const ProjectFile =
    mongoose.model<IProjectFile>(
        "ProjectFile",
        projectFileSchema
    );