export type SupportedLanguage = "cpp" | "python" | "javascript";

interface ExecutionResult {
    success: boolean;
    output: string;
    error: string;
    executionTime: number;
}

const LANGUAGE_IDS: Record<SupportedLanguage, number> = {
    cpp: 54,         // C++ (GCC)
    python: 71,      // Python
    javascript: 63,  // JavaScript (Node.js)
};

const MAX_CODE_SIZE = 100 * 1024;
const MAX_INPUT_SIZE = 100 * 1024;
const EXECUTION_TIMEOUT = 30_000;

const JUDGE0_URL = (
    process.env.JUDGE0_URL || "https://ce.judge0.com"
).replace(/\/$/, "");

const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export const executeCode = async (
    language: SupportedLanguage,
    code: string,
    input = ""
): Promise<ExecutionResult> => {
    const startTime = Date.now();

    try {
        const languageId = LANGUAGE_IDS[language];

        if (!languageId) {
            return {
                success: false,
                output: "",
                error: `Unsupported language: ${language}`,
                executionTime: 0,
            };
        }

        if (typeof code !== "string" || typeof input !== "string") {
            return {
                success: false,
                output: "",
                error: "Code and input must be strings.",
                executionTime: 0,
            };
        }

        if (Buffer.byteLength(code, "utf8") > MAX_CODE_SIZE) {
            return {
                success: false,
                output: "",
                error: "Code size exceeds the 100 KB limit.",
                executionTime: 0,
            };
        }

        if (Buffer.byteLength(input, "utf8") > MAX_INPUT_SIZE) {
            return {
                success: false,
                output: "",
                error: "Input size exceeds the 100 KB limit.",
                executionTime: 0,
            };
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Keep this token on the backend only, never in frontend code.
        if (process.env.JUDGE0_AUTH_TOKEN) {
            headers["X-Auth-Token"] = process.env.JUDGE0_AUTH_TOKEN;
        }

        // Submit the code.
        const submitResponse = await fetch(
            `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    source_code: code,
                    language_id: languageId,
                    stdin: input,
                    cpu_time_limit: 3,
                    wall_time_limit: 5,
                    memory_limit: 128000,
                }),
            }
        );

        const submitData = await submitResponse.json() as {
            token?: string;
            error?: string;
            message?: string;
        };

        if (!submitResponse.ok || !submitData.token) {
            throw new Error(
                submitData.error ||
                submitData.message ||
                `Judge0 submission failed (${submitResponse.status}).`
            );
        }

        // Poll until Judge0 finishes the submission.
        const deadline = Date.now() + EXECUTION_TIMEOUT;

        while (Date.now() < deadline) {
            await sleep(1000);

            const resultResponse = await fetch(
                `${JUDGE0_URL}/submissions/${submitData.token}?base64_encoded=false`,
                { headers }
            );

            const result = await resultResponse.json() as {
                stdout?: string | null;
                stderr?: string | null;
                compile_output?: string | null;
                message?: string | null;
                status?: { id: number; description: string };
            };

            if (!resultResponse.ok) {
                throw new Error(
                    result.message || "Could not retrieve execution result."
                );
            }

            const status = result.status;

            // 1 = In Queue, 2 = Processing
            if (!status || status.id === 1 || status.id === 2) {
                continue;
            }

            const output = result.stdout || "";
            const error =
                result.compile_output ||
                result.stderr ||
                result.message ||
                (status.id !== 3 ? status.description : "");

            return {
                success: status.id === 3,
                output,
                error,
                executionTime: Date.now() - startTime,
            };
        }

        return {
            success: false,
            output: "",
            error: "Execution timed out. Maximum wait time is 30 seconds.",
            executionTime: Date.now() - startTime,
        };
    } catch (error: unknown) {
        return {
            success: false,
            output: "",
            error:
                error instanceof Error
                    ? error.message
                    : "Code execution failed.",
            executionTime: Date.now() - startTime,
        };
    }
};