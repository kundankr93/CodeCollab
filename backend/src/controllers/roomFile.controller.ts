import mongoose from "mongoose";
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
// TRANSACTIONAL ROOM FILE WRITE
// ==========================================
//
// Every file write first updates the same Room document that
// completeRoom updates. This makes file writes and completion
// conflict/serialize at the MongoDB document level.
//
// The Room and RoomFile changes commit together. If completion
// wins the race, the conditional Room update no longer matches.

type RoomWriteResult<T> =
    | { kind: "saved"; value: T }
    | { kind: "missing" | "forbidden" | "completed" };

const withWritableRoomTransaction = async <T>(
    roomId: string,
    userId: string,
    writeFiles: (session: mongoose.ClientSession) => Promise<T>
): Promise<RoomWriteResult<T>> => {
    const session = await mongoose.startSession();

    let outcome: RoomWriteResult<T> = {
        kind: "missing",
    };

    try {
        await session.withTransaction(async () => {
            // This conditional write is intentional. It makes this
            // transaction contend with completeRoom on the Room doc.
            const roomWrite = await Room.updateOne(
                {
                    roomId,
                    status: { $ne: "completed" },
                    $or: [
                        { owner: userId },
                        { participants: userId },
                    ],
                },
                {
                    $set: {
                        updatedAt: new Date(),
                    },
                },
                { session }
            );

            if (roomWrite.matchedCount !== 1) {
                const room = await Room.findOne({ roomId })
                    .select("owner participants status")
                    .session(session)
                    .lean();

                if (!room) {
                    outcome = { kind: "missing" };
                } else {
                    const isMember =
                        room.owner.toString() === userId ||
                        room.participants.some(
                            (participant) => participant.toString() === userId
                        );

                    if (!isMember) {
                        outcome = { kind: "forbidden" };
                    } else if (room.status === "completed") {
                        outcome = { kind: "completed" };
                    } else {
                        // A concurrent room transition may have caused
                        // this attempt not to match. Abort rather than
                        // silently perform a file write.
                        throw new Error(
                            "Room changed while saving files; retry the request"
                        );
                    }
                }

                return;
            }

            const value = await writeFiles(session);
            outcome = { kind: "saved", value };
        });

        return outcome;
    } finally {
        await session.endSession();
    }
};

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
        const roomId = String(req.params.roomId);

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        const files = req.body?.files;

        if (!Array.isArray(files) || files.length === 0) {
            res.status(400).json({
                success: false,
                message: "Files are required",
            });
            return;
        }

        if (files.length > MAX_FILES_PER_BATCH) {
            res.status(400).json({
                success: false,
                message: `Maximum ${MAX_FILES_PER_BATCH} files per batch`,
            });
            return;
        }

        const normalizedFiles: IncomingRoomFile[] = [];
        const seenPaths = new Set<string>();

        for (const incoming of files as IncomingRoomFile[]) {
            if (
                !incoming ||
                typeof incoming.name !== "string" ||
                typeof incoming.path !== "string" ||
                typeof incoming.content !== "string"
            ) {
                res.status(400).json({
                    success: false,
                    message: "Invalid room file data",
                });
                return;
            }

            const path = normalizePath(incoming.path);

            if (!path || path.length > 500) {
                res.status(400).json({
                    success: false,
                    message: "Invalid file path",
                });
                return;
            }

            if (incoming.content.length > MAX_FILE_CONTENT) {
                res.status(400).json({
                    success: false,
                    message: `File ${incoming.name} is too large`,
                });
                return;
            }

            if (seenPaths.has(path)) {
                continue;
            }

            seenPaths.add(path);
            normalizedFiles.push({ ...incoming, path });
        }

        if (normalizedFiles.length === 0) {
            res.status(400).json({
                success: false,
                message: "No valid files were provided",
            });
            return;
        }

        const paths = normalizedFiles.map((file) => file.path);

        const result = await withWritableRoomTransaction(
            roomId,
            req.userId,
            async (session) => {
                const existingFiles = await RoomFile.find({
                    roomId,
                    path: { $in: paths },
                })
                    .select("_id path version")
                    .session(session)
                    .lean();

                const existingPaths = new Set(
                    existingFiles.map((file) => file.path)
                );

                const operations: any[] = [];

                for (const incoming of normalizedFiles) {
                    if (existingPaths.has(incoming.path)) {
                        operations.push({
                            updateOne: {
                                filter: {
                                    roomId,
                                    path: incoming.path,
                                },
                                update: {
                                    $set: {
                                        name: incoming.name,
                                        path: incoming.path,
                                        content: incoming.content,
                                        language:
                                            incoming.language ||
                                            getLanguage(incoming.name),
                                        size: incoming.content.length,
                                    },
                                    $inc: { version: 1 },
                                },
                            },
                        });
                    } else {
                        operations.push({
                            insertOne: {
                                document: {
                                    roomId,
                                    name: incoming.name,
                                    path: incoming.path,
                                    content: incoming.content,
                                    language:
                                        incoming.language ||
                                        getLanguage(incoming.name),
                                    size: incoming.content.length,
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
                        session,
                    }
                );

                return RoomFile.find({
                    roomId,
                    path: { $in: paths },
                })
                    .select("_id name path language size version")
                    .sort({ path: 1 })
                    .session(session)
                    .lean();
            }
        );

        if (result.kind !== "saved") {
            const responses = {
                missing: {
                    status: 404,
                    message: "Room not found",
                },
                forbidden: {
                    status: 403,
                    message: "You are not a member of this room",
                },
                completed: {
                    status: 400,
                    message: "Completed rooms are read-only",
                },
            } as const;

            const response = responses[result.kind];
            res.status(response.status).json({
                success: false,
                message: response.message,
            });
            return;
        }

        res.status(200).json({
            success: true,
            files: result.value,
        });
    } catch (error) {
        console.error("Save room files error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
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

export const updateRoomFile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const roomId = String(req.params.roomId);
        const fileId = String(req.params.fileId);

        if (!req.userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        if (typeof req.body?.content !== "string") {
            res.status(400).json({
                success: false,
                message: "Content must be a string",
            });
            return;
        }

        if (req.body.content.length > MAX_FILE_CONTENT) {
            res.status(400).json({
                success: false,
                message: "File is too large",
            });
            return;
        }

        if (!mongooseIdValid(fileId)) {
            res.status(400).json({
                success: false,
                message: "Invalid file id",
            });
            return;
        }

        const expectedVersion = Number(req.body?.expectedVersion);

        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
            res.status(400).json({
                success: false,
                message: "A valid expectedVersion is required",
            });
            return;
        }

        const result = await withWritableRoomTransaction(
            roomId,
            req.userId,
            async (session) => {
                // Initialize legacy files before the compare-and-update.
                await RoomFile.updateOne(
                    {
                        _id: fileId,
                        roomId,
                        version: { $exists: false },
                    },
                    {
                        $set: { version: 1 },
                    },
                    { session }
                );

                const file = await RoomFile.findOneAndUpdate(
                    {
                        _id: fileId,
                        roomId,
                        version: expectedVersion,
                    },
                    {
                        $set: {
                            content: req.body.content,
                            size: req.body.content.length,
                        },
                        $inc: { version: 1 },
                    },
                    {
                        new: true,
                        session,
                    }
                );

                if (file) {
                    return {
                        kind: "updated" as const,
                        file,
                    };
                }

                const currentFile = await RoomFile.findOne({
                    _id: fileId,
                    roomId,
                })
                    .select("_id name path content language size version")
                    .session(session);

                if (!currentFile) {
                    return {
                        kind: "not-found" as const,
                    };
                }

                return {
                    kind: "conflict" as const,
                    file: currentFile,
                };
            }
        );

        if (result.kind !== "saved") {
            const responses = {
                missing: {
                    status: 404,
                    message: "Room not found",
                },
                forbidden: {
                    status: 403,
                    message: "You are not a member of this room",
                },
                completed: {
                    status: 400,
                    message: "Completed rooms are read-only",
                },
            } as const;

            const response = responses[result.kind];
            res.status(response.status).json({
                success: false,
                message: response.message,
            });
            return;
        }

        if (result.value.kind === "not-found") {
            res.status(404).json({
                success: false,
                message: "Room file not found",
            });
            return;
        }

        if (result.value.kind === "conflict") {
            res.status(409).json({
                success: false,
                conflict: true,
                message: "File was modified by another user",
                file: result.value.file,
            });
            return;
        }

        res.status(200).json({
            success: true,
            file: result.value.file,
        });
    } catch (error) {
        console.error("Update room file error ❌", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

