import type {
    Request,
    Response,
} from "express";

import {
    runTestCases,
} from "../services/testCase.service.js";

import type {
    TestCase,
} from "../services/testCase.service.js";

import type {
    SupportedLanguage,
} from "../services/codeExecution.service.js";

interface TestCasesRequestBody {
    language?: SupportedLanguage;
    code?: string;
    testCases?: TestCase[];
}

export const executeTestCases = async (
    req: Request<
        {},
        {},
        TestCasesRequestBody
    >,
    res: Response
): Promise<void> => {
    try {
        const {
            language,
            code,
            testCases,
        } = req.body;

        if (!language) {
            res.status(400).json({
                success: false,
                message:
                    "Language is required.",
            });
            return;
        }

        if (
            ![
                "cpp",
                "python",
                "javascript",
            ].includes(language)
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Unsupported language.",
            });
            return;
        }

        if (typeof code !== "string") {
            res.status(400).json({
                success: false,
                message:
                    "Code is required.",
            });
            return;
        }

        if (!Array.isArray(testCases)) {
            res.status(400).json({
                success: false,
                message:
                    "Test cases must be an array.",
            });
            return;
        }

        if (testCases.length === 0) {
            res.status(400).json({
                success: false,
                message:
                    "At least one test case is required.",
            });
            return;
        }

        if (testCases.length > 20) {
            res.status(400).json({
                success: false,
                message:
                    "Maximum 20 test cases are allowed.",
            });
            return;
        }

        for (const testCase of testCases) {
            if (
                !testCase.id ||
                typeof testCase.input !==
                    "string" ||
                typeof testCase.expectedOutput !==
                    "string"
            ) {
                res.status(400).json({
                    success: false,
                    message:
                        "Each test case must contain id, input and expectedOutput.",
                });
                return;
            }
        }

        const result =
            await runTestCases(
                language,
                code,
                testCases
            );

        res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error(
            "Test case execution error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Internal server error.",
        });
    }
};