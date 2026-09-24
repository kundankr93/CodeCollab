import {
    useEffect,
    useRef,
    useState,
} from "react";
import type {
    KeyboardEvent,
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
import "../styles/chat-reactions.css";
import "../styles/chat-message-actions.css";

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
    code?: string;
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

interface ChatReaction {
    emoji: string;
    userId: string;
    userName: string;
}

interface ChatReply {
    messageId: string;
    userId: string;
    userName: string;
    message: string;
}

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
    reactions?: ChatReaction[];
    replyTo?: ChatReply;
}

interface RoomParticipant {
    userId: string;
    userName: string;
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

    const [participants, setParticipants] =
        useState<RoomParticipant[]>([]);

    const [chatMessages, setChatMessages] =
        useState<ChatMessage[]>([]);

    const [chatInput, setChatInput] =
        useState("");

    const [replyingTo, setReplyingTo] =
        useState<ChatMessage | null>(null);

    const [copiedMessageId, setCopiedMessageId] =
        useState<string | null>(null);

    const [chatEmojiPickerOpen, setChatEmojiPickerOpen] =
        useState(false);

    const chatInputRef =
        useRef<HTMLTextAreaElement | null>(null);

    const chatMessageEmojis = [
        "😀", "😂", "😍", "🥰", "😎", "🤔",
        "😢", "😡", "😮", "👍", "👎", "👏",
        "🙌", "🙏", "🔥", "❤️", "💯", "🎉",
        "🚀", "💡", "🤝", "💪", "✨", "😄",
    ];

    const [reactionPickerMessageId, setReactionPickerMessageId] =
        useState<string | null>(null);

    const chatReactionEmojis = [
        "👍",
        "❤️",
        "😂",
        "🔥",
        "👏",
        "😮",
    ];

    const chatMessagesRef =
        useRef<HTMLDivElement | null>(null);

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
    // JOIN + FETCH ROOM + CHAT HISTORY
    // =========================

    useEffect(() => {
        if (!roomId || !user) {
            return;
        }

        let cancelled = false;

        const initializeRoom = async () => {
            try {
                // First register the current user as a room participant.
                // This is important when someone opens a shared room URL
                // directly instead of clicking the Join button.
                await api.post(
                    `/rooms/${roomId}/join`
                );

                if (cancelled) {
                    return;
                }

                // Now fetch the room after the user has joined.
                const roomResponse =
                    await api.get(
                        `/rooms/${roomId}`
                    );

                if (cancelled) {
                    return;
                }

                const loadedRoom =
                    roomResponse.data.room;

                setRoom(loadedRoom);

                if (loadedRoom.code) {
                    setCode(loadedRoom.code);
                }

                // Load persistent chat only after the join request succeeds.
                const chatResponse =
                    await api.get(
                        `/rooms/${roomId}/messages`
                    );

                if (cancelled) {
                    return;
                }

                const messages: ChatMessage[] =
                    chatResponse.data.messages || [];

                setChatMessages((previous) => {
                    const messagesById = new Map<
                        string,
                        ChatMessage
                    >();

                    // Keep any real-time messages that may have arrived
                    // while the history request was running.
                    previous.forEach((message) => {
                        messagesById.set(
                            message.id,
                            message
                        );
                    });

                    messages.forEach((message) => {
                        messagesById.set(
                            message.id,
                            message
                        );
                    });

                    return Array.from(
                        messagesById.values()
                    ).sort(
                        (a, b) =>
                            new Date(
                                a.timestamp
                            ).getTime() -
                            new Date(
                                b.timestamp
                            ).getTime()
                    );
                });
            } catch (error: any) {
                console.error(
                    "Failed to initialize room:",
                    error
                );

                if (!cancelled) {
                    setError(
                        error.response?.data
                            ?.message ||
                        "Failed to load room"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        initializeRoom();

        return () => {
            cancelled = true;
        };
    }, [roomId, user]);

    // =========================
    // PERSIST CODE
    // =========================

    useEffect(() => {
        if (!roomId || !room) {
            return;
        }

        const timeoutId = window.setTimeout(
            async () => {
                try {
                    await api.put(
                        `/rooms/${roomId}/code`,
                        {
                            code,
                        }
                    );
                } catch (error) {
                    console.error(
                        "Failed to save room code:",
                        error
                    );
                }
            },
            800
        );

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        code,
        roomId,
        room,
    ]);

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

        setParticipants([
            {
                userId: user.id,
                userName: user.name,
            },
        ]);

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

        newSocket.on(
            "room-participants",
            (data: RoomParticipant[]) => {
                setParticipants(
                    Array.isArray(data)
                        ? data
                        : []
                );
            }
        );

        newSocket.on(
            "chat-message",
            (data: ChatMessage) => {
                setChatMessages((previous) => {
                    if (
                        previous.some(
                            (message) =>
                                message.id ===
                                data.id
                        )
                    ) {
                        return previous;
                    }

                    return [
                        ...previous,
                        data,
                    ].sort(
                        (a, b) =>
                            new Date(
                                a.timestamp
                            ).getTime() -
                            new Date(
                                b.timestamp
                            ).getTime()
                    );
                });
            }
        );

        newSocket.on(
            "chat-reactions-updated",
            (data: {
                messageId: string;
                reactions: ChatReaction[];
            }) => {
                setChatMessages((previous) =>
                    previous.map((message) =>
                        message.id === data.messageId
                            ? {
                                  ...message,
                                  reactions:
                                      data.reactions,
                              }
                            : message
                    )
                );
            }
        );

        newSocket.on(
            "chat-message-deleted",
            (data: { messageId: string }) => {
                setChatMessages((previous) =>
                    previous.filter(
                        (message) =>
                            message.id !== data.messageId
                    )
                );

                setReplyingTo((current) =>
                    current?.id === data.messageId
                        ? null
                        : current
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
    // CHAT
    // =========================

    const handleChatEmojiSelect = (emoji: string) => {
        const textarea = chatInputRef.current;

        if (!textarea) {
            setChatInput((previous) => previous + emoji);
            return;
        }

        const start = textarea.selectionStart ?? chatInput.length;
        const end = textarea.selectionEnd ?? chatInput.length;

        const nextValue =
            chatInput.slice(0, start) +
            emoji +
            chatInput.slice(end);

        setChatInput(nextValue);
        setChatEmojiPickerOpen(false);

        requestAnimationFrame(() => {
            textarea.focus();

            const nextCursor = start + emoji.length;
            textarea.setSelectionRange(
                nextCursor,
                nextCursor
            );
        });
    };

    const handleSendChatMessage = () => {
        const message = chatInput.trim();

        if (!message || !socket || !roomId || !user) {
            return;
        }

        socket.emit(
            "send-chat-message",
            {
                roomId,
                userId: user.id,
                userName: user.name,
                message,
                replyTo: replyingTo
                    ? {
                          messageId: replyingTo.id,
                          userId: replyingTo.userId,
                          userName: replyingTo.userName,
                          message: replyingTo.message,
                      }
                    : undefined,
            }
        );

        setChatInput("");
        setReplyingTo(null);
        setChatEmojiPickerOpen(false);
    };

    const handleReplyToMessage = (
        chatMessage: ChatMessage
    ) => {
        setReplyingTo(chatMessage);
        setChatEmojiPickerOpen(false);

        requestAnimationFrame(() => {
            chatInputRef.current?.focus();
        });
    };

    const handleCopyMessage = async (
        chatMessage: ChatMessage
    ) => {
        try {
            await navigator.clipboard.writeText(
                chatMessage.message
            );

            setCopiedMessageId(chatMessage.id);

            window.setTimeout(() => {
                setCopiedMessageId((current) =>
                    current === chatMessage.id
                        ? null
                        : current
                );
            }, 1200);
        } catch (error) {
            console.error(
                "Failed to copy chat message:",
                error
            );
        }
    };

    const handleDeleteChatMessage = (
        messageId: string
    ) => {
        if (!socket || !roomId || !user) {
            return;
        }

        socket.emit(
            "delete-chat-message",
            {
                roomId,
                messageId,
                userId: user.id,
            }
        );
    };

    const handleChatReaction = (
        messageId: string,
        emoji: string
    ) => {
        if (
            !socket ||
            !roomId ||
            !user
        ) {
            return;
        }

        socket.emit(
            "toggle-chat-reaction",
            {
                roomId,
                messageId,
                userId: user.id,
                userName: user.name,
                emoji,
            }
        );

        setReactionPickerMessageId(null);
    };

    const handleChatKeyDown = (
        event: KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();
            handleSendChatMessage();
        }
    };

    // =========================
    // CHAT AUTO SCROLL
    // =========================

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop =
                chatMessagesRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // Close an open reaction picker when clicking elsewhere.
    useEffect(() => {
        const handleDocumentClick = () => {
            setReactionPickerMessageId(null);
            setChatEmojiPickerOpen(false);
        };

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        return () => {
            document.removeEventListener(
                "click",
                handleDocumentClick
            );
        };
    }, []);

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
        event: globalThis.KeyboardEvent
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

                {/* PARTICIPANTS + CHAT */}

                <aside className="participants-panel">

                    <div className="panel-header">

                        <span>
                            PARTICIPANTS
                        </span>

                        <span className="participant-count">
                            {participants.length}
                        </span>

                    </div>

                    <div className="participant-list">

                        {participants.length === 0 ? (
                            <div className="chat-empty">
                                <p>No participants</p>
                            </div>
                        ) : (
                            participants.map((participant) => (
                                <div
                                    className="participant"
                                    key={participant.userId}
                                >
                                    <div className="participant-avatar">
                                        {participant.userName
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    <div>
                                        <p>
                                            {participant.userName}
                                        </p>

                                        <span>
                                            {participant.userId === user?.id
                                                ? "You"
                                                : "Online"}
                                        </span>
                                    </div>

                                    <div className="online-dot" />
                                </div>
                            ))
                        )}

                    </div>

                    <div className="room-chat">

                        <div className="chat-header">
                            <span>
                                CHAT
                            </span>

                            <span className="chat-count">
                                {chatMessages.length}
                            </span>
                        </div>

                        <div
                            className="chat-messages"
                            ref={chatMessagesRef}
                        >
                            {chatMessages.length === 0 ? (
                                <div className="chat-empty">
                                    <div className="chat-empty-icon">
                                        💬
                                    </div>

                                    <p>
                                        No messages yet
                                    </p>

                                    <span>
                                        Start the conversation.
                                    </span>
                                </div>
                            ) : (
                                chatMessages.map((chatMessage) => (
                                    <div
                                        className={`chat-message ${
                                            chatMessage.userId === user?.id
                                                ? "own"
                                                : ""
                                        }`}
                                        key={chatMessage.id}
                                    >
                                        <div className="chat-message-content">
                                            <div className="chat-message-meta-box">
                                                <div className="chat-message-avatar">
                                                    {chatMessage.userName
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <strong>
                                                    {chatMessage.userId === user?.id
                                                        ? "You"
                                                        : chatMessage.userName}
                                                </strong>

                                                <span>
                                                    {new Date(
                                                        chatMessage.timestamp
                                                    ).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>

                                            <div className="chat-message-bubble-wrap">
                                            {chatMessage.replyTo && (
                                                <div className="chat-reply-preview">
                                                    <span className="chat-reply-label">
                                                        ↩ Replying to {chatMessage.replyTo.userId === user?.id ? "You" : chatMessage.replyTo.userName}
                                                    </span>
                                                    <span className="chat-reply-text">
                                                        {chatMessage.replyTo.message}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="chat-message-text">
                                                {chatMessage.message}
                                            </div>

                                            <div className="chat-message-actions">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleReplyToMessage(chatMessage)
                                                    }
                                                    title="Reply"
                                                >
                                                    ↩
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCopyMessage(chatMessage)
                                                    }
                                                    title="Copy"
                                                >
                                                    {copiedMessageId === chatMessage.id
                                                        ? "✓"
                                                        : "⧉"}
                                                </button>

                                                {chatMessage.userId === user?.id && (
                                                    <button
                                                        type="button"
                                                        className="delete"
                                                        onClick={() =>
                                                            handleDeleteChatMessage(
                                                                chatMessage.id
                                                            )
                                                        }
                                                        title="Delete"
                                                    >
                                                        🗑
                                                    </button>
                                                )}
                                            </div>

                                            <div className="chat-reaction-area">
                                                <button
                                                    type="button"
                                                    className="chat-reaction-trigger"
                                                    onClick={(event) => {
                                                        event.stopPropagation();

                                                        setReactionPickerMessageId(
                                                            (current) =>
                                                                current ===
                                                                chatMessage.id
                                                                    ? null
                                                                    : chatMessage.id
                                                        );
                                                    }}
                                                    title="Add reaction"
                                                >
                                                    😊
                                                </button>

                                                {reactionPickerMessageId ===
                                                    chatMessage.id && (
                                                    <div
                                                        className="chat-reaction-picker"
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        {chatReactionEmojis.map(
                                                            (emoji) => (
                                                                <button
                                                                    type="button"
                                                                    key={emoji}
                                                                    className="chat-reaction-option"
                                                                    onClick={() =>
                                                                        handleChatReaction(
                                                                            chatMessage.id,
                                                                            emoji
                                                                        )
                                                                    }
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {chatMessage.reactions &&
                                            chatMessage.reactions.length > 0 && (
                                                <div className="chat-reaction-list">
                                                    {Object.entries(
                                                        chatMessage.reactions.reduce(
                                                            (
                                                                counts: Record<
                                                                    string,
                                                                    {
                                                                        count: number;
                                                                        reactedByMe: boolean;
                                                                    }
                                                                >,
                                                                reaction
                                                            ) => {
                                                                if (
                                                                    !counts[
                                                                        reaction
                                                                            .emoji
                                                                    ]
                                                                ) {
                                                                    counts[
                                                                        reaction
                                                                            .emoji
                                                                    ] = {
                                                                        count: 0,
                                                                        reactedByMe:
                                                                            false,
                                                                    };
                                                                }

                                                                counts[
                                                                    reaction
                                                                        .emoji
                                                                ].count += 1;

                                                                if (
                                                                    reaction.userId ===
                                                                    user?.id
                                                                ) {
                                                                    counts[
                                                                        reaction
                                                                            .emoji
                                                                    ].reactedByMe =
                                                                        true;
                                                                }

                                                                return counts;
                                                            },
                                                            {}
                                                        )
                                                    ).map(
                                                        ([
                                                            emoji,
                                                            reactionInfo,
                                                        ]) => (
                                                            <button
                                                                type="button"
                                                                key={emoji}
                                                                className={`chat-reaction-chip ${
                                                                    reactionInfo.reactedByMe
                                                                        ? "active"
                                                                        : ""
                                                                }`}
                                                                onClick={() =>
                                                                    handleChatReaction(
                                                                        chatMessage.id,
                                                                        emoji
                                                                    )
                                                                }
                                                                title="Toggle reaction"
                                                            >
                                                                <span>
                                                                    {
                                                                        emoji
                                                                    }
                                                                </span>

                                                                <span>
                                                                    {
                                                                        reactionInfo.count
                                                                    }
                                                                </span>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="chat-input-area">
                            {replyingTo && (
                                <div className="chat-reply-composer">
                                    <div>
                                        <strong>
                                            ↩ Replying to {replyingTo.userId === user?.id ? "You" : replyingTo.userName}
                                        </strong>
                                        <span>
                                            {replyingTo.message}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setReplyingTo(null)
                                        }
                                        title="Cancel reply"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <div className="chat-composer">
                                <textarea
                                    ref={chatInputRef}
                                    value={chatInput}
                                    onChange={(event) =>
                                        setChatInput(event.target.value)
                                    }
                                    onKeyDown={handleChatKeyDown}
                                    placeholder="Type a message..."
                                    maxLength={2000}
                                    rows={2}
                                />

                                <button
                                    type="button"
                                    className={`chat-emoji-button ${
                                        chatEmojiPickerOpen ? "active" : ""
                                    }`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setReactionPickerMessageId(null);
                                        setChatEmojiPickerOpen((previous) => !previous);
                                    }}
                                    title="Add emoji"
                                >
                                    😊
                                </button>

                                {chatEmojiPickerOpen && (
                                    <div
                                        className="chat-composer-emoji-picker"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        {chatMessageEmojis.map((emoji) => (
                                            <button
                                                type="button"
                                                key={emoji}
                                                className="chat-composer-emoji"
                                                onClick={() =>
                                                    handleChatEmojiSelect(emoji)
                                                }
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                className="chat-send-button"
                                onClick={handleSendChatMessage}
                                disabled={!chatInput.trim() || !socket}
                                title="Send message"
                            >
                                ➤
                            </button>
                        </div>

                        <div className="chat-hint">
                            Press Enter to send • Shift + Enter for new line
                        </div>

                    </div>

                </aside>

            </div>

        </div>
    );
};

export default CodingRoom;