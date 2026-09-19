import { Router } from "express";

import {
    authenticate,
} from "../middleware/auth.middleware.js";

import {
    upload,
} from "../middleware/upload.middleware.js";

import {
    createProject,
    getMyProjects,
    getProject,
    uploadProjectFiles,
    getProjectFileContent,
    saveProjectFile,
    deleteProjectFile,
    deleteProject,
} from "../controllers/project.controller.js";

import {
    addProjectCollaborator,
} from "../controllers/projectCollaborator.controller.js";

const router = Router();


// ==========================================
// CREATE PROJECT
// ==========================================

router.post(
    "/",
    authenticate,
    createProject
);


// ==========================================
// GET MY PROJECTS
// ==========================================

router.get(
    "/",
    authenticate,
    getMyProjects
);


// ==========================================
// ADD COLLABORATOR
// ==========================================

router.post(
    "/:projectId/collaborators",
    authenticate,
    addProjectCollaborator
);


// ==========================================
// GET PROJECT
// ==========================================

router.get(
    "/:projectId",
    authenticate,
    getProject
);


// ==========================================
// UPLOAD PROJECT FILES
// ==========================================

router.post(
    "/:projectId/upload",
    authenticate,
    upload.array("files", 100),
    uploadProjectFiles
);


// ==========================================
// GET FILE CONTENT
// ==========================================

router.get(
    "/:projectId/files/:fileId",
    authenticate,
    getProjectFileContent
);


// ==========================================
// SAVE FILE
// ==========================================

router.put(
    "/:projectId/files/:fileId",
    authenticate,
    saveProjectFile
);


// ==========================================
// DELETE FILE
// ==========================================

router.delete(
    "/:projectId/files/:fileId",
    authenticate,
    deleteProjectFile
);


// ==========================================
// DELETE PROJECT
// ==========================================

router.delete(
    "/:projectId",
    authenticate,
    deleteProject
);


export default router;