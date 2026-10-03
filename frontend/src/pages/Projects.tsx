import {
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    ChangeEvent,
    ReactNode,
} from "react";

import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { io, Socket } from "socket.io-client";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface ProjectUser {
    _id: string;
    name: string;
    email: string;
}

interface Project {
    _id: string;
    name: string;
    owner?: string | ProjectUser;
    collaborators?: ProjectUser[];
    roomId?: string;
    createdAt: string;
}

interface ProjectFile {
    _id: string;
    name: string;
    path: string;
    type: "file" | "folder";
    size?: number;
    language?: string;
    storageName?: string;
    storagePath?: string;
}

interface FileTreeNode {
    name: string;
    path: string;
    type: "file" | "folder";
    file?: ProjectFile;
    children: FileTreeNode[];
}

interface FileCodeUpdate {
    projectId: string;
    fileId: string;
    code: string;
}

interface FileUser {
    userId: string;
    userName: string;
    fileId: string;
}

interface RemoteCursor {
    userId: string;
    userName: string;
    fileId: string;
    lineNumber: number;
    column: number;
    selectionStartLineNumber?: number;
    selectionStartColumn?: number;
    selectionEndLineNumber?: number;
    selectionEndColumn?: number;
}

const BATCH_SIZE = 100;

const Projects = () => {
    const { user } = useAuth();

    const [projects, setProjects] =
        useState<Project[]>([]);

    const [projectName, setProjectName] =
        useState("");

    const [selectedProject, setSelectedProject] =
        useState<Project | null>(null);

    const [files, setFiles] =
        useState<ProjectFile[]>([]);

    const [selectedFile, setSelectedFile] =
        useState<ProjectFile | null>(null);

    const [isEditorMaximized, setIsEditorMaximized] =
        useState(false);

    const [isExplorerCollapsed, setIsExplorerCollapsed] =
        useState(false);

    const [fileContent, setFileContent] =
        useState("");

    const [loadingFile, setLoadingFile] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [uploading, setUploading] =
        useState(false);

    const [deletingFileId, setDeletingFileId] =
        useState<string | null>(null);

    const [uploadProgress, setUploadProgress] =
        useState(0);

    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");

    // ==========================================
    // PROJECT COLLABORATION
    // ==========================================

    const [collaboratorEmail, setCollaboratorEmail] =
        useState("");

    const [invitingCollaborator, setInvitingCollaborator] =
        useState(false);

    const [expandedFolders, setExpandedFolders] =
        useState<Set<string>>(
            new Set()
        );

    // ==========================================
    // SAVE
    // ==========================================

    const [savingFile, setSavingFile] =
        useState(false);

    const [fileSaved, setFileSaved] =
        useState(false);

    // ==========================================
    // EDITOR MAXIMIZE
    // ==========================================

    const toggleEditorMaximize = () => {
        setIsEditorMaximized((previous) => !previous);
    };

    useEffect(() => {
        if (!isEditorMaximized) {
            document.body.style.overflow = "";
            return;
        }

        document.body.style.overflow = "hidden";

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsEditorMaximized(false);
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isEditorMaximized]);

    // ==========================================
    // REAL-TIME
    // ==========================================

    const [collaborators, setCollaborators] =
        useState<FileUser[]>([]);

    const socketRef =
        useRef<Socket | null>(null);

    const applyingRemoteChangeRef =
        useRef(false);

    const editorRef =
        useRef<Parameters<OnMount>[0] | null>(null);

    const monacoRef =
        useRef<Parameters<OnMount>[1] | null>(null);

    const selectedProjectRef =
        useRef<Project | null>(null);

    const selectedFileRef =
        useRef<ProjectFile | null>(null);

    const userRef =
        useRef(user);

    selectedProjectRef.current =
        selectedProject;

    selectedFileRef.current =
        selectedFile;

    userRef.current =
        user;

    const remoteCursorsRef =
        useRef<Map<string, RemoteCursor>>(new Map());

    const remoteDecorationIdsRef =
        useRef<string[]>([]);

    const currentUserColorRef =
        useRef(0);

    const userColorMapRef =
        useRef<Map<string, number>>(new Map());

    const cursorColors = [
        "#22c55e",
        "#38bdf8",
        "#f59e0b",
        "#f472b6",
        "#a78bfa",
        "#fb7185",
        "#2dd4bf",
        "#60a5fa",
    ];

    const getUserColorIndex = (userId: string): number => {
        const existing =
            userColorMapRef.current.get(userId);

        if (existing !== undefined) {
            return existing;
        }

        const nextIndex =
            userColorMapRef.current.size %
            cursorColors.length;

        userColorMapRef.current.set(
            userId,
            nextIndex
        );

        return nextIndex;
    };

    const clearRemoteDecorations = () => {
        if (!editorRef.current) {
            return;
        }

        remoteDecorationIdsRef.current =
            editorRef.current.deltaDecorations(
                remoteDecorationIdsRef.current,
                []
            );
    };

    const updateRemoteDecorations = () => {
        if (
            !editorRef.current ||
            !monacoRef.current ||
            !selectedFile
        ) {
            return;
        }

        const decorations =
            Array.from(
                remoteCursorsRef.current.values()
            )
                .filter(
                    (cursor) =>
                        cursor.fileId ===
                        selectedFile._id
                )
                .flatMap((cursor) => {
                    const colorIndex =
                        getUserColorIndex(
                            cursor.userId
                        );

                    const selectionStartLineNumber =
                        cursor.selectionStartLineNumber ??
                        cursor.lineNumber;

                    const selectionStartColumn =
                        cursor.selectionStartColumn ??
                        cursor.column;

                    const selectionEndLineNumber =
                        cursor.selectionEndLineNumber ??
                        cursor.lineNumber;

                    const selectionEndColumn =
                        cursor.selectionEndColumn ??
                        cursor.column;

                    const hasSelection =
                        selectionStartLineNumber !==
                            selectionEndLineNumber ||
                        selectionStartColumn !==
                            selectionEndColumn;

                    const result: MonacoEditor.IModelDeltaDecoration[] = [
                        {
                            range:
                                new monacoRef.current!.Range(
                                    cursor.lineNumber,
                                    cursor.column,
                                    cursor.lineNumber,
                                    cursor.column
                                ),
                            options: {
                                beforeContentClassName:
                                    `remote-cursor-${colorIndex}`,
                                after: {
                                    content:
                                        ` ${cursor.userName}`,
                                    inlineClassName:
                                        `remote-cursor-label-${colorIndex}`,
                                },
                                hoverMessage: {
                                    value:
                                        cursor.userName,
                                },
                            },
                        },
                    ];

                    if (hasSelection) {
                        result.push({
                            range:
                                new monacoRef.current!.Range(
                                    selectionStartLineNumber,
                                    selectionStartColumn,
                                    selectionEndLineNumber,
                                    selectionEndColumn
                                ),
                            options: {
                                className:
                                    `remote-selection-${colorIndex}`,
                                hoverMessage: {
                                    value:
                                        `${cursor.userName} selection`,
                                },
                            },
                        });
                    }

                    return result;
                });

        remoteDecorationIdsRef.current =
            editorRef.current.deltaDecorations(
                remoteDecorationIdsRef.current,
                decorations
            );
    };

    const handleEditorMount: OnMount = (
        editor,
        monaco
    ) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
    
        const styleId =
            "codecollab-remote-cursors";

        if (!document.getElementById(styleId)) {
            const style =
                document.createElement("style");

            style.id = styleId;

            style.textContent =
                cursorColors
                    .map(
                        (color, index) => `
.remote-cursor-${index} {
    border-left: 2px solid ${color};
    margin-left: -1px;
}
.remote-cursor-label-${index} {
    background: ${color};
    color: #111827 !important;
    border-radius: 3px;
    padding: 1px 4px;
    margin-left: 4px;
    font-size: 11px;
    font-weight: 600;
}
.remote-selection-${index} {
    background: ${color}33;
}
`
                    )
                    .join("\n");

            document.head.appendChild(style);
        }

        editor.onDidChangeCursorPosition(
            (event) => {
                const currentProject =
                    selectedProjectRef.current;

                const currentFile =
                    selectedFileRef.current;

                const currentUser =
                    userRef.current;

                if (
                    !currentProject ||
                    !currentFile ||
                    !socketRef.current ||
                    !currentUser
                ) {
                    return;
                }

                socketRef.current.emit(
                    "file-cursor-change",
                    {
                        projectId:
                            currentProject._id,
                        fileId:
                            currentFile._id,
                        userId:
                            currentUser.id,
                        userName:
                            currentUser.name,
                        lineNumber:
                            event.position.lineNumber,
                        column:
                            event.position.column,
                    }
                );
            }
        );

        editor.onDidChangeCursorSelection(
            (event) => {
                const currentProject =
                    selectedProjectRef.current;

                const currentFile =
                    selectedFileRef.current;

                const currentUser =
                    userRef.current;

                if (
                    !currentProject ||
                    !currentFile ||
                    !socketRef.current ||
                    !currentUser
                ) {
                    return;
                }

                const selection =
                    event.selection;

                socketRef.current.emit(
                    "file-cursor-change",
                    {
                        projectId:
                            currentProject._id,
                        fileId:
                            currentFile._id,
                        userId:
                            currentUser.id,
                        userName:
                            currentUser.name,
                        lineNumber:
                            selection.positionLineNumber,
                        column:
                            selection.positionColumn,
                        selectionStartLineNumber:
                            selection.selectionStartLineNumber,
                        selectionStartColumn:
                            selection.selectionStartColumn,
                       selectionEndLineNumber:
    selection.endLineNumber,

selectionEndColumn:
    selection.endColumn,
                    }
                );
            }
        );
    };

    // ==========================================
    // REFS
    // ==========================================

    const fileInputRef =
        useRef<HTMLInputElement | null>(
            null
        );

    const folderInputRef =
        useRef<HTMLInputElement | null>(
            null
        );

    // ==========================================
    // LOAD PROJECTS
    // ==========================================

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        const handleEscape = (
            event: KeyboardEvent
        ) => {
            if (
                event.key === "Escape" &&
                isEditorMaximized
            ) {
                setIsEditorMaximized(false);
            }
        };

        window.addEventListener(
            "keydown",
            handleEscape
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, [isEditorMaximized]);

    const loadProjects = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await api.get(
                    "/projects"
                );

            setProjects(
                response.data.projects || []
            );
        } catch (err: any) {
            console.error(
                "Load projects error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to load projects"
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // SOCKET CONNECTION
    // ==========================================

    useEffect(() => {
        const socket = io(
            "https://codecollab-backend-se0p.onrender.com",
            {
                auth: {
                    token: localStorage.getItem("accessToken"),
                },
            }
        );

        socketRef.current =
            socket;

        socket.on(
            "connect",
            () => {
                console.log(
                    "Socket connected:",
                    socket.id
                );
            }
        );

        socket.on(
            "disconnect",
            () => {
                console.log(
                    "Socket disconnected"
                );
            }
        );

        socket.on(
            "file-code-update",
            (
                data: FileCodeUpdate
            ) => {
                if (
                    data.fileId !==
                    selectedFile?._id
                ) {
                    return;
                }

                applyingRemoteChangeRef.current =
                    true;

                setFileContent(
                    data.code
                );

                setFileSaved(false);

                setTimeout(() => {
                    applyingRemoteChangeRef.current =
                        false;
                }, 0);
            }
        );

        socket.on(
            "file-user-joined",
            (
                data: FileUser
            ) => {
                if (
                    data.fileId !==
                    selectedFile?._id
                ) {
                    return;
                }

                setCollaborators(
                    (previous) => {
                        const exists =
                            previous.some(
                                (
                                    user
                                ) =>
                                    user.userId ===
                                    data.userId
                            );

                        if (exists) {
                            return previous;
                        }

                        return [
                            ...previous,
                            data,
                        ];
                    }
                );
            }
        );

        socket.on(
            "file-user-left",
            (
                data: FileUser
            ) => {
                setCollaborators(
                    (previous) =>
                        previous.filter(
                            (
                                user
                            ) =>
                                user.userId !==
                                data.userId
                        )
                );

                remoteCursorsRef.current.delete(
                    data.userId
                );

                updateRemoteDecorations();
            }
        );

        socket.on(
            "file-cursor-update",
            (
                data: RemoteCursor
            ) => {
                if (
                    data.fileId !==
                    selectedFile?._id
                ) {
                    return;
                }

                remoteCursorsRef.current.set(
                    data.userId,
                    data
                );

                updateRemoteDecorations();
            }
        );

        return () => {
            socket.disconnect();

            socketRef.current =
                null;
        };
    }, [selectedFile?._id]);

    // ==========================================
    // CREATE PROJECT
    // ==========================================

    const createProject = async () => {
        if (!projectName.trim()) {
            setError(
                "Enter a project name"
            );

            return;
        }

        try {
            setLoading(true);
            setError("");
            setMessage("");

            const response =
                await api.post(
                    "/projects",
                    {
                        name:
                            projectName.trim(),
                    }
                );

            const project =
                response.data.project;

            setProjects(
                (previous) => [
                    project,
                    ...previous,
                ]
            );

            setSelectedProject(
                project
            );

            setFiles([]);

            setSelectedFile(
                null
            );

            setFileContent("");

            setFileSaved(false);

            setProjectName("");

            setMessage(
                "Project created successfully"
            );
        } catch (err: any) {
            console.error(
                "Create project error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to create project"
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // OPEN PROJECT
    // ==========================================

    const openProject = async (
        project: Project
    ) => {
        try {
            setIsEditorMaximized(false);
            setIsExplorerCollapsed(false);

            setSelectedProject(
                project
            );

            setSelectedFile(
                null
            );

            setFileContent("");

            setFileSaved(false);

            setCollaborators([]);

            setError("");
            setMessage("");

            const response =
                await api.get(
                    `/projects/${project._id}`
                );

            // The backend may return a populated project
            // containing owner and collaborator details.
            if (response.data.project) {
                setSelectedProject({
                    ...project,
                    ...response.data.project,
                });
            }

            setFiles(
                response.data.files || []
            );

            setExpandedFolders(
                new Set()
            );
        } catch (err: any) {
            console.error(
                "Open project error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to load project"
            );
        }
    };

    // ==========================================
    // INVITE COLLABORATOR
    // ==========================================

    const inviteCollaborator = async () => {
        if (!selectedProject) {
            return;
        }

        const email = collaboratorEmail.trim().toLowerCase();

        if (!email) {
            setError("Enter a collaborator email");
            return;
        }

        try {
            setInvitingCollaborator(true);
            setError("");
            setMessage("");

            const response = await api.post(
                `/projects/${selectedProject._id}/collaborators`,
                {
                    email,
                }
            );

            const newCollaborator =
                response.data.collaborator;

            setSelectedProject((previous) => {
                if (!previous) {
                    return previous;
                }

                const previousCollaborators =
                    previous.collaborators || [];

                return {
                    ...previous,
                    collaborators: [
                        ...previousCollaborators,
                        newCollaborator,
                    ],
                };
            });

            setCollaboratorEmail("");

            setMessage(
                `${newCollaborator.name} was added as a collaborator.`
            );
        } catch (err: any) {
            console.error(
                "Invite collaborator error:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Failed to add collaborator"
            );
        } finally {
            setInvitingCollaborator(false);
        }
    };

    // ==========================================
    // PROJECT OWNER CHECK
    // ==========================================

    const isProjectOwner = (
        project: Project | null
    ): boolean => {
        if (!project || !user) {
            return false;
        }

        const ownerId =
            typeof project.owner === "string"
                ? project.owner
                : project.owner?._id;

        return ownerId === user.id;
    };

    // ==========================================
    // OPEN FILE
    // ==========================================

    const openFile = async (
        file: ProjectFile
    ) => {
        if (!selectedProject) {
            return;
        }

        try {
            // Leave previous file
            if (
                socketRef.current &&
                selectedFile
            ) {
                socketRef.current.emit(
                    "leave-file",
                    {
                        projectId:
                            selectedProject._id,
                        fileId:
                            selectedFile._id,
                        userId:
                            user?.id ||
                            "unknown-user",
                        userName:
                            user?.name ||
                            "Anonymous",
                    }
                );
            }

            setCollaborators([]);

            remoteCursorsRef.current.clear();
            clearRemoteDecorations();

            setSelectedFile(
                file
            );

            setLoadingFile(true);

            setFileSaved(false);

            setError("");

            setMessage("");

            const response =
                await api.get(
                    `/projects/${selectedProject._id}/files/${file._id}`
                );

            const content =
                response.data.file
                    ?.content || "";

            setFileContent(
                content
            );

            // ==========================================
            // JOIN FILE COLLABORATION
            // ==========================================

            const userId =
                user?.id ||
                "unknown-user";

            const userName =
                user?.name ||
                "Anonymous";

            currentUserColorRef.current =
                getUserColorIndex(userId);

            if (
                socketRef.current
            ) {
                socketRef.current.emit(
                    "join-file",
                    {
                        projectId:
                            selectedProject._id,

                        fileId:
                            file._id,

                        userId,

                        userName,
                    }
                );
            }
        } catch (err: any) {
            console.error(
                "Open file error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to load file"
            );

            setFileContent("");
        } finally {
            setLoadingFile(false);
        }
    };

    // ==========================================
    // SAVE FILE
    // ==========================================

    const saveFile = async () => {
        if (
            !selectedProject ||
            !selectedFile
        ) {
            return;
        }

        try {
            setSavingFile(true);

            setFileSaved(false);

            setError("");

            setMessage("");

            await api.put(
                `/projects/${selectedProject._id}/files/${selectedFile._id}`,
                {
                    content:
                        fileContent,
                }
            );

            setFileSaved(true);

            setMessage(
                `"${selectedFile.path}" saved successfully.`
            );

            setTimeout(() => {
                setFileSaved(false);
            }, 3000);
        } catch (err: any) {
            console.error(
                "Save file error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to save file"
            );
        } finally {
            setSavingFile(false);
        }
    };

    // ==========================================
    // CTRL + S
    // ==========================================

    useEffect(() => {
        const handleKeyDown = (
            event: KeyboardEvent
        ) => {
            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() ===
                    "s"
            ) {
                event.preventDefault();

                if (
                    selectedFile &&
                    !savingFile
                ) {
                    saveFile();
                }
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        selectedFile,
        selectedProject,
        fileContent,
        savingFile,
    ]);

    // ==========================================
    // UPLOAD BATCH
    // ==========================================

    const uploadBatch = async (
        projectId: string,
        batch: File[]
    ) => {
        const formData =
            new FormData();

        const paths: string[] = [];

        batch.forEach(
            (file) => {
                const relativePath =
                    file.webkitRelativePath ||
                    file.name;

                paths.push(
                    relativePath
                );

                formData.append(
                    "files",
                    file
                );
            }
        );

        formData.append(
            "paths",
            JSON.stringify(
                paths
            )
        );

        return api.post(
            `/projects/${projectId}/upload`,
            formData
        );
    };

    // ==========================================
    // UPLOAD FILES
    // ==========================================

    const uploadFiles = async (
        selectedFiles: FileList
    ) => {
        if (!selectedProject) {
            setError(
                "Create or select a project first"
            );

            return;
        }

        if (
            selectedFiles.length ===
            0
        ) {
            return;
        }

        try {
            setUploading(true);
            setError("");
            setMessage("");
            setUploadProgress(0);

            const allFiles =
                Array.from(
                    selectedFiles
                );

            const totalFiles =
                allFiles.length;

            const totalBatches =
                Math.ceil(
                    totalFiles /
                        BATCH_SIZE
                );

            let uploadedCount = 0;

            for (
                let i = 0;
                i < totalFiles;
                i += BATCH_SIZE
            ) {
                const batch =
                    allFiles.slice(
                        i,
                        i +
                            BATCH_SIZE
                    );

                const currentBatch =
                    Math.floor(
                        i /
                            BATCH_SIZE
                    ) + 1;

                setMessage(
                    `Uploading batch ${currentBatch} of ${totalBatches}...`
                );

                await uploadBatch(
                    selectedProject._id,
                    batch
                );

                uploadedCount +=
                    batch.length;

                const progress =
                    Math.round(
                        (uploadedCount /
                            totalFiles) *
                            100
                    );

                setUploadProgress(
                    progress
                );
            }

            const response =
                await api.get(
                    `/projects/${selectedProject._id}`
                );

            setFiles(
                response.data.files || []
            );

            setMessage(
                `${totalFiles} file(s) uploaded successfully.`
            );
        } catch (err: any) {
            console.error(
                "Upload error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "File upload failed"
            );
        } finally {
            setUploading(false);
        }
    };

    // ==========================================
    // SINGLE FILE UPLOAD
    // ==========================================

    const handleFileUpload =
        async (
            event: ChangeEvent<HTMLInputElement>
        ) => {
            const selectedFiles =
                event.target.files;

            if (!selectedFiles) {
                return;
            }

            await uploadFiles(
                selectedFiles
            );

            event.target.value = "";
        };

    // ==========================================
    // FOLDER UPLOAD
    // ==========================================

    const handleFolderUpload =
        async (
            event: ChangeEvent<HTMLInputElement>
        ) => {
            const selectedFiles =
                event.target.files;

            if (!selectedFiles) {
                return;
            }

            await uploadFiles(
                selectedFiles
            );

            event.target.value = "";
        };

    // ==========================================
    // FILE PICKERS
    // ==========================================

    const openFilePicker = () => {
        fileInputRef.current?.click();
    };

    const openFolderPicker = () => {
        folderInputRef.current?.click();
    };

    // ==========================================
    // DELETE FILE
    // ==========================================

    const deleteFile = async (
        file: ProjectFile
    ) => {
        if (!selectedProject) {
            return;
        }

        const confirmed =
            window.confirm(
                `Delete "${file.path}"?`
            );

        if (!confirmed) {
            return;
        }

        try {
            setDeletingFileId(
                file._id
            );

            setError("");
            setMessage("");

            if (
                selectedFile?._id ===
                file._id &&
                socketRef.current
            ) {
                socketRef.current.emit(
                    "leave-file",
                    {
                        projectId:
                            selectedProject._id,
                        fileId:
                            file._id,
                        userId:
                            user?.id ||
                            "unknown-user",
                        userName:
                            user?.name ||
                            "Anonymous",
                    }
                );
            }

            await api.delete(
                `/projects/${selectedProject._id}/files/${file._id}`
            );

            setFiles(
                (previous) =>
                    previous.filter(
                        (item) =>
                            item._id !==
                            file._id
                    )
            );

            if (
                selectedFile?._id ===
                file._id
            ) {
                setSelectedFile(
                    null
                );

                setFileContent("");

                setFileSaved(false);

                setCollaborators([]);
            }

            setMessage(
                `"${file.path}" deleted successfully.`
            );
        } catch (err: any) {
            console.error(
                "Delete file error:",
                err
            );

            setError(
                err.response?.data
                    ?.message ||
                "Failed to delete file"
            );
        } finally {
            setDeletingFileId(
                null
            );
        }
    };

    // ==========================================
    // BUILD FILE TREE
    // ==========================================

    const buildFileTree = (
        projectFiles: ProjectFile[]
    ): FileTreeNode[] => {
        const root: FileTreeNode[] =
            [];

        projectFiles.forEach(
            (file) => {
                const normalizedPath =
                    file.path
                        .replace(
                            /\\/g,
                            "/"
                        )
                        .replace(
                            /^\/+/,
                            ""
                        );

                const parts =
                    normalizedPath
                        .split("/")
                        .filter(
                            Boolean
                        );

                let currentLevel =
                    root;

                let currentPath =
                    "";

                parts.forEach(
                    (
                        part,
                        index
                    ) => {
                        currentPath =
                            currentPath
                                ? `${currentPath}/${part}`
                                : part;

                        const isFile =
                            index ===
                            parts.length -
                                1;

                        let node =
                            currentLevel.find(
                                (
                                    item
                                ) =>
                                    item.name ===
                                        part &&
                                    item.type ===
                                        (isFile
                                            ? "file"
                                            : "folder")
                            );

                        if (!node) {
                            node = {
                                name:
                                    part,

                                path:
                                    currentPath,

                                type:
                                    isFile
                                        ? "file"
                                        : "folder",

                                file:
                                    isFile
                                        ? file
                                        : undefined,

                                children:
                                    [],
                            };

                            currentLevel.push(
                                node
                            );
                        }

                        currentLevel =
                            node.children;
                    }
                );
            }
        );

        const sortTree = (
            nodes: FileTreeNode[]
        ) => {
            nodes.sort(
                (a, b) => {
                    if (
                        a.type !==
                        b.type
                    ) {
                        return (
                            a.type ===
                            "folder"
                                ? -1
                                : 1
                        );
                    }

                    return a.name.localeCompare(
                        b.name
                    );
                }
            );

            nodes.forEach(
                (node) => {
                    if (
                        node.children
                            .length >
                        0
                    ) {
                        sortTree(
                            node.children
                        );
                    }
                }
            );
        };

        sortTree(root);

        return root;
    };

    // ==========================================
    // TOGGLE FOLDER
    // ==========================================

    const toggleFolder = (
        folderPath: string
    ) => {
        setExpandedFolders(
            (previous) => {
                const next =
                    new Set(
                        previous
                    );

                if (
                    next.has(
                        folderPath
                    )
                ) {
                    next.delete(
                        folderPath
                    );
                } else {
                    next.add(
                        folderPath
                    );
                }

                return next;
            }
        );
    };

    // ==========================================
    // FILE ICON
    // ==========================================

    const getFileIcon = (
        fileName: string
    ): string => {
        const extension =
            fileName
                .split(".")
                .pop()
                ?.toLowerCase();

        switch (
            extension
        ) {
            case "js":
                return "🟨";

            case "jsx":
                return "⚛️";

            case "ts":
                return "🔷";

            case "tsx":
                return "⚛️";

            case "cpp":
            case "cc":
            case "cxx":
                return "🟦";

            case "c":
                return "🔵";

            case "py":
                return "🐍";

            case "java":
                return "☕";

            case "go":
                return "🐹";

            case "rs":
                return "🦀";

            case "html":
                return "🌐";

            case "css":
                return "🎨";

            case "json":
                return "🧾";

            case "md":
                return "📝";

            case "sql":
                return "🗄️";

            case "png":
            case "jpg":
            case "jpeg":
            case "gif":
            case "webp":
                return "🖼️";

            case "svg":
                return "🔶";

            case "pdf":
                return "📕";

            case "zip":
                return "🗜️";

            default:
                return "📄";
        }
    };

    // ==========================================
    // MONACO LANGUAGE
    // ==========================================

    const getEditorLanguage = (
        file: ProjectFile
    ): string => {
        if (
            file.language
        ) {
            return file.language;
        }

        const extension =
            file.name
                .split(".")
                .pop()
                ?.toLowerCase();

        const languages: Record<
            string,
            string
        > = {
            js: "javascript",
            jsx: "javascript",
            ts: "typescript",
            tsx: "typescript",
            cpp: "cpp",
            cc: "cpp",
            cxx: "cpp",
            c: "c",
            py: "python",
            java: "java",
            go: "go",
            rs: "rust",
            html: "html",
            css: "css",
            json: "json",
            md: "markdown",
            sql: "sql",
        };

        return (
            languages[
                extension || ""
            ] ||
            "plaintext"
        );
    };

    // ==========================================
    // MONACO CODE CHANGE
    // ==========================================

    const handleEditorChange = (
        value: string | undefined
    ) => {
        const newContent =
            value || "";

        setFileContent(
            newContent
        );

        setFileSaved(false);

        setMessage("");

        // Don't broadcast remote changes
        if (
            applyingRemoteChangeRef.current
        ) {
            return;
        }

        if (
            !selectedProject ||
            !selectedFile ||
            !socketRef.current
        ) {
            return;
        }

        socketRef.current.emit(
            "file-code-change",
            {
                projectId:
                    selectedProject._id,

                fileId:
                    selectedFile._id,

                code:
                    newContent,
            }
        );
    };

    // ==========================================
    // RENDER TREE
    // ==========================================

    const renderTree = (
        nodes: FileTreeNode[],
        depth = 0
    ): ReactNode => {
        return nodes.map(
            (node) => {
                // FOLDER

                if (
                    node.type ===
                    "folder"
                ) {
                    const expanded =
                        expandedFolders.has(
                            node.path
                        );

                    return (
                        <div
                            key={
                                node.path
                            }
                        >
                            <div
                                onClick={() =>
                                    toggleFolder(
                                        node.path
                                    )
                                }
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    height:
                                        "30px",
                                    paddingLeft:
                                        `${
                                            8 +
                                            depth *
                                                20
                                        }px`,
                                    cursor:
                                        "pointer",
                                    userSelect:
                                        "none",
                                }}
                                onMouseEnter={(
                                    event
                                ) => {
                                    event.currentTarget.style.background =
                                        "#1e2530";
                                }}
                                onMouseLeave={(
                                    event
                                ) => {
                                    event.currentTarget.style.background =
                                        "transparent";
                                }}
                            >
                                <span
                                    style={{
                                        width:
                                            "18px",
                                        color:
                                            "#9ca3af",
                                    }}
                                >
                                    {expanded
                                        ? "⌄"
                                        : "›"}
                                </span>

                                <span>
                                    {expanded
                                        ? "📂"
                                        : "📁"}
                                </span>

                                <span
                                    style={{
                                        marginLeft:
                                            "7px",
                                        color:
                                            "#d4d4d4",
                                        fontSize:
                                            "14px",
                                    }}
                                >
                                    {
                                        node.name
                                    }
                                </span>
                            </div>

                            {expanded &&
                                renderTree(
                                    node.children,
                                    depth +
                                        1
                                )}
                        </div>
                    );
                }

                // FILE

                const projectFile =
                    node.file;

                if (!projectFile) {
                    return null;
                }

                const isSelected =
                    selectedFile?._id ===
                    projectFile._id;

                const deleting =
                    deletingFileId ===
                    projectFile._id;

                return (
                    <div
                        key={
                            node.path
                        }
                        onClick={() =>
                            openFile(
                                projectFile
                            )
                        }
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            height:
                                "30px",
                            paddingLeft:
                                `${
                                    8 +
                                    depth *
                                        20
                                }px`,
                            paddingRight:
                                "8px",
                            cursor:
                                "pointer",
                            background:
                                isSelected
                                    ? "#37373d"
                                    : "transparent",
                        }}
                        onMouseEnter={(
                            event
                        ) => {
                            if (
                                !isSelected
                            ) {
                                event.currentTarget.style.background =
                                    "#1e2530";
                            }

                            const button =
                                event.currentTarget.querySelector(
                                    ".delete-file-button"
                                ) as HTMLElement | null;

                            if (button) {
                                button.style.opacity =
                                    "1";
                            }
                        }}
                        onMouseLeave={(
                            event
                        ) => {
                            if (
                                !isSelected
                            ) {
                                event.currentTarget.style.background =
                                    "transparent";
                            }

                            const button =
                                event.currentTarget.querySelector(
                                    ".delete-file-button"
                                ) as HTMLElement | null;

                            if (button) {
                                button.style.opacity =
                                    "0";
                            }
                        }}
                    >
                        <span
                            style={{
                                width:
                                    "18px",
                            }}
                        />

                        <span>
                            {getFileIcon(
                                node.name
                            )}
                        </span>

                        <span
                            style={{
                                marginLeft:
                                    "7px",
                                color:
                                    isSelected
                                        ? "#ffffff"
                                        : "#d4d4d4",
                                fontSize:
                                    "14px",
                                flex: 1,
                            }}
                        >
                            {
                                node.name
                            }
                        </span>

                        <button
                            className="delete-file-button"
                            onClick={(
                                event
                            ) => {
                                event.stopPropagation();

                                deleteFile(
                                    projectFile
                                );
                            }}
                            disabled={
                                deleting
                            }
                            title="Delete file"
                            style={{
                                opacity:
                                    "0",
                                border:
                                    "none",
                                background:
                                    "transparent",
                                color:
                                    "#f87171",
                                cursor:
                                    "pointer",
                                fontSize:
                                    "13px",
                            }}
                        >
                            {deleting
                                ? "..."
                                : "🗑️"}
                        </button>
                    </div>
                );
            }
        );
    };

    const fileTree =
        buildFileTree(files);

    // ==========================================
    // UI
    // ==========================================

    return (
        <div
            style={{
                minHeight:
                    "100vh",
                background:
                    "#0b0d12",
                color:
                    "#ffffff",
                padding:
                    "30px",
            }}
        >
            <h1>
                CodeCollab Projects
            </h1>

            <p
                style={{
                    color:
                        "#9ca3af",
                }}
            >
                Upload and manage
                your projects
            </p>

            {/* CREATE PROJECT */}

            <div
                style={{
                    display:
                        "flex",
                    gap:
                        "10px",
                    marginTop:
                        "25px",
                    marginBottom:
                        "20px",
                }}
            >
                <input
                    type="text"
                    placeholder="Project name"
                    value={
                        projectName
                    }
                    onChange={(
                        event
                    ) =>
                        setProjectName(
                            event
                                .target
                                .value
                        )
                    }
                    onKeyDown={(
                        event
                    ) => {
                        if (
                            event.key ===
                            "Enter"
                        ) {
                            createProject();
                        }
                    }}
                    style={{
                        padding:
                            "12px",
                        width:
                            "300px",
                        borderRadius:
                            "8px",
                        border:
                            "1px solid #333",
                        background:
                            "#151821",
                        color:
                            "#ffffff",
                    }}
                />

                <button
                    onClick={
                        createProject
                    }
                    disabled={
                        loading
                    }
                    style={{
                        padding:
                            "12px 20px",
                        borderRadius:
                            "8px",
                        border:
                            "none",
                        cursor:
                            "pointer",
                    }}
                >
                    {loading
                        ? "Creating..."
                        : "Create Project"}
                </button>
            </div>

            {/* MESSAGE */}

            {message && (
                <p
                    style={{
                        color:
                            "#4ade80",
                    }}
                >
                    {message}
                </p>
            )}

            {/* ERROR */}

            {error && (
                <p
                    style={{
                        color:
                            "#f87171",
                    }}
                >
                    {error}
                </p>
            )}

            {/* UPLOAD PROGRESS */}

            {uploading && (
                <div
                    style={{
                        marginBottom:
                            "20px",
                    }}
                >
                    <p>
                        Uploading:{" "}
                        {
                            uploadProgress
                        }
                        %
                    </p>

                    <div
                        style={{
                            width:
                                "500px",
                            maxWidth:
                                "100%",
                            height:
                                "8px",
                            background:
                                "#252936",
                            borderRadius:
                                "10px",
                            overflow:
                                "hidden",
                        }}
                    >
                        <div
                            style={{
                                width:
                                    `${uploadProgress}%`,
                                height:
                                    "100%",
                                background:
                                    "#4ade80",
                            }}
                        />
                    </div>
                </div>
            )}

            {/* MAIN */}

            <div
                style={{
                    display:
                        "flex",
                    gap:
                        "20px",
                    marginTop:
                        "20px",
                    alignItems:
                        "stretch",
                    minHeight:
                        "650px",
                }}
            >
                {/* PROJECT LIST */}

                <div
                    style={{
                        width:
                            "240px",
                        minWidth:
                            "240px",
                        border:
                            "1px solid #252936",
                        borderRadius:
                            "8px",
                        padding:
                            "15px",
                        background:
                            "#11141b",
                    }}
                >
                    <h2
                        style={{
                            fontSize:
                                "18px",
                        }}
                    >
                        My Projects
                    </h2>

                    {projects.map(
                        (
                            project
                        ) => (
                            <button
                                key={
                                    project._id
                                }
                                onClick={() =>
                                    openProject(
                                        project
                                    )
                                }
                                style={{
                                    display:
                                        "block",
                                    width:
                                        "100%",
                                    textAlign:
                                        "left",
                                    padding:
                                        "10px",
                                    marginBottom:
                                        "6px",
                                    borderRadius:
                                        "6px",
                                    border:
                                        "1px solid #333",
                                    background:
                                        selectedProject?._id ===
                                        project._id
                                            ? "#252a36"
                                            : "#151821",
                                    color:
                                        "#ffffff",
                                    cursor:
                                        "pointer",
                                }}
                            >
                                📁{" "}
                                {
                                    project.name
                                }
                            </button>
                        )
                    )}
                </div>

                {/* PROJECT */}

                <div
                    style={{
                        flex:
                            1,
                        minWidth:
                            "0",
                        border:
                            "1px solid #252936",
                        borderRadius:
                            "8px",
                        overflow:
                            "hidden",
                        background:
                            "#11141b",
                    }}
                >
                    {!selectedProject ? (
                        <div
                            style={{
                                padding:
                                    "30px",
                            }}
                        >
                            <h2>
                                Select a
                                project
                            </h2>
                        </div>
                    ) : (
                        <>
                            {/* PROJECT HEADER */}

                            <div
                                style={{
                                    padding:
                                        "15px 20px",
                                    borderBottom:
                                        "1px solid #252936",
                                }}
                            >
                                <h2
                                    style={{
                                        margin:
                                            "0 0 15px",
                                    }}
                                >
                                    📁{" "}
                                    {
                                        selectedProject.name
                                    }
                                </h2>

                                {/* COLLABORATORS */}

                                <div
                                    style={{
                                        marginBottom:
                                            "15px",
                                        padding:
                                            "12px",
                                        border:
                                            "1px solid #252936",
                                        borderRadius:
                                            "8px",
                                        background:
                                            "#151821",
                                    }}
                                >
                                    <div
                                        style={{
                                            display:
                                                "flex",
                                            alignItems:
                                                "center",
                                            justifyContent:
                                                "space-between",
                                            marginBottom:
                                                "10px",
                                        }}
                                    >
                                        <strong
                                            style={{
                                                fontSize:
                                                    "13px",
                                            }}
                                        >
                                            👥 Collaborators
                                        </strong>

                                        <span
                                            style={{
                                                color:
                                                    "#9ca3af",
                                                fontSize:
                                                    "12px",
                                            }}
                                        >
                                            {(selectedProject.collaborators || []).length}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display:
                                                "flex",
                                            flexWrap:
                                                "wrap",
                                            gap:
                                                "6px",
                                            marginBottom:
                                                isProjectOwner(
                                                    selectedProject
                                                )
                                                    ? "10px"
                                                    : "0",
                                        }}
                                    >
                                        {selectedProject.owner && (
                                            <span
                                                style={{
                                                    padding:
                                                        "5px 9px",
                                                    borderRadius:
                                                        "15px",
                                                    background:
                                                        "#252a36",
                                                    color:
                                                        "#ffffff",
                                                    fontSize:
                                                        "12px",
                                                }}
                                            >
                                                👑{" "}
                                                {typeof selectedProject.owner ===
                                                "string"
                                                    ? "Owner"
                                                    : selectedProject.owner.email}
                                            </span>
                                        )}

                                        {(selectedProject.collaborators || []).map(
                                            (collaborator) => (
                                                <span
                                                    key={
                                                        collaborator._id
                                                    }
                                                    style={{
                                                        padding:
                                                            "5px 9px",
                                                        borderRadius:
                                                            "15px",
                                                        background:
                                                            "#202938",
                                                        color:
                                                            "#d1d5db",
                                                        fontSize:
                                                            "12px",
                                                    }}
                                                    title={
                                                        collaborator.email
                                                    }
                                                >
                                                    👤{" "}
                                                    {
                                                        collaborator.name
                                                    }
                                                </span>
                                            )
                                        )}
                                    </div>

                                    {isProjectOwner(
                                        selectedProject
                                    ) && (
                                        <div
                                            style={{
                                                display:
                                                    "flex",
                                                gap:
                                                    "8px",
                                            }}
                                        >
                                            <input
                                                type="email"
                                                value={
                                                    collaboratorEmail
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setCollaboratorEmail(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                onKeyDown={(
                                                    event
                                                ) => {
                                                    if (
                                                        event.key ===
                                                        "Enter"
                                                    ) {
                                                        inviteCollaborator();
                                                    }
                                                }}
                                                placeholder="Enter user's email"
                                                disabled={
                                                    invitingCollaborator
                                                }
                                                style={{
                                                    flex:
                                                        1,
                                                    minWidth:
                                                        "220px",
                                                    padding:
                                                        "8px 10px",
                                                    borderRadius:
                                                        "6px",
                                                    border:
                                                        "1px solid #333",
                                                    background:
                                                        "#0f1117",
                                                    color:
                                                        "#ffffff",
                                                    outline:
                                                        "none",
                                                }}
                                            />

                                            <button
                                                onClick={
                                                    inviteCollaborator
                                                }
                                                disabled={
                                                    invitingCollaborator ||
                                                    !collaboratorEmail.trim()
                                                }
                                                style={{
                                                    padding:
                                                        "8px 14px",
                                                    borderRadius:
                                                        "6px",
                                                    border:
                                                        "none",
                                                    background:
                                                        invitingCollaborator
                                                            ? "#374151"
                                                            : "#2563eb",
                                                    color:
                                                        "#ffffff",
                                                    cursor:
                                                        invitingCollaborator ||
                                                        !collaboratorEmail.trim()
                                                            ? "not-allowed"
                                                            : "pointer",
                                                    whiteSpace:
                                                        "nowrap",
                                                }}
                                            >
                                                {invitingCollaborator
                                                    ? "Inviting..."
                                                    : "Invite"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* FILE INPUT */}

                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    type="file"
                                    hidden
                                    onChange={
                                        handleFileUpload
                                    }
                                />

                                {/* FOLDER INPUT */}

                                <input
                                    ref={
                                        folderInputRef
                                    }
                                    type="file"
                                    hidden
                                    multiple
                                    {...({
                                        webkitdirectory:
                                            "",
                                        directory:
                                            "",
                                    } as any)}
                                    onChange={
                                        handleFolderUpload
                                    }
                                />

                                <div
                                    style={{
                                        display:
                                            "flex",
                                        gap:
                                            "10px",
                                    }}
                                >
                                    <button
                                        onClick={
                                            openFilePicker
                                        }
                                        disabled={
                                            uploading
                                        }
                                        style={{
                                            padding:
                                                "9px 15px",
                                            borderRadius:
                                                "6px",
                                            border:
                                                "none",
                                            cursor:
                                                "pointer",
                                        }}
                                    >
                                        📄 Upload File
                                    </button>

                                    <button
                                        onClick={
                                            openFolderPicker
                                        }
                                        disabled={
                                            uploading
                                        }
                                        style={{
                                            padding:
                                                "9px 15px",
                                            borderRadius:
                                                "6px",
                                            border:
                                                "none",
                                            cursor:
                                                "pointer",
                                        }}
                                    >
                                        📁 Upload Folder
                                    </button>
                                </div>
                            </div>

                            {/* VS CODE WORKSPACE */}

                            <div
                                style={{
                                    display:
                                        "flex",
                                    height:
                                        isEditorMaximized
                                            ? "100dvh"
                                            : "600px",
                                    minHeight:
                                        isEditorMaximized
                                            ? "100dvh"
                                            : "600px",
                                    position:
                                        isEditorMaximized
                                            ? "fixed"
                                            : "relative",
                                    top:
                                        isEditorMaximized
                                            ? "0px"
                                            : "auto",
                                    left:
                                        isEditorMaximized
                                            ? "0px"
                                            : "auto",
                                    right:
                                        isEditorMaximized
                                            ? "0px"
                                            : "auto",
                                    bottom:
                                        isEditorMaximized
                                            ? "0px"
                                            : "auto",
                                    width:
                                        isEditorMaximized
                                            ? "100vw"
                                            : "100%",
                                    maxWidth:
                                        isEditorMaximized
                                            ? "100vw"
                                            : "none",
                                    zIndex:
                                        isEditorMaximized
                                            ? 2147483647
                                            : "auto",
                                    overflow:
                                        "hidden",
                                    background:
                                        "#1e1e1e",
                                    boxShadow:
                                        isEditorMaximized
                                            ? "0 0 30px rgba(0,0,0,0.55)"
                                            : "none",
                                }}
                            >
                                {/* EXPLORER */}

                                {!isExplorerCollapsed && (
                                    <div
                                        style={{
                                            width:
                                                "280px",
                                            minWidth:
                                                "280px",
                                            background:
                                                "#181a20",
                                            borderRight:
                                                "1px solid #252936",
                                            overflowY:
                                                "auto",
                                        }}
                                    >
                                    <div
                                        style={{
                                            padding:
                                                "10px 12px",
                                            fontSize:
                                                "12px",
                                            fontWeight:
                                                "600",
                                            letterSpacing:
                                                "0.5px",
                                            color:
                                                "#9ca3af",
                                        }}
                                    >
                                        EXPLORER
                                    </div>

                                    <div>
                                        {fileTree.length ===
                                        0 ? (
                                            <p
                                                style={{
                                                    padding:
                                                        "12px",
                                                    color:
                                                        "#6b7280",
                                                    fontSize:
                                                        "13px",
                                                }}
                                            >
                                                No
                                                files
                                                uploaded
                                                yet.
                                            </p>
                                        ) : (
                                            renderTree(
                                                fileTree
                                            )
                                        )}
                                    </div>
                                    </div>
                                )}

                                {/* EDITOR */}

                                <div
                                    style={{
                                        flex:
                                            1,
                                        minWidth:
                                            "0",
                                        background:
                                            "#1e1e1e",
                                        display:
                                            "flex",
                                        flexDirection:
                                            "column",
                                    }}
                                >
                                    {/* EDITOR TAB */}

                                    {selectedFile && (
                                        <div
                                            style={{
                                                height:
                                                    "40px",
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                padding:
                                                    "0 15px",
                                                background:
                                                    "#181818",
                                                borderBottom:
                                                    "1px solid #333",
                                                color:
                                                    "#ffffff",
                                                fontSize:
                                                    "13px",
                                            }}
                                        >
                                            <span>
                                                {getFileIcon(
                                                    selectedFile.name
                                                )}
                                            </span>

                                            <span
                                                style={{
                                                    marginLeft:
                                                        "8px",
                                                }}
                                            >
                                                {
                                                    selectedFile.name
                                                }
                                            </span>

                                            <span
                                                style={{
                                                    marginLeft:
                                                        "15px",
                                                    color:
                                                        "#666",
                                                    fontSize:
                                                        "11px",
                                                }}
                                            >
                                                {
                                                    selectedFile.path
                                                }
                                            </span>

                                            {/* EDITOR CONTROLS */}

                                            <div
                                                style={{
                                                    marginLeft:
                                                        "auto",
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    gap:
                                                        "6px",
                                                    marginRight:
                                                        "10px",
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setIsExplorerCollapsed(
                                                            (previous) =>
                                                                !previous
                                                        )
                                                    }
                                                    title={
                                                        isExplorerCollapsed
                                                            ? "Show Explorer"
                                                            : "Hide Explorer"
                                                    }
                                                    style={{
                                                        padding:
                                                            "5px 9px",
                                                        borderRadius:
                                                            "5px",
                                                        border:
                                                            "1px solid #3a3d45",
                                                        background:
                                                            "#252936",
                                                        color:
                                                            "#d1d5db",
                                                        cursor:
                                                            "pointer",
                                                        fontSize:
                                                            "12px",
                                                    }}
                                                >
                                                    {isExplorerCollapsed
                                                        ? "📂 Explorer"
                                                        : "◀ Explorer"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={
                                                        toggleEditorMaximize
                                                    }
                                                    title={
                                                        isEditorMaximized
                                                            ? "Exit maximize"
                                                            : "Maximize editor"
                                                    }
                                                    style={{
                                                        padding:
                                                            "5px 9px",
                                                        borderRadius:
                                                            "5px",
                                                        border:
                                                            "1px solid #3a3d45",
                                                        background:
                                                            "#252936",
                                                        color:
                                                            "#d1d5db",
                                                        cursor:
                                                            "pointer",
                                                        fontSize:
                                                            "12px",
                                                    }}
                                                >
                                                    {isEditorMaximized
                                                        ? "⛶ Exit"
                                                        : "⛶ Maximize"}
                                                </button>
                                            </div>

                                            {/* COLLABORATORS */}

                                            <div
                                                style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginRight: "10px",
}}
                                            >
                                                <span
                                                    style={{
                                                        color:
                                                            "#4ade80",
                                                        fontSize:
                                                            "11px",
                                                    }}
                                                >
                                                    ●
                                                </span>

                                                <span
                                                    style={{
                                                        color:
                                                            "#9ca3af",
                                                        fontSize:
                                                            "11px",
                                                    }}
                                                >
                                                    {collaborators.length +
                                                        1}{" "}
                                                    online
                                                </span>
                                            </div>

                                            {/* SAVE */}

                                            <button
                                                onClick={
                                                    saveFile
                                                }
                                                disabled={
                                                    savingFile
                                                }
                                                style={{
                                                    padding:
                                                        "6px 12px",
                                                    borderRadius:
                                                        "5px",
                                                    border:
                                                        "1px solid #3a3d45",
                                                    background:
                                                        savingFile
                                                            ? "#252936"
                                                            : fileSaved
                                                            ? "#256d3d"
                                                            : "#2d7d46",
                                                    color:
                                                        "#ffffff",
                                                    cursor:
                                                        savingFile
                                                            ? "not-allowed"
                                                            : "pointer",
                                                    fontSize:
                                                        "12px",
                                                }}
                                            >
                                                {savingFile
                                                    ? "Saving..."
                                                    : fileSaved
                                                    ? "✓ Saved"
                                                    : "💾 Save"}
                                            </button>
                                        </div>
                                    )}

                                    {/* EDITOR */}

                                    <div
                                        style={{
                                            flex:
                                                1,
                                        }}
                                    >
                                        {loadingFile ? (
                                            <div
                                                style={{
                                                    height:
                                                        "100%",
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "center",
                                                    color:
                                                        "#9ca3af",
                                                }}
                                            >
                                                Loading
                                                file...
                                            </div>
                                        ) : selectedFile ? (
                                            <Editor
                                                height="100%"
                                                theme="vs-dark"
                                                language={getEditorLanguage(
                                                    selectedFile
                                                )}
                                                value={
                                                    fileContent
                                                }
                                                onChange={
                                                    handleEditorChange
                                                }
                                                onMount={
                                                    handleEditorMount
                                                }
                                                options={{
                                                    minimap:
                                                        {
                                                            enabled:
                                                                true,
                                                        },
                                                    fontSize:
                                                        14,
                                                    automaticLayout:
                                                        true,
                                                    wordWrap:
                                                        "off",
                                                    scrollBeyondLastLine:
                                                        false,
                                                }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    height:
                                                        "100%",
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "center",
                                                    color:
                                                        "#6b7280",
                                                    flexDirection:
                                                        "column",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize:
                                                            "40px",
                                                        marginBottom:
                                                            "15px",
                                                    }}
                                                >
                                                    💻
                                                </div>

                                                <div>
                                                    Select
                                                    a file
                                                    from
                                                    Explorer
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}

                            <div
                                style={{
                                    padding:
                                        "8px 15px",
                                    borderTop:
                                        "1px solid #252936",
                                    color:
                                        "#6b7280",
                                    fontSize:
                                        "12px",
                                    display:
                                        "flex",
                                    justifyContent:
                                        "space-between",
                                }}
                            >
                                <span>
                                    {
                                        files.length
                                    }{" "}
                                    files
                                </span>

                                {selectedFile && (
                                    <span>
                                        🔄 Real-time
                                        collaboration
                                        enabled
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Projects;