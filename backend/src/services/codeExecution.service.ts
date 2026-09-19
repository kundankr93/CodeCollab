import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

export type SupportedLanguage =
    | "cpp"
    | "python"
    | "javascript";

interface ExecutionResult {
    success: boolean;
    output: string;
    error: string;
    executionTime: number;
}

interface LanguageConfig {
    image: string;
    fileName: string;
    command: string[];
}

const LANGUAGE_CONFIG: Record<
    SupportedLanguage,
    LanguageConfig
> = {
    cpp: {
        image: "gcc:latest",
        fileName: "main.cpp",
        command: [
            "sh",
            "-c",
            "g++ /code/main.cpp -O2 -std=c++17 -o /code/program && /code/program < /code/input.txt",
        ],
    },

    python: {
        image: "python:3.12-alpine",
        fileName: "main.py",
        command: [
            "sh",
            "-c",
            "python /code/main.py < /code/input.txt",
        ],
    },

    javascript: {
        image: "node:22-alpine",
        fileName: "main.js",
        command: [
            "sh",
            "-c",
            "node /code/main.js < /code/input.txt",
        ],
    },
};

const EXECUTION_TIMEOUT = 30000;

const MAX_OUTPUT_SIZE =
    1024 * 1024;

export const executeCode = async (
    language: SupportedLanguage,
    code: string,
    input: string = ""
): Promise<ExecutionResult> => {
    const config =
        LANGUAGE_CONFIG[language];

    if (!config) {
        return {
            success: false,
            output: "",
            error:
                `Unsupported language: ${language}`,
            executionTime: 0,
        };
    }

    if (typeof code !== "string") {
        return {
            success: false,
            output: "",
            error: "Code must be a string.",
            executionTime: 0,
        };
    }

    if (typeof input !== "string") {
        return {
            success: false,
            output: "",
            error: "Input must be a string.",
            executionTime: 0,
        };
    }

    const executionId =
        crypto.randomUUID();

    const tempDirectory =
        path.join(
            os.tmpdir(),
            `codecollab-${executionId}`
        );

    const codeDirectory =
        path.join(
            tempDirectory,
            "code"
        );

    const codeFile =
        path.join(
            codeDirectory,
            config.fileName
        );

    const inputFile =
        path.join(
            codeDirectory,
            "input.txt"
        );

    try {
        await fs.mkdir(
            codeDirectory,
            {
                recursive: true,
            }
        );

        await fs.writeFile(
            codeFile,
            code,
            "utf8"
        );

        await fs.writeFile(
            inputFile,
            input,
            "utf8"
        );

        const startTime =
            Date.now();

        const dockerExecutable =
            `${process.env.LOCALAPPDATA}\\Programs\\DockerDesktop\\resources\\bin\\docker.exe`;

        const dockerArguments = [
            "run",

            "--rm",

            "--network",
            "none",

            "--memory",
            "128m",

            "--cpus",
            "0.5",

            "--pids-limit",
            "64",

            "-v",
            `${codeDirectory}:/code`,

            config.image,

            ...config.command,
        ];

        try {
            const result =
                await execFileAsync(
                    dockerExecutable,
                    dockerArguments,
                    {
                        timeout:
                            EXECUTION_TIMEOUT,

                        maxBuffer:
                            MAX_OUTPUT_SIZE,

                        windowsHide:
                            true,
                    }
                );

            const executionTime =
                Date.now() -
                startTime;

            return {
                success: true,
                output:
                    result.stdout,
                error:
                    result.stderr,
                executionTime,
            };
        } catch (
            error: unknown
        ) {
            const executionTime =
                Date.now() -
                startTime;

            const execError =
                error as {
                    stdout?: string;
                    stderr?: string;
                    killed?: boolean;
                    signal?: string;
                    code?: number | string;
                    message?: string;
                };

            if (
                execError.killed ||
                execError.signal ===
                    "SIGTERM"
            ) {
                return {
                    success: false,
                    output:
                        execError.stdout ??
                        "",
                    error:
                        "Execution timed out. Maximum execution time is 30 seconds.",
                    executionTime,
                };
            }

            return {
                success: false,
                output:
                    execError.stdout ??
                    "",
                error:
                    execError.stderr ||
                    execError.message ||
                    "Code execution failed.",
                executionTime,
            };
        }
    } catch (
        error: unknown
    ) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to prepare code execution.";

        return {
            success: false,
            output: "",
            error: message,
            executionTime: 0,
        };
    } finally {
        try {
            await fs.rm(
                tempDirectory,
                {
                    recursive: true,
                    force: true,
                }
            );
        } catch {
            // Ignore cleanup errors.
        }
    }
};