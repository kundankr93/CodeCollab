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
            "g++ /code/main.cpp -O2 -std=c++17 -o /tmp/program && /tmp/program < /code/input.txt",
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

// Maximum time allowed for one execution.
const EXECUTION_TIMEOUT = 30000;

// Maximum stdout/stderr buffer.
const MAX_OUTPUT_SIZE = 1024 * 1024;

// Maximum submitted source code and input sizes.
const MAX_CODE_SIZE = 1024 * 1024;
const MAX_INPUT_SIZE = 1024 * 1024;

// Container resource limits.
const MEMORY_LIMIT = "128m";
const MEMORY_SWAP_LIMIT = "128m";
const CPU_LIMIT = "0.5";
const PID_LIMIT = "64";
const TEMP_STORAGE_LIMIT = "64m";

// Limit concurrent executions in this Node.js process.
const MAX_CONCURRENT_EXECUTIONS = 3;
const MAX_QUEUED_EXECUTIONS = 10;

let activeExecutions = 0;

const executionQueue: Array<
    (acquired: boolean) => void
> = [];

/**
 * Acquires an execution slot.
 *
 * Returns false when both the execution slots and
 * waiting queue are full.
 */
const acquireExecutionSlot = (): Promise<boolean> => {
    if (
        activeExecutions <
        MAX_CONCURRENT_EXECUTIONS
    ) {
        activeExecutions++;
        return Promise.resolve(true);
    }

    if (
        executionQueue.length >=
        MAX_QUEUED_EXECUTIONS
    ) {
        return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
        executionQueue.push(resolve);
    });
};

/**
 * Releases an execution slot and gives it to
 * the next waiting execution, if one exists.
 */
const releaseExecutionSlot = (): void => {
    const nextExecution =
        executionQueue.shift();

    if (nextExecution) {
        // The active count remains unchanged because
        // the slot is transferred to the waiting task.
        nextExecution(true);
        return;
    }

    activeExecutions = Math.max(
        0,
        activeExecutions - 1
    );
};

const getDockerExecutable = (): string => {
    // Allows a custom Docker executable path.
    if (process.env.DOCKER_PATH?.trim()) {
        return process.env.DOCKER_PATH.trim();
    }

    // Default Docker Desktop path on Windows.
    if (process.env.LOCALAPPDATA) {
        return path.join(
            process.env.LOCALAPPDATA,
            "Programs",
            "DockerDesktop",
            "resources",
            "bin",
            "docker.exe"
        );
    }

    // Uses Docker from PATH on other environments.
    return "docker";
};

const createFailureResult = (
    error: string
): ExecutionResult => ({
    success: false,
    output: "",
    error,
    executionTime: 0,
});

export const executeCode = async (
    language: SupportedLanguage,
    code: string,
    input: string = ""
): Promise<ExecutionResult> => {
    const config =
        LANGUAGE_CONFIG[language];

    if (!config) {
        return createFailureResult(
            `Unsupported language: ${language}`
        );
    }

    if (typeof code !== "string") {
        return createFailureResult(
            "Code must be a string."
        );
    }

    if (typeof input !== "string") {
        return createFailureResult(
            "Input must be a string."
        );
    }

    if (
        Buffer.byteLength(code, "utf8") >
        MAX_CODE_SIZE
    ) {
        return createFailureResult(
            "Source code exceeds the maximum allowed size of 1 MB."
        );
    }

    if (
        Buffer.byteLength(input, "utf8") >
        MAX_INPUT_SIZE
    ) {
        return createFailureResult(
            "Input exceeds the maximum allowed size of 1 MB."
        );
    }

    const hasExecutionSlot =
        await acquireExecutionSlot();

    if (!hasExecutionSlot) {
        return createFailureResult(
            "Execution server is busy. Please try again later."
        );
    }

    const executionId =
        crypto.randomUUID();

    const tempDirectory = path.join(
        os.tmpdir(),
        `codecollab-${executionId}`
    );

    const codeDirectory = path.join(
        tempDirectory,
        "code"
    );

    const codeFile = path.join(
        codeDirectory,
        config.fileName
    );

    const inputFile = path.join(
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

        const startTime = Date.now();

        const dockerExecutable =
            getDockerExecutable();

        const dockerArguments = [
            "run",

            "--rm",

            // Disable network access.
            "--network",
            "none",

            // Run as an unprivileged user.
            "--user",
            "65534:65534",

            // Prevent privilege escalation.
            "--security-opt",
            "no-new-privileges",

            // Remove Linux capabilities.
            "--cap-drop",
            "ALL",

            // Make the container root filesystem read-only.
            "--read-only",

            // Restrict memory and CPU usage.
            "--memory",
            MEMORY_LIMIT,

            "--memory-swap",
            MEMORY_SWAP_LIMIT,

            "--cpus",
            CPU_LIMIT,

            // Restrict the number of processes.
            "--pids-limit",
            PID_LIMIT,

            // Provide a limited writable temporary directory.
            // The C++ executable is compiled and run from here.
            "--tmpfs",
            `/tmp:rw,nosuid,nodev,size=${TEMP_STORAGE_LIMIT},mode=1777`,

            // Keep code and input read-only inside the container.
            "-v",
            `${codeDirectory}:/code:ro`,

            // Runtime environment.
            "--env",
            "HOME=/tmp",

            "--env",
            "TMPDIR=/tmp",

            "--env",
            "PYTHONDONTWRITEBYTECODE=1",

            config.image,

            ...config.command,
        ];

        try {
            const result =
                await execFileAsync(
                    dockerExecutable,
                    dockerArguments,
                    {
                        timeout: EXECUTION_TIMEOUT,
                        maxBuffer: MAX_OUTPUT_SIZE,
                        windowsHide: true,
                        encoding: "utf8",
                    }
                );

            const executionTime =
                Date.now() - startTime;

            return {
                success: true,
                output: result.stdout ?? "",
                error: result.stderr ?? "",
                executionTime,
            };
        } catch (error: unknown) {
            const executionTime =
                Date.now() - startTime;

            const execError = error as {
                stdout?: string;
                stderr?: string;
                killed?: boolean;
                signal?: string;
                code?: number | string;
                message?: string;
            };

            // Handle output exceeding the configured buffer.
            if (
                execError.code ===
                "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
            ) {
                return {
                    success: false,
                    output:
                        execError.stdout ?? "",
                    error:
                        "Output exceeded the maximum allowed size of 1 MB.",
                    executionTime,
                };
            }

            // Handle execution timeout.
            if (
                execError.killed ||
                execError.signal === "SIGTERM" ||
                execError.signal === "SIGKILL"
            ) {
                return {
                    success: false,
                    output:
                        execError.stdout ?? "",
                    error:
                        "Execution timed out. Maximum execution time is 30 seconds.",
                    executionTime,
                };
            }

            return {
                success: false,
                output:
                    execError.stdout ?? "",
                error:
                    execError.stderr ||
                    execError.message ||
                    "Code execution failed.",
                executionTime,
            };
        }
    } catch (error: unknown) {
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

        releaseExecutionSlot();
    }
};