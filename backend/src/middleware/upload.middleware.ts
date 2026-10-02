import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDirectory = path.join(
    process.cwd(),
    "src",
    "uploads",
    "projects"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true,
    });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (_req, file, cb) => {
        // Extract only the extension from the original filename.
        const extension = path.extname(
            path.basename(file.originalname)
        );

        // Generate a unique server-side filename.
        const uniqueName =
            `${crypto.randomUUID()}${extension}`;

        cb(null, uniqueName);
    },
});

export const upload = multer({
    storage,

    // All extensions and MIME types are accepted.
    // Do not treat the original filename or MIME type as trusted.
    fileFilter: (_req, _file, cb) => {
        cb(null, true);
    },

    limits: {
        // Maximum files in one request.
        files: 100,

        // Maximum size of one file: 50 MB.
        fileSize: 50 * 1024 * 1024,

        // Maximum number of non-file fields.
        fields: 100,

        // Maximum size of one text field: 1 MB.
        fieldSize: 1 * 1024 * 1024,

        // Maximum total multipart parts.
        parts: 200,
    },
});