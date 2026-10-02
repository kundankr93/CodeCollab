import mongoose from "mongoose";
import { Response } from "express";

import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const addProjectCollaborator = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { email } = req.body;

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        if (!mongoose.isValidObjectId(projectId)) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });
            return;
        }

        if (typeof email !== "string" || !email.trim()) {
            res.status(400).json({
                success: false,
                message: "Collaborator email is required",
            });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail.length > 254) {
            res.status(400).json({
                success: false,
                message: "Invalid collaborator email",
            });
            return;
        }

        const project = await Project.findOne({
            _id: projectId,
            owner: req.userId,
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found or you are not the owner",
            });
            return;
        }

        const collaborator = await User.findOne({
            email: normalizedEmail,
        });

        if (!collaborator) {
            res.status(404).json({
                success: false,
                message: "No user found with this email",
            });
            return;
        }

        if (collaborator._id.toString() === req.userId) {
            res.status(400).json({
                success: false,
                message: "You are already the project owner",
            });
            return;
        }

        const alreadyCollaborator = project.collaborators.some(
            (userId: mongoose.Types.ObjectId) =>
                userId.toString() === collaborator._id.toString()
        );

        if (alreadyCollaborator) {
            res.status(409).json({
                success: false,
                message: "User is already a collaborator",
            });
            return;
        }

        project.collaborators.push(collaborator._id);
        await project.save();

        res.status(200).json({
            success: true,
            message: "Collaborator added successfully",
            collaborator: {
                _id: collaborator._id,
                name: collaborator.name,
                email: collaborator.email,
            },
        });
    } catch (error) {
        console.error("Add collaborator error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add collaborator",
        });
    }
};
