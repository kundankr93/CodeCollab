import mongoose from "mongoose";
import { Response } from "express";

import { Project } from "../models/Project.js";
import { User } from "../models/User.js";

import { AuthRequest } from "../middleware/auth.middleware.js";

export const addProjectCollaborator = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { email } = req.body;

        // Check authentication
        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });

            return;
        }

        // Validate email
        if (!email || typeof email !== "string") {
            res.status(400).json({
                success: false,
                message: "Collaborator email is required",
            });

            return;
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        // Find project
        const project = await Project.findById(
            projectId
        );

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        // Only owner can add collaborators
        if (
            project.owner.toString() !==
            req.userId
        ) {
            res.status(403).json({
                success: false,
                message:
                    "Only the project owner can add collaborators",
            });

            return;
        }

        // Find user by email
        const collaborator =
            await User.findOne({
                email: normalizedEmail,
            });

        if (!collaborator) {
            res.status(404).json({
                success: false,
                message:
                    "No user found with this email",
            });

            return;
        }

        // Owner cannot add themselves
        if (
            collaborator._id.toString() ===
            req.userId
        ) {
            res.status(400).json({
                success: false,
                message:
                    "You are already the project owner",
            });

            return;
        }

        // Check if user is already a collaborator
        const alreadyCollaborator =
            project.collaborators.some(
                (userId: mongoose.Types.ObjectId) =>
                    userId.toString() ===
                    collaborator._id.toString()
            );

        if (alreadyCollaborator) {
            res.status(400).json({
                success: false,
                message:
                    "User is already a collaborator",
            });

            return;
        }

        // Add collaborator
        project.collaborators.push(
            collaborator._id
        );

        await project.save();

        res.status(200).json({
            success: true,
            message:
                "Collaborator added successfully",

            collaborator: {
                _id: collaborator._id,
                name: collaborator.name,
                email: collaborator.email,
            },
        });
    } catch (error) {
        console.error(
            "Add collaborator error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to add collaborator",
        });
    }
};