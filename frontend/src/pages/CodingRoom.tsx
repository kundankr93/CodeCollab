import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

import {
    io,
    Socket,
} from "socket.io-client";

import api from "../api/axios";

import { useAuth } from "../context/AuthContext";

import "../styles/coding-room.css";

interface Room {
    _id: string;
    roomId: string;
    name: string;
    language: string;
    status:
        | "waiting"
        | "active"
        | "completed";
    owner: string;
    participants: string[];
    createdAt: string;
}

interface ExecuteResponse {
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: number;
    message?: string;
}

interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
}

interface TestCaseResult {
    id: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error: string;
    executionTime: number;
}

interface TestCasesResponse {
    success: boolean;
    total: number;
    passed: number;
    failed: number;
    results: TestCaseResult[];
    message?: string;
}

type OutputTab =
    | "terminal"
    | "output"
    | "tests";

const CodingRoom = () => {
    const { roomId } = useParams();

    const navigate = useNavigate();

    const { user } = useAuth();

    const [room, setRoom] =
        useState<Room | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [code, setCode] = useState(
        `#include <iostream>

using namespace std;

int main() {

    cout << "Hello, CodeCollab!" << endl;

    return 0;
}`
    );

    const [socket, setSocket] =
        useState<Socket | null>(null);

    const editorRef =
        useRef<Parameters<OnMount>[0] | null>(
            null
        );

    const terminalOutputRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const handleEditorMount: OnMount = (
        editor
    ) => {
        editorRef.current = editor;
    };

    // =========================
    // EXECUTION
    // =========================

    const [input, setInput] =
        useState("");

    const [output, setOutput] =
        useState("");

    const [executionError, setExecutionError] =
        useState("");

    const [executionTime, setExecutionTime] =
        useState<number | null>(null);

    const [isExecuting, setIsExecuting] =
        useState(false);

    // =========================
    // TEST CASES
    // =========================

    const [outputTab, setOutputTab] =
        useState<OutputTab>("terminal");

    const [testCases, setTestCases] =
        useState<TestCase[]>([
            {
                id: "test-1",
                input: "10\n20",
                expectedOutput: "30",
            },
            {
                id: "test-2",
                input: "5\n7",
                expectedOutput: "12",
            },
        ]);

    const [testResults, setTestResults] =
        useState<TestCaseResult[]>([]);

    const [testSummary, setTestSummary] =
        useState<{
            total: number;
            passed: number;
            failed: number;
        } | null>(null);

    const [isRunningTests, setIsRunningTests] =
        useState(false);

    // =========================
    // FETCH ROOM
    // =========================

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                const response =
                    await api.get(
                        `/rooms/${roomId}`
                    );

                setRoom(
                    response.data.room
                );
            } catch (error: any) {
                setError(
                    error.response?.data
                        ?.message ||
                        "Failed to load room"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchRoom();
    }, [roomId]);

    // =========================
    // SOCKET
    // =========================

    useEffect(() => {
        if (
            !roomId ||
            !user
        ) {
            return;
        }

        const newSocket = io(
            "http://localhost:5000"
        );

        setSocket(newSocket);

        newSocket.on(
            "connect",
            () => {
                console.log(
                    "Socket connected:",
                    newSocket.id
                );

                newSocket.emit(
                    "join-room",
                    {
                        roomId,
                        userId: user.id,
                        userName: user.name,
                    }
                );
            }
        );

        newSocket.on(
            "code-update",
            (data: { code: string }) => {
                setCode(data.code);
            }
        );

        newSocket.on(
            "user-joined",
            (data) => {
                console.log(
                    `${data.userName} joined the room`
                );
            }
        );

        newSocket.on(
            "user-left",
            (data) => {
                console.log(
                    `${data.userName} left the room`
                );
            }
        );

        return () => {
            newSocket.emit(
                "leave-room"
            );

            newSocket.disconnect();
        };
    }, [roomId, user]);

    // =========================
    // CODE CHANGE
    // =========================

    const handleCodeChange = (
        value: string | undefined
    ) => {
        const newCode = value || "";

        setCode(newCode);

        if (
            socket &&
            roomId
        ) {
            socket.emit(
                "code-change",
                {
                    roomId,
                    code: newCode,
                }
            );
        }
    };

    // =========================
    // LANGUAGE
    // =========================

    const getEditorLanguage = () => {
        if (
            room?.language === "cpp"
        ) {
            return "cpp";
        }

        if (
            room?.language ===
            "javascript"
        ) {
            return "javascript";
        }

        if (
            room?.language === "python"
        ) {
            return "python";
        }

        if (
            room?.language === "java"
        ) {
            return "java";
        }

        return "plaintext";
    };

    const getExecutionLanguage = () => {
        if (
            room?.language === "cpp"
        ) {
            return "cpp";
        }

        if (
            room?.language === "python"
        ) {
            return "python";
        }

        if (
            room?.language ===
            "javascript"
        ) {
            return "javascript";
        }

        return null;
    };

    // =========================
    // RUN CODE
    // =========================

    const handleRunCode = async () => {
        const language =
            getExecutionLanguage();

        if (!language) {
            setExecutionError(
                "This language is not supported for execution yet."
            );

            setOutput("");

            setOutputTab("terminal");

            return;
        }

        setIsExecuting(true);

        editorRef.current?.focus();

        setOutput("");

        setExecutionError("");

        setExecutionTime(null);

        setOutputTab("terminal");

        try {
            const response =
                await api.post<ExecuteResponse>(
                    "/execute/run",
                    {
                        language,
                        code,
                        input,
                    }
                );

            const data =
                response.data;

            setOutput(
                data.output || ""
            );

            setExecutionError(
                data.error || ""
            );

            setExecutionTime(
                data.executionTime ??
                    null
            );
        } catch (error: any) {
            console.error(
                "Code execution error:",
                error
            );

            setOutput("");

            setExecutionError(
                error.response?.data
                    ?.message ||
                    error.response?.data
                        ?.error ||
                    error.message ||
                    "Failed to execute code."
            );
        } finally {
            setIsExecuting(false);
        }
    };

    // =========================
    // RUN TEST CASES
    // =========================

    const handleRunTests = async () => {
        const language =
            getExecutionLanguage();

        if (!language) {
            setOutputTab("tests");

            return;
        }

        if (testCases.length === 0) {
            return;
        }

        setIsRunningTests(true);

        setTestResults([]);

        setTestSummary(null);

        setOutputTab("tests");

        try {
            const response =
                await api.post<TestCasesResponse>(
                    "/test-cases/run",
                    {
                        language,
                        code,
                        testCases,
                    }
                );

            const data =
                response.data;

            setTestResults(
                data.results || []
            );

            setTestSummary({
                total: data.total,
                passed: data.passed,
                failed: data.failed,
            });
        } catch (error: any) {
            console.error(
                "Test case error:",
                error
            );

            setExecutionError(
                error.response?.data
                    ?.message ||
                    "Failed to run test cases."
            );
        } finally {
            setIsRunningTests(false);
        }
    };

    // =========================
    // ADD TEST CASE
    // =========================

    const handleAddTestCase = () => {
        const newTestCase: TestCase = {
            id: `test-${Date.now()}`,
            input: "",
            expectedOutput: "",
        };

        setTestCases(
            (previous) => [
                ...previous,
                newTestCase,
            ]
        );
    };

    // =========================
    // UPDATE TEST CASE
    // =========================

    const handleTestCaseChange = (
        id: string,
        field:
            | "input"
            | "expectedOutput",
        value: string
    ) => {
        setTestCases(
            (previous) =>
                previous.map(
                    (testCase) =>
                        testCase.id === id
                            ? {
                                  ...testCase,
                                  [field]:
                                      value,
                              }
                            : testCase
                )
        );
    };

    // =========================
    // DELETE TEST CASE
    // =========================

    const handleDeleteTestCase = (
        id: string
    ) => {
        setTestCases(
            (previous) =>
                previous.filter(
                    (testCase) =>
                        testCase.id !== id
                )
        );

        setTestResults(
            (previous) =>
                previous.filter(
                    (result) =>
                        result.id !== id
                )
        );
    };

    // =========================
    // CLEAR TERMINAL
    // =========================

    const handleClearTerminal = () => {
        setOutput("");

        setExecutionError("");

        setExecutionTime(null);
    };

    // =========================
    // COPY LINK
    // =========================

    const handleCopyLink =
        async () => {
            try {
                await navigator.clipboard.writeText(
                    window.location.href
                );

                alert(
                    "Room link copied!"
                );
            } catch {
                alert(
                    "Failed to copy room link"
                );
            }
        };

    // =========================
    // TERMINAL AUTO SCROLL
    // =========================

    useEffect(() => {
        if (
            terminalOutputRef.current
        ) {
            terminalOutputRef.current.scrollTop =
                terminalOutputRef.current.scrollHeight;
        }
    }, [
        output,
        executionError,
        isExecuting,
    ]);

    // =========================
    // KEYBOARD SHORTCUTS
    // =========================
    
    useEffect(() => {
    const handleKeyboard = (
        event: KeyboardEvent
    ) => {
        if (
            (event.ctrlKey ||
                event.metaKey) &&
            event.key === "Enter"
        ) {
            event.preventDefault();

            handleRunCode();

            return;
        }

        if (
            event.ctrlKey &&
            event.shiftKey &&
            event.key === "F6"
        ) {
            event.preventDefault();

            handleRunCode();
        }
    };

    window.addEventListener(
        "keydown",
        handleKeyboard
    );

    return () => {
        window.removeEventListener(
            "keydown",
            handleKeyboard
        );
    };
}, [
    code,
    input,
    room?.language,
]);

     

    // =========================
    // LOADING
    // =========================

    if (loading) {
        return (
            <div className="room-loading">
                Loading room...
            </div>
        );
    }

    // =========================
    // ERROR
    // =========================

    if (
        error ||
        !room
    ) {
        return (
            <div className="room-error-page">

                <h2>
                    {error ||
                        "Room not found"}
                </h2>

                <button
                    onClick={() =>
                        navigate(
                            "/rooms"
                        )
                    }
                >
                    ← Back to Rooms
                </button>

            </div>
        );
    }

    return (
        <div className="coding-room">

            {/* TOPBAR */}

            <header className="room-topbar">

                <div className="room-brand">

                    <div className="room-logo">
                        &lt;/&gt;
                    </div>

                    <span>
                        CodeCollab
                    </span>

                </div>

                <div className="room-title">

                    <h2>
                        {room.name}
                    </h2>

                    <span>
                        {room.language ===
                        "cpp"
                            ? "C++"
                            : room.language}
                    </span>

                </div>

                <div className="room-actions">

                    <button
                        className="run-code-button"
                        onClick={
                            handleRunCode
                        }
                        disabled={
                            isExecuting ||
                            isRunningTests
                        }
                    >
                        {isExecuting
                            ? "⏳ Running..."
                            : "▶ Run Code"}
                    </button>

                    <button
                        className="share-button"
                        onClick={
                            handleCopyLink
                        }
                    >
                        🔗 Copy Link
                    </button>

                    <button
                        className="leave-button"
                        onClick={() =>
                            navigate(
                                "/rooms"
                            )
                        }
                    >
                        Leave
                    </button>

                </div>

            </header>

            {/* BODY */}

            <div className="room-body">

                {/* FILE SIDEBAR */}

                <aside className="file-sidebar">

                    <div className="panel-header">

                        <span>
                            EXPLORER
                        </span>

                        <button>
                            +
                        </button>

                    </div>

                    <div className="file-item active">

                        <span>
                            📄
                        </span>

                        <span>
                            main.cpp
                        </span>

                    </div>

                    <div className="file-item">

                        <span>
                            📄
                        </span>

                        <span>
                            test.cpp
                        </span>

                    </div>

                </aside>

                {/* EDITOR */}

                <main className="editor-area">

                    <div className="editor-tabs">

                        <div className="editor-tab active">

                            <span>
                                📄
                            </span>

                            main.cpp

                        </div>

                    </div>

                    <div className="monaco-container">

                        <Editor
                            height="100%"
                            language={
                                getEditorLanguage()
                            }
                            theme="vs-dark"
                            value={code}
                            onChange={
                                handleCodeChange
                            }
                            onMount={
                                handleEditorMount
                            }
                            options={{
                                fontSize: 14,

                                minimap: {
                                    enabled: true,
                                },

                                automaticLayout:
                                    true,

                                tabSize: 4,

                                wordWrap:
                                    "on",

                                scrollBeyondLastLine:
                                    false,

                                padding: {
                                    top: 15,
                                },
                            }}
                        />

                    </div>

                    {/* OUTPUT */}

                    <div className="output-panel">

                        <div className="output-header">

                            <div className="output-tabs">

                                <button
                                    className={`output-tab ${
                                        outputTab ===
                                        "terminal"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setOutputTab(
                                            "terminal"
                                        )
                                    }
                                >
                                    TERMINAL
                                </button>

                                <button
                                    className={`output-tab ${
                                        outputTab ===
                                        "output"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setOutputTab(
                                            "output"
                                        )
                                    }
                                >
                                    OUTPUT
                                </button>

                                <button
                                    className={`output-tab ${
                                        outputTab ===
                                        "tests"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setOutputTab(
                                            "tests"
                                        )
                                    }
                                >
                                    TEST CASES
                                </button>

                            </div>

                            {outputTab !==
                                "tests" && (
                                <button
                                    onClick={
                                        handleClearTerminal
                                    }
                                >
                                    Clear
                                </button>
                            )}

                        </div>

                        {/* TERMINAL */}

                        {outputTab ===
                            "terminal" && (
                            <>

                                <div className="terminal-input-section">

                                    <div className="terminal-label">
                                        INPUT
                                    </div>

                                    <textarea
                                        value={
                                            input
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setInput(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="Enter program input..."
                                    />

                                </div>

                                <div
                                    className="output-content"
                                    ref={terminalOutputRef}
                                >

                                    {!output &&
                                    !executionError &&
                                    !isExecuting ? (
                                        <span>
                                            $
                                            CodeCollab
                                            terminal
                                            ready...
                                        </span>
                                    ) : null}

                                    {isExecuting ? (
                                        <span>
                                            $
                                            Running
                                            code...
                                        </span>
                                    ) : null}

                                    {output ? (
                                        <pre>
                                            {
                                                output
                                            }
                                        </pre>
                                    ) : null}

                                    {executionError ? (
                                        <pre className="execution-error">
                                            {
                                                executionError
                                            }
                                        </pre>
                                    ) : null}

                                    {executionTime !==
                                        null && (
                                        <div className="execution-time">
                                            Execution
                                            time:{" "}
                                            {
                                                executionTime
                                            }{" "}
                                            ms
                                        </div>
                                    )}

                                </div>

                            </>
                        )}

                        {/* OUTPUT */}

                        {outputTab ===
                            "output" && (
                            <div className="output-content">

                                {output ? (
                                    <pre>
                                        {output}
                                    </pre>
                                ) : (
                                    <span>
                                        No output
                                        yet.
                                    </span>
                                )}

                                {executionError && (
                                    <pre className="execution-error">
                                        {
                                            executionError
                                        }
                                    </pre>
                                )}

                            </div>
                        )}

                        {/* TEST CASES */}

                        {outputTab ===
                            "tests" && (
                            <div className="test-cases-container">

                                <div className="test-case-toolbar">

                                    <div>
                                        <strong>
                                            Test Cases
                                        </strong>

                                        <span className="test-case-count">
                                            {
                                                testCases.length
                                            }
                                        </span>
                                    </div>

                                    <div className="test-case-actions">

                                        <button
                                            className="add-test-button"
                                            onClick={
                                                handleAddTestCase
                                            }
                                        >
                                            + Add Test
                                        </button>

                                        <button
                                            className="run-tests-button"
                                            onClick={
                                                handleRunTests
                                            }
                                            disabled={
                                                isRunningTests ||
                                                testCases.length ===
                                                    0
                                            }
                                        >
                                            {isRunningTests
                                                ? "⏳ Running..."
                                                : "🧪 Run Tests"}
                                        </button>

                                    </div>

                                </div>

                                {testSummary && (
                                    <div
                                        className={`test-summary ${
                                            testSummary.failed ===
                                            0
                                                ? "all-passed"
                                                : "some-failed"
                                        }`}
                                    >
                                        <strong>
                                            {testSummary.failed ===
                                            0
                                                ? "✅ All test cases passed"
                                                : "❌ Some test cases failed"}
                                        </strong>

                                        <span>
                                            {
                                                testSummary.passed
                                            }{" "}
                                            /{" "}
                                            {
                                                testSummary.total
                                            }{" "}
                                            passed
                                        </span>
                                    </div>
                                )}

                                <div className="test-cases-list">

                                    {testCases.map(
                                        (
                                            testCase,
                                            index
                                        ) => {
                                            const result =
                                                testResults.find(
                                                    (
                                                        item
                                                    ) =>
                                                        item.id ===
                                                        testCase.id
                                                );

                                            return (
                                                <div
                                                    className={`test-case-card ${
                                                        result
                                                            ? result.passed
                                                                ? "passed"
                                                                : "failed"
                                                            : ""
                                                    }`}
                                                    key={
                                                        testCase.id
                                                    }
                                                >

                                                    <div className="test-case-card-header">

                                                        <strong>
                                                            Test Case{" "}
                                                            {
                                                                index +
                                                                1
                                                            }
                                                        </strong>

                                                        {result && (
                                                            <span
                                                                className={
                                                                    result.passed
                                                                        ? "test-result-passed"
                                                                        : "test-result-failed"
                                                                }
                                                            >
                                                                {result.passed
                                                                    ? "✓ Passed"
                                                                    : "✗ Failed"}
                                                            </span>
                                                        )}

                                                        <button
                                                            className="delete-test-button"
                                                            onClick={() =>
                                                                handleDeleteTestCase(
                                                                    testCase.id
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>

                                                    </div>

                                                    <div className="test-case-fields">

                                                        <div className="test-field">

                                                            <label>
                                                                Input
                                                            </label>

                                                            <textarea
                                                                value={
                                                                    testCase.input
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    handleTestCaseChange(
                                                                        testCase.id,
                                                                        "input",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="Input"
                                                            />

                                                        </div>

                                                        <div className="test-field">

                                                            <label>
                                                                Expected Output
                                                            </label>

                                                            <textarea
                                                                value={
                                                                    testCase.expectedOutput
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    handleTestCaseChange(
                                                                        testCase.id,
                                                                        "expectedOutput",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="Expected output"
                                                            />

                                                        </div>

                                                    </div>

                                                    {result && (
                                                        <div className="test-result-details">

                                                            <span>
                                                                Actual:
                                                            </span>

                                                            <code>
                                                                {
                                                                    result.actualOutput ||
                                                                    "(empty)"
                                                                }
                                                            </code>

                                                            {result.error && (
                                                                <pre className="execution-error">
                                                                    {
                                                                        result.error
                                                                    }
                                                                </pre>
                                                            )}

                                                            <span className="test-execution-time">
                                                                {
                                                                    result.executionTime
                                                                }{" "}
                                                                ms
                                                            </span>

                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        }
                                    )}

                                </div>

                            </div>
                        )}

                    </div>

                </main>

                {/* PARTICIPANTS */}

                <aside className="participants-panel">

                    <div className="panel-header">

                        <span>
                            PARTICIPANTS
                        </span>

                        <span className="participant-count">
                            {
                                room
                                    .participants
                                    .length
                            }
                        </span>

                    </div>

                    <div className="participant">

                        <div className="participant-avatar">

                            {user?.name
                                ?.charAt(
                                    0
                                )
                                .toUpperCase()}

                        </div>

                        <div>

                            <p>
                                {user?.name}
                            </p>

                            <span>
                                You
                            </span>

                        </div>

                        <div className="online-dot" />

                    </div>

                </aside>

            </div>

        </div>
    );
};

export default CodingRoom;