import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDirectory =
    path.join(
        process.cwd(),
        "src",
        "uploads",
        "projects"
    );

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true,
        }
    );
}

const storage =
    multer.diskStorage({
        destination: (
            _req,
            _file,
            cb
        ) => {
            cb(
                null,
                uploadDirectory
            );
        },

        filename: (
            _req,
            file,
            cb
        ) => {
            const uniqueName =
                `${Date.now()}-` +
                `${Math.round(
                    Math.random() * 1e9
                )}` +
                path.extname(
                    file.originalname
                );

            cb(
                null,
                uniqueName
            );
        },
    });

export const upload =
    multer({
        storage,

        limits: {
            // Maximum files in ONE request
            files: 100,

            // Maximum size of ONE file
            // 50 MB
            fileSize:
                50 * 1024 * 1024,
        },
    });