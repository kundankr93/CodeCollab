import { Request, Response } from "express";
import fs from "fs";
import path from "path";

import { Project } from "../models/Project.js";
import { ProjectFile } from "../models/ProjectFile.js";

import type { AuthRequest } from "../middleware/auth.middleware.js";

interface UploadedFile {
    originalname: string;
    filename: string;
    path: string;
    size: number;
}

const getLanguageFromExtension = (fileName: string): string => {
    const extension = path.extname(fileName).toLowerCase();

    const languages: Record<string, string> = {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".cxx": "cpp",
        ".c": "c",
        ".h": "cpp",
        ".hpp": "cpp",
        ".py": "python",
        ".java": "java",
        ".html": "html",
        ".htm": "html",
        ".css": "css",
        ".json": "json",
        ".md": "markdown",
        ".txt": "plaintext",
        ".sql": "sql",
        ".xml": "xml",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sh": "shell",
        ".bat": "bat",
    };

    return languages[extension] || "plaintext";
};


// ======================================================
// CREATE PROJECT
// ======================================================

export const createProject = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            res.status(400).json({
                success: false,
                message: "Project name is required",
            });

            return;
        }

        const project = await Project.create({
            name: name.trim(),
            owner: req.userId,
            collaborators: [],
        });

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            project,
        });
    } catch (error) {
        console.error("Create project error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create project",
        });
    }
};


// ======================================================
// GET MY PROJECTS
// ======================================================

export const getMyProjects = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const projects = await Project.find({
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        })
            .populate("owner", "name email")
            .populate("collaborators", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            projects,
        });
    } catch (error) {
        console.error("Get projects error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get projects",
        });
    }
};


// ======================================================
// GET SINGLE PROJECT
// ======================================================

export const getProject = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        })
            .populate("owner", "name email")
            .populate("collaborators", "name email");

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        const files = await ProjectFile.find({
            projectId: project._id,
        }).sort({ path: 1 });

        res.json({
            success: true,
            project,
            files,
        });
    } catch (error) {
        console.error("Get project error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get project",
        });
    }
};


// ======================================================
// UPLOAD PROJECT FILES
// ======================================================

export const uploadProjectFiles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        const files = req.files as UploadedFile[];

        if (!files || files.length === 0) {
            res.status(400).json({
                success: false,
                message: "No files uploaded",
            });

            return;
        }

        let paths: string[] = [];

        const rawPaths = req.body.paths;

        if (rawPaths) {
            try {
                const parsed = JSON.parse(rawPaths);

                if (Array.isArray(parsed)) {
                    paths = parsed;
                }
            } catch {
                console.error("Could not parse upload paths");
            }
        }

        const createdFiles = [];

        for (let index = 0; index < files.length; index++) {
            const file = files[index];

            let relativePath =
                paths[index] ||
                file.originalname;

            relativePath = relativePath
                .replace(/\\/g, "/")
                .replace(/^\/+/, "");

            const pathParts =
                relativePath.split("/");

            if (pathParts.length > 1) {
                pathParts.shift();

                relativePath =
                    pathParts.join("/");
            }

            const fileName =
                path.basename(relativePath);

            const existingFile =
                await ProjectFile.findOne({
                    projectId: project._id,
                    path: relativePath,
                });

            if (existingFile) {
                if (
                    existingFile.storagePath &&
                    fs.existsSync(existingFile.storagePath)
                ) {
                    fs.unlinkSync(
                        existingFile.storagePath
                    );
                }

                existingFile.name = fileName;
                existingFile.size = file.size;
                existingFile.language =
                    getLanguageFromExtension(fileName);
                existingFile.storageName =
                    file.filename;
                existingFile.storagePath =
                    file.path;

                await existingFile.save();

                createdFiles.push(existingFile);

                continue;
            }

            const fileData = {
                projectId: project._id,
                name: fileName,
                path: relativePath,
                type: "file" as const,
                size: file.size,
                language:
                    getLanguageFromExtension(fileName),
                storageName: file.filename,
                storagePath: file.path,
            };

            const projectFile =
                await ProjectFile.create(fileData);

            createdFiles.push(projectFile);
        }

        res.status(201).json({
            success: true,
            message: "Files uploaded successfully",
            files: createdFiles,
        });
    } catch (error) {
        console.error("Upload project files error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to upload project files",
        });
    }
};


// ======================================================
// GET FILE CONTENT
// ======================================================

export const getProjectFileContent = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId, fileId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        const file = await ProjectFile.findOne({
            _id: fileId,
            projectId,
        });

        if (!file) {
            res.status(404).json({
                success: false,
                message: "File not found",
            });

            return;
        }

        if (
            !file.storagePath ||
            !fs.existsSync(file.storagePath)
        ) {
            res.status(404).json({
                success: false,
                message: "Physical file not found",
            });

            return;
        }

        const content =
            fs.readFileSync(
                file.storagePath,
                "utf-8"
            );

        res.json({
            success: true,
            file: {
                id: file._id,
                name: file.name,
                path: file.path,
                language: file.language,
                content,
            },
        });
    } catch (error) {
        console.error("Get file content error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to read file",
        });
    }
};


// ======================================================
// SAVE EDITED FILE
// ======================================================

export const saveProjectFile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId, fileId } = req.params;
        const { content } = req.body;

        if (typeof content !== "string") {
            res.status(400).json({
                success: false,
                message: "File content is required",
            });

            return;
        }

        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        const file = await ProjectFile.findOne({
            _id: fileId,
            projectId,
        });

        if (!file) {
            res.status(404).json({
                success: false,
                message: "File not found",
            });

            return;
        }

        if (!file.storagePath) {
            res.status(400).json({
                success: false,
                message: "File storage path is missing",
            });

            return;
        }

        fs.writeFileSync(
            file.storagePath,
            content,
            "utf-8"
        );

        file.size =
            Buffer.byteLength(
                content,
                "utf-8"
            );

        await file.save();

        res.json({
            success: true,
            message: "File saved successfully",
            file: {
                id: file._id,
                name: file.name,
                path: file.path,
                size: file.size,
            },
        });
    } catch (error) {
        console.error("Save project file error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save file",
        });
    }
};


// ======================================================
// DELETE FILE
// ======================================================

export const deleteProjectFile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId, fileId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { owner: req.userId },
                { collaborators: req.userId },
            ],
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found",
            });

            return;
        }

        const file = await ProjectFile.findOne({
            _id: fileId,
            projectId,
        });

        if (!file) {
            res.status(404).json({
                success: false,
                message: "File not found",
            });

            return;
        }

        if (
            file.storagePath &&
            fs.existsSync(file.storagePath)
        ) {
            fs.unlinkSync(file.storagePath);
        }

        await ProjectFile.deleteOne({
            _id: fileId,
        });

        res.json({
            success: true,
            message: "File deleted successfully",
        });
    } catch (error) {
        console.error("Delete file error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete file",
        });
    }
};


// ======================================================
// DELETE PROJECT
// ======================================================

export const deleteProject = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            owner: req.userId,
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message:
                    "Project not found or you are not the owner",
            });

            return;
        }

        const files =
            await ProjectFile.find({
                projectId,
            });

        for (const file of files) {
            if (
                file.storagePath &&
                fs.existsSync(file.storagePath)
            ) {
                fs.unlinkSync(
                    file.storagePath
                );
            }
        }

        await ProjectFile.deleteMany({
            projectId,
        });

        await Project.deleteOne({
            _id: projectId,
        });

        res.json({
            success: true,
            message: "Project deleted successfully",
        });
    } catch (error) {
        console.error("Delete project error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete project",
        });
    }
};