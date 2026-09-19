import { Request, Response } from "express";

import {
    executeCode,
    SupportedLanguage,
} from "../services/codeExecution.service.js";

interface ExecuteRequestBody {
    language?: SupportedLanguage;
    code?: string;
    input?: string;
}

export const runCode = async (
    req: Request<{}, {}, ExecuteRequestBody>,
    res: Response
): Promise<void> => {
    try {
        const {
            language,
            code,
            input = "",
        } = req.body;

        if (!language) {
            res.status(400).json({
                success: false,
                message: "Language is required.",
            });
            return;
        }

        if (!["cpp", "python", "javascript"].includes(language)) {
            res.status(400).json({
                success: false,
                message: "Unsupported language.",
            });
            return;
        }

        if (typeof code !== "string") {
            res.status(400).json({
                success: false,
                message: "Code is required.",
            });
            return;
        }

        if (code.length > 100_000) {
            res.status(400).json({
                success: false,
                message: "Code is too large.",
            });
            return;
        }

        const result = await executeCode(
            language,
            code,
            input
        );

        res.status(200).json({
            success: result.success,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime,
        });
    } catch (error) {
        console.error(
            "Code execution controller error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};
