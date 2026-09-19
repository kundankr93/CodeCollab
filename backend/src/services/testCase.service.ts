import {
    executeCode,
} from "./codeExecution.service.js";

import type {
    SupportedLanguage,
} from "./codeExecution.service.js";

export interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
}

export interface TestCaseResult {
    id: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error: string;
    executionTime: number;
}

export interface TestCasesExecutionResult {
    total: number;
    passed: number;
    failed: number;
    results: TestCaseResult[];
}

const normalizeOutput = (
    output: string
): string => {
    return output
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+$/gm, "");
};

export const runTestCases = async (
    language: SupportedLanguage,
    code: string,
    testCases: TestCase[]
): Promise<TestCasesExecutionResult> => {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
        const result = await executeCode(
            language,
            code,
            testCase.input
        );

        const actualOutput =
            normalizeOutput(result.output);

        const expectedOutput =
            normalizeOutput(
                testCase.expectedOutput
            );

        const passed =
            result.success &&
            actualOutput === expectedOutput;

        results.push({
            id: testCase.id,
            input: testCase.input,
            expectedOutput:
                testCase.expectedOutput,
            actualOutput: result.output,
            passed,
            error: result.error,
            executionTime:
                result.executionTime,
        });
    }

    const passed = results.filter(
        (result) => result.passed
    ).length;

    return {
        total: results.length,
        passed,
        failed:
            results.length - passed,
        results,
    };
};