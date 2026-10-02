import { Response } from "express";

import { Room } from "../models/Room.js";
import { RoomFile } from "../models/RoomFile.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

interface IncomingRoomFile {
    name: string;
    path: string;
    content: string;
    language?: string;
}

const MAX_FILES_PER_BATCH = 100;
const MAX_FILE_CONTENT = 500_000;

// ==========================================
// CHECK ROOM MEMBERSHIP
// ==========================================

const isRoomMember = async (
    roomId: string,
    userId: string
): Promise<boolean> => {
    const room = await Room.findOne({
        roomId,
    }).select("owner participants status");

    if (!room) {
        return false;
    }

    return (
        room.owner.toString() === userId ||
        room.participants.some(
            (participant) =>
                participant.toString() === userId
        )
    );
};

// ==========================================
// NORMALIZE FILE PATH
// ==========================================

const normalizePath = (
    value: string
): string =>
    value
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean)
        .join("/");

// ==========================================
// DETERMINE LANGUAGE
// ==========================================

const getLanguage = (
    name: string
): string | undefined => {
    const extension = name
        .split(".")
        .pop()
        ?.toLowerCase();

    const languages: Record<string, string> = {
        c: "c",
        h: "c",

        cpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        hpp: "cpp",

        py: "python",

        js: "javascript",
        jsx: "javascript",

        ts: "typescript",
        tsx: "typescript",

        java: "java",

        html: "html",
        css: "css",

        json: "json",
        md: "markdown",
        txt: "plaintext",
    };

    return extension
        ? languages[extension]
        : undefined;
};

// ==========================================
// VALIDATE MONGODB OBJECT ID
// ==========================================

const mongooseIdValid = (
    value: string
): boolean =>
    /^[a-fA-F0-9]{24}$/.test(value);

// ==========================================
// GET ALL ROOM FILES
// ==========================================

export const getRoomFiles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const roomId = String(
            req.params.roomId
        );

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message:
                    "Authentication required",
            });
            return;
        }

        const room = await Room.findOne({
            roomId,
        }).select(
            "owner participants status"
        );

        if (!room) {
            res.status(404).json({
                success: false,
                message: "Room not found",
            });
            return;
        }

        if (
            !(await isRoomMember(
                roomId,
                req.userId
            ))
        ) {
            res.status(403).json({
                success: false,
                message:
                    "You are not a member of this room",
            });
            return;
        }

        // ======================================
        // MIGRATE OLD FILES
        // ======================================
        //
        // Files created before version tracking
        // was introduced may not have a version
        // field stored in MongoDB.
        //
        // Initialize them to version 1.
        //

        await RoomFile.updateMany(
            {
                roomId,
                version: {
                    $exists: false,
                },
            },
            {
                $set: {
                    version: 1,
                },
            }
        );

        const files =
            await RoomFile.find({
                roomId,
            })
                .select(
                    "_id name path language size version"
                )
                .sort({
                    path: 1,
                })
                .lean();

        res.status(200).json({
            success: true,
            files,
        });
    } catch (error) {
        console.error(
            "Get room files error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

// ==========================================
// CREATE / UPDATE FILES IN BULK
// ==========================================

export const upsertRoomFiles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const roomId = String(
            req.params.roomId
        );

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message:
                    "Authentication required",
            });
            return;
        }

        if (
            !(await isRoomMember(
                roomId,
                req.userId
            ))
        ) {
            res.status(403).json({
                success: false,
                message:
                    "You are not a member of this room",
            });
            return;
        }

        const room =
            await Room.findOne({
                roomId,
            }).select("status");

        if (!room) {
            res.status(404).json({
                success: false,
                message:
                    "Room not found",
            });
            return;
        }

        if (
            room.status ===
            "completed"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Completed rooms are read-only",
            });
            return;
        }

        const files =
            req.body?.files;

        if (
            !Array.isArray(files) ||
            files.length === 0
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Files are required",
            });
            return;
        }

        if (
            files.length >
            MAX_FILES_PER_BATCH
        ) {
            res.status(400).json({
                success: false,
                message:
                    `Maximum ${MAX_FILES_PER_BATCH} files per batch`,
            });
            return;
        }

        const normalizedFiles: IncomingRoomFile[] =
            [];

        const seenPaths =
            new Set<string>();

        for (
            const incoming of
            files as IncomingRoomFile[]
        ) {
            if (
                !incoming ||
                typeof incoming.name !==
                    "string" ||
                typeof incoming.path !==
                    "string" ||
                typeof incoming.content !==
                    "string"
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Invalid room file data",
                });
                return;
            }

            const path =
                normalizePath(
                    incoming.path
                );

            if (
                !path ||
                path.length > 500
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Invalid file path",
                });
                return;
            }

            if (
                incoming.content.length >
                MAX_FILE_CONTENT
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        `File ${incoming.name} is too large`,
                });
                return;
            }

            if (
                seenPaths.has(path)
            ) {
                continue;
            }

            seenPaths.add(path);

            normalizedFiles.push({
                ...incoming,
                path,
            });
        }

        if (
            normalizedFiles.length === 0
        ) {
            res.status(400).json({
                success: false,
                message:
                    "No valid files were provided",
            });
            return;
        }

        // ======================================
        // DETERMINE EXISTING FILES
        // ======================================

        const paths =
            normalizedFiles.map(
                (file) => file.path
            );

        const existingFiles =
            await RoomFile.find({
                roomId,
                path: {
                    $in: paths,
                },
            }).select(
                "_id path version"
            );

        const existingPaths =
            new Set(
                existingFiles.map(
                    (file) => file.path
                )
            );

        const operations: any[] = [];

        // ======================================
        // CREATE / UPDATE OPERATIONS
        // ======================================

        for (
            const incoming of
            normalizedFiles
        ) {
            if (
                existingPaths.has(
                    incoming.path
                )
            ) {
                // Existing file:
                // increment version.

                operations.push({
                    updateOne: {
                        filter: {
                            roomId,
                            path:
                                incoming.path,
                        },

                        update: {
                            $set: {
                                name:
                                    incoming.name,

                                path:
                                    incoming.path,

                                content:
                                    incoming.content,

                                language:
                                    incoming.language ||
                                    getLanguage(
                                        incoming.name
                                    ),

                                size:
                                    incoming
                                        .content
                                        .length,
                            },

                            $inc: {
                                version: 1,
                            },
                        },
                    },
                });
            } else {
                // New file:
                // start at version 1.

                operations.push({
                    insertOne: {
                        document: {
                            roomId,

                            name:
                                incoming.name,

                            path:
                                incoming.path,

                            content:
                                incoming.content,

                            language:
                                incoming.language ||
                                getLanguage(
                                    incoming.name
                                ),

                            size:
                                incoming
                                    .content
                                    .length,

                            version: 1,
                        },
                    },
                });
            }
        }

        await RoomFile.bulkWrite(
            operations,
            {
                ordered: false,
            }
        );

        // ======================================
        // RETURN SAVED FILE METADATA
        // ======================================

        const savedFiles =
            await RoomFile.find({
                roomId,
                path: {
                    $in: paths,
                },
            })
                .select(
                    "_id name path language size version"
                )
                .sort({
                    path: 1,
                })
                .lean();

        res.status(200).json({
            success: true,
            files: savedFiles,
        });
    } catch (error) {
        console.error(
            "Save room files error ❌",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

// ==========================================
// GET SINGLE FILE CONTENT
// ==========================================

export const getRoomFileContent =
    async (
        req: AuthRequest,
        res: Response
    ): Promise<void> => {
        try {
            const roomId = String(
                req.params.roomId
            );

            const fileId = String(
                req.params.fileId
            );

            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    message:
                        "Authentication required",
                });
                return;
            }

            if (
                !(await isRoomMember(
                    roomId,
                    req.userId
                ))
            ) {
                res.status(403).json({
                    success: false,
                    message:
                        "You are not a member of this room",
                });
                return;
            }

            if (
                !mongooseIdValid(
                    fileId
                )
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Invalid file id",
                });
                return;
            }

            // ==================================
            // MIGRATE OLD FILE
            // ==================================

            await RoomFile.updateOne(
                {
                    _id: fileId,
                    roomId,
                    version: {
                        $exists: false,
                    },
                },
                {
                    $set: {
                        version: 1,
                    },
                }
            );

            const file =
                await RoomFile.findOne({
                    _id: fileId,
                    roomId,
                }).select(
                    "_id name path content language size version"
                );

            if (!file) {
                res.status(404).json({
                    success: false,
                    message:
                        "Room file not found",
                });
                return;
            }

            res.status(200).json({
                success: true,
                file,
            });
        } catch (error) {
            console.error(
                "Get room file content error ❌",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Internal server error",
            });
        }
    };

// ==========================================
// UPDATE SINGLE FILE
// WITH OPTIMISTIC VERSION CHECK
// ==========================================

export const updateRoomFile =
    async (
        req: AuthRequest,
        res: Response
    ): Promise<void> => {
        try {
            const roomId = String(
                req.params.roomId
            );

            const fileId = String(
                req.params.fileId
            );

            // ==================================
            // AUTHENTICATION
            // ==================================

            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    message:
                        "Authentication required",
                });
                return;
            }

            // ==================================
            // ROOM MEMBERSHIP
            // ==================================

            if (
                !(await isRoomMember(
                    roomId,
                    req.userId
                ))
            ) {
                res.status(403).json({
                    success: false,
                    message:
                        "You are not a member of this room",
                });
                return;
            }

            // ==================================
            // ROOM STATUS
            // ==================================

            const room =
                await Room.findOne({
                    roomId,
                }).select("status");

            if (!room) {
                res.status(404).json({
                    success: false,
                    message:
                        "Room not found",
                });
                return;
            }

            if (
                room.status ===
                "completed"
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Completed rooms are read-only",
                });
                return;
            }

            // ==================================
            // CONTENT VALIDATION
            // ==================================

            if (
                typeof req.body
                    ?.content !==
                "string"
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Content must be a string",
                });
                return;
            }

            if (
                req.body.content.length >
                MAX_FILE_CONTENT
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "File is too large",
                });
                return;
            }

            // ==================================
            // FILE ID VALIDATION
            // ==================================

            if (
                !mongooseIdValid(
                    fileId
                )
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Invalid file id",
                });
                return;
            }

            // ==================================
            // VERSION VALIDATION
            // ==================================

            const expectedVersion =
                Number(
                    req.body
                        ?.expectedVersion
                );

            if (
                !Number.isInteger(
                    expectedVersion
                ) ||
                expectedVersion < 1
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "A valid expectedVersion is required",
                });
                return;
            }

            // ==================================
            // MIGRATE OLD FILE
            // ==================================
            //
            // Files created before version
            // tracking existed may not have
            // "version" in MongoDB.
            //
            // Initialize those files to 1.
            //

            await RoomFile.updateOne(
                {
                    _id: fileId,
                    roomId,
                    version: {
                        $exists: false,
                    },
                },
                {
                    $set: {
                        version: 1,
                    },
                }
            );

            // ==================================
            // ATOMIC COMPARE + UPDATE
            // ==================================
            //
            // MongoDB performs the update only
            // when:
            //
            // database version ===
            // expectedVersion
            //
            // If successful:
            //
            // version 5 -> version 6
            //
            // If another user already changed it:
            //
            // database version = 6
            // expectedVersion  = 5
            //
            // => no match
            // => 409 Conflict
            //

            const file =
                await RoomFile.findOneAndUpdate(
                    {
                        _id: fileId,
                        roomId,
                        version:
                            expectedVersion,
                    },

                    {
                        $set: {
                            content:
                                req.body
                                    .content,

                            size:
                                req.body
                                    .content
                                    .length,
                        },

                        $inc: {
                            version: 1,
                        },
                    },

                    {
                        new: true,
                    }
                );

            // ==================================
            // FILE NOT UPDATED
            // ==================================

            if (!file) {
                const currentFile =
                    await RoomFile.findOne({
                        _id: fileId,
                        roomId,
                    }).select(
                        "_id name path content language size version"
                    );

                if (!currentFile) {
                    res.status(404).json({
                        success: false,
                        message:
                            "Room file not found",
                    });
                    return;
                }

                // ==================================
                // VERSION CONFLICT
                // ==================================

                res.status(409).json({
                    success: false,
                    conflict: true,
                    message:
                        "File was modified by another user",
                    file: currentFile,
                });

                return;
            }

            // ==================================
            // SUCCESS
            // ==================================

            res.status(200).json({
                success: true,
                file,
            });
        } catch (error) {
            console.error(
                "Update room file error ❌",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Internal server error",
            });
        }
    };