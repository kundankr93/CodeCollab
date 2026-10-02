import {
    useEffect,
    useRef,
    useState,
} from "react";
import type {
    ChangeEvent,
    KeyboardEvent,
    ReactNode,
} from "react";

import {
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";

import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

import {
    io,
    Socket,
} from "socket.io-client";

import axios from "axios";

import api from "../api/axios";

import { useAuth } from "../context/AuthContext";

import "../styles/coding-room.css";
import "../styles/chat-reactions.css";
import "../styles/chat-message-actions.css";
import "../styles/room-file-collaboration.css";

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
    testCases?: TestCase[];
    createdAt: string;
        interviewMode: boolean;
    interviewDurationMinutes: number;
    interviewStartedAt: string | null;
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
    online: boolean;
}

interface RoomFile {
    _id?: string;
    name: string;
    path: string;
    content: string;
    language?: string;
    version?: number;
}

interface RemoteRoomFileCursor {
    roomId: string;
    userId: string;
    userName: string;
    fileId: string;
    lineNumber: number;
    column: number;
}

interface FileTreeNode {
    name: string;
    path: string;
    type: "file" | "folder";
    file?: RoomFile;
    children: FileTreeNode[];
}

type OutputTab =
    | "terminal"
    | "output"
    | "tests";

const getFreshSocketAccessToken =
    async (): Promise<string | null> => {
        const accessToken =
            localStorage.getItem(
                "accessToken"
            );

        if (!accessToken) {
            return null;
        }

        /*
         * Use the current access token when it has
         * at least 30 seconds remaining.
         */
        try {
            const parts =
                accessToken.split(".");

            if (parts.length === 3) {
                const payload =
                    JSON.parse(
                        atob(
                            parts[1]
                                .replace(
                                    /-/g,
                                    "+"
                                )
                                .replace(
                                    /_/g,
                                    "/"
                                )
                        )
                    );

                const expiresAt =
                    Number(
                        payload?.exp
                    ) * 1000;

                if (
                    Number.isFinite(
                        expiresAt
                    ) &&
                    expiresAt >
                        Date.now() +
                            30_000
                ) {
                    return accessToken;
                }
            }
        } catch {
            // Refresh below.
        }

        const refreshToken =
            localStorage.getItem(
                "refreshToken"
            );

        if (!refreshToken) {
            return null;
        }

        try {
            /*
             * Plain axios is intentional. The refresh request
             * must not recursively enter the API interceptor.
             */
            const response =
                await axios.post(
                    "http://localhost:5000/api/auth/refresh",
                    {
                        refreshToken,
                    },
                    {
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                    }
                );

            const newAccessToken =
                response.data
                    ?.accessToken;

            const newRefreshToken =
                response.data
                    ?.refreshToken;

            if (!newAccessToken) {
                throw new Error(
                    "Refresh response did not contain an access token."
                );
            }

            localStorage.setItem(
                "accessToken",
                newAccessToken
            );

            if (newRefreshToken) {
                localStorage.setItem(
                    "refreshToken",
                    newRefreshToken
                );
            }

            return newAccessToken;
        } catch (error) {
            console.error(
                "Failed to refresh Socket.IO access token:",
                error
            );

            return null;
        }
    };

const CodingRoom = () => {
    const { roomId } = useParams();

const navigate = useNavigate();

    const location = useLocation();

const isInterviewRoomRoute =
    location.pathname.startsWith("/interview-rooms/");

    const { user } = useAuth();

    const [room, setRoom] =
        useState<Room | null>(null);

    const isOwner = Boolean(
        room && user && room.owner === user.id
    );

    const isCompleted = room?.status === "completed";
    const isActive = room?.status === "active";
    const isWaiting = room?.status === "waiting";

        const [interviewRemainingSeconds, setInterviewRemainingSeconds] =
        useState<number | null>(null);

    useEffect(() => {
        if (
            !room?.interviewMode ||
            room.status !== "active" ||
            !room.interviewStartedAt
        ) {
            setInterviewRemainingSeconds(null);
            return;
        }

        const updateTimer = () => {
            const startTime = new Date(
                room.interviewStartedAt!
            ).getTime();

            const durationSeconds =
                room.interviewDurationMinutes * 60;

            const elapsedSeconds = Math.floor(
                (Date.now() - startTime) / 1000
            );

            setInterviewRemainingSeconds(
                Math.max(0, durationSeconds - elapsedSeconds)
            );
        };

        updateTimer();

        const intervalId = window.setInterval(
            updateTimer,
            1000
        );

        return () => {
            window.clearInterval(intervalId);
        };
    }, [
        room?.interviewMode,
        room?.status,
        room?.interviewStartedAt,
        room?.interviewDurationMinutes,
    ]);

    const formatInterviewTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(
            seconds
        ).padStart(2, "0")}`;
    };

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

    const socketRef =
        useRef<Socket | null>(null);

    const [participants, setParticipants] =
        useState<RoomParticipant[]>([]);

    const [chatMessages, setChatMessages] =
        useState<ChatMessage[]>([]);

    const [chatInput, setChatInput] =
        useState("");

    const [typingUsers, setTypingUsers] =
        useState<Record<string, string>>({});

    const typingTimeoutRef =
        useRef<number | null>(null);

    const [replyingTo, setReplyingTo] =
        useState<ChatMessage | null>(null);

    const [copiedMessageId, setCopiedMessageId] =
        useState<string | null>(null);

    const [chatEmojiPickerOpen, setChatEmojiPickerOpen] =
        useState(false);

    const chatInputRef =
        useRef<HTMLTextAreaElement | null>(null);

    const chatMessageEmojis = [
    // Smileys and emotions
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
    "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚",
    "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
    "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶",
    "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫨", "🙂‍↔️",
    "🙂‍↕️", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
    "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳",
    "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮",
    "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥",
    "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱",
    "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡",
    "👹", "👺", "👻", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹",
    "😻", "😼", "😽", "🙀", "😿", "😾",

    // Moon, space and weather
    "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌙", "🌚",
    "🌛", "🌜", "🌝", "🌞", "🪐", "🌍", "🌎", "🌏", "🌐", "☄️",
    "⭐", "🌟", "✨", "⚡", "☀️", "🌤️", "⛅", "🌥️", "🌦️", "🌧️",
    "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄", "🌬️", "💨", "🌪️", "🌫️",
    "🌈", "☔", "💧", "💦", "🔥", "💥", "🎆", "🎇", "🌠", "🛸",
    "🚀", "🌌", "🌊", "☁️",

    // Hearts
    "❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜", "🤎", "🖤",
    "🩶", "🤍", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗",
    "💖", "💘", "💝", "💟", "♥️", "💌", "💋",

    // Hands and gestures
    "🫶", "🙌", "👏", "🙏", "🤝", "👍", "👎", "👊", "✊", "🤛",
    "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉",
    "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪",
    "🦾", "🫵", "🫱", "🫲", "🫳", "🫴", "🫷", "🫸", "👐", "🤲",
    "✍️", "💅", "🤳", "💍", "💎",

    // Body parts
    "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️",
    "👅", "👄", "🫦", "🦵", "🦶", "👣", "🫆",

    // People and faces
    "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧔", "🧔‍♂️", "🧔‍♀️",
    "👱", "👱‍♂️", "👱‍♀️", "👨‍🦰", "👩‍🦰", "👨‍🦱", "👩‍🦱",
    "👨‍🦳", "👩‍🦳", "👨‍🦲", "👩‍🦲", "🧓", "👴", "👵",
    "🙍", "🙍‍♂️", "🙍‍♀️", "🙎", "🙎‍♂️", "🙎‍♀️",
    "🙅", "🙅‍♂️", "🙅‍♀️", "🙆", "🙆‍♂️", "🙆‍♀️",
    "💁", "💁‍♂️", "💁‍♀️", "🙋", "🙋‍♂️", "🙋‍♀️",
    "🧏", "🧏‍♂️", "🧏‍♀️", "🙇", "🙇‍♂️", "🙇‍♀️",
    "🤦", "🤦‍♂️", "🤦‍♀️", "🤷", "🤷‍♂️", "🤷‍♀️",
    "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍🎓", "👨‍🎓", "👩‍🎓",
    "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔬", "👨‍🔬", "👩‍🔬",
    "🧑‍🚀", "👨‍🚀", "👩‍🚀", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️",
    "🧑‍🏫", "👨‍🏫", "👩‍🏫",

    // Celebration and objects
    "🎉", "🎊", "🎈", "🎁", "🎀", "💯", "💡", "🔔", "📢",
    "📣", "💬", "💭", "🗨️", "🗯️", "💤", "✨", "⚡", "💫",
    "🌟", "⭐", "🔥", "🚀", "💻", "📱", "🎮", "🎵", "🎶",
    "🏆", "🥇", "🏅", "🎯", "🎲", "🧩", "📌", "📍", "🔑",
    "🔒", "🔓", "❤️", "♻️", "✅", "❌", "❗", "❓"
];

    const [reactionPickerMessageId, setReactionPickerMessageId] =
        useState<string | null>(null);

    const chatReactionEmojis = [
        "👍",
        "❤️",
        "🔥",
        "👏",
        "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
    "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚",
    "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
    "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶",
    "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫨", "🙂‍↔️",
    "🙂‍↕️", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
    "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳",
    "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮",
    "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥",
    "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱",
    ];

    const chatMessagesRef =
        useRef<HTMLDivElement | null>(null);

    const editorRef =
        useRef<Parameters<OnMount>[0] | null>(
            null
        );

    const remoteCursorsRef =
        useRef<Map<string, RemoteRoomFileCursor>>(
            new Map()
        );

    const remoteCursorDecorationIdsRef =
        useRef<string[]>([]);

    const cursorEmitTimeoutRef =
        useRef<number | null>(null);

    const lastCursorEmitRef =
        useRef<{
            lineNumber: number;
            column: number;
            fileId: string;
        } | null>(null);

    /*
     * Tracks whether this socket has successfully joined the active
     * RoomFile Socket.IO room.
     */
    const joinedRoomFileIdRef =
        useRef<string | null>(null);

    const latestRoomFileCodeRef =
        useRef<{
            fileId: string;
            code: string;
        } | null>(null);

    const fileInputRef =
        useRef<HTMLInputElement | null>(null);

    const folderInputRef =
        useRef<HTMLInputElement | null>(null);

    const fileSaveTimeoutRef =
        useRef<number | null>(null);

    const roomFileRemoteUpdateRef =
        useRef(false);

    const roomFileDirtyRef =
        useRef<Set<string>>(new Set());

    const roomFilesRef =
        useRef<RoomFile[]>([]);

    const activeFileNameRef =
        useRef("");

    const [fileConflict, setFileConflict] =
        useState<string | null>(null);

    const [uploadMenuOpen, setUploadMenuOpen] =
        useState(false);

    const [roomFiles, setRoomFiles] =
        useState<RoomFile[]>([
            {
                name: "main.cpp",
                path: "main.cpp",
                content: `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\n    cout << "Hello, CodeCollab!" << endl;\n\n    return 0;\n}`
            },
            {
                name: "test.cpp",
                path: "test.cpp",
                content: ""
            },
        ]);

    const [activeFileName, setActiveFileName] =
        useState("main.cpp");

    const [expandedFolders, setExpandedFolders] =
        useState<Set<string>>(new Set());

    useEffect(() => {
        roomFilesRef.current = roomFiles;
    }, [roomFiles]);

    useEffect(() => {
        activeFileNameRef.current = activeFileName;
    }, [activeFileName]);

    useEffect(() => {
        return () => {
            if (fileSaveTimeoutRef.current !== null) {
                window.clearTimeout(
                    fileSaveTimeoutRef.current
                );
            }

            if (
                cursorEmitTimeoutRef.current !==
                null
            ) {
                window.clearTimeout(
                    cursorEmitTimeoutRef.current
                );
            }

            if (editorRef.current) {
                remoteCursorDecorationIdsRef.current =
                    editorRef.current.deltaDecorations(
                        remoteCursorDecorationIdsRef.current,
                        []
                    );
            }
        };
    }, []);

    const terminalOutputRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const refreshRemoteCursorDecorations = () => {
        const editor = editorRef.current;

        if (!editor) {
            return;
        }

        const activeFileId =
            roomFilesRef.current.find(
                (file) =>
                    file.path ===
                    activeFileNameRef.current
            )?._id;

        if (!activeFileId) {
            remoteCursorDecorationIdsRef.current =
                editor.deltaDecorations(
                    remoteCursorDecorationIdsRef.current,
                    []
                );
            return;
        }

        const decorations =
            (Array.from(
                remoteCursorsRef.current.values()
            )
                .filter(
                    (cursor) =>
                        cursor.fileId ===
                        activeFileId
                )
                .map((cursor) => {
                    const safeLineNumber =
                        Math.max(
                            1,
                            cursor.lineNumber
                        );

                    const safeColumn =
                        Math.max(
                            1,
                            cursor.column
                        );

                    /*
                     * Use a stable color class based on userId so
                     * different users can be distinguished.
                     */
                    let hash = 0;

                    for (
                        let index = 0;
                        index < cursor.userId.length;
                        index += 1
                    ) {
                        hash =
                            (hash * 31 +
                                cursor.userId.charCodeAt(
                                    index
                                )) |
                            0;
                    }

                    const colorIndex =
                        Math.abs(hash) % 6;

                    return {
                        range: {
                            startLineNumber:
                                safeLineNumber,
                            startColumn:
                                safeColumn,
                            endLineNumber:
                                safeLineNumber,
                            endColumn:
                                safeColumn,
                        },
                        options: {
                            isWholeLine: true,
                            className:
                                `codecollab-remote-line-${colorIndex}`,
                            beforeContentClassName:
                                `codecollab-remote-cursor-${colorIndex}`,
                            after: {
                                content:
                                    `  ${cursor.userName || "Anonymous"}`,
                                inlineClassName:
                                    `codecollab-remote-label-${colorIndex}`,
                            },
                            hoverMessage: {
                                value:
                                    `**${cursor.userName || "Anonymous"}** is editing here`,
                            },
                        },
                    };
                }) as Parameters<
                    typeof editor.deltaDecorations
                >[1]);

        remoteCursorDecorationIdsRef.current =
            editor.deltaDecorations(
                remoteCursorDecorationIdsRef.current,
                decorations
            );
    };

    const emitCurrentCursorPosition = () => {
        const editor = editorRef.current;

        if (
            !editor ||
            !socketRef.current ||
            !socketRef.current.connected ||
            !roomId ||
            !user
        ) {
            return;
        }

        const activeFile =
            roomFilesRef.current.find(
                (file) =>
                    file.path ===
                    activeFileNameRef.current
            );

        if (!activeFile?._id) {
            return;
        }

        if (
            joinedRoomFileIdRef.current !==
            activeFile._id
        ) {
            return;
        }

        const position =
            editor.getPosition();

        if (!position) {
            return;
        }

        const nextCursor = {
            lineNumber:
                position.lineNumber,
            column:
                position.column,
            fileId:
                activeFile._id,
        };

        const previous =
            lastCursorEmitRef.current;

        if (
            previous &&
            previous.fileId ===
                nextCursor.fileId &&
            previous.lineNumber ===
                nextCursor.lineNumber &&
            previous.column ===
                nextCursor.column
        ) {
            return;
        }

        lastCursorEmitRef.current =
            nextCursor;

        socketRef.current.emit(
            "room-file-cursor-change",
            {
                roomId,
                fileId:
                    activeFile._id,
                userId:
                    user.id,
                userName:
                    user.name,
                lineNumber:
                    position.lineNumber,
                column:
                    position.column,
            }
        );
    };

    const scheduleCursorEmit = () => {
        if (
            cursorEmitTimeoutRef.current !==
            null
        ) {
            return;
        }

        cursorEmitTimeoutRef.current =
            window.setTimeout(() => {
                cursorEmitTimeoutRef.current =
                    null;

                emitCurrentCursorPosition();
            }, 40);
    };

    const handleEditorMount: OnMount = (
        editor
    ) => {
        editorRef.current = editor;

        editor.onDidChangeCursorPosition(
            () => {
                scheduleCursorEmit();
            }
        );

        editor.onDidChangeCursorSelection(
            () => {
                scheduleCursorEmit();
            }
        );

        refreshRemoteCursorDecorations();
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

    const [testCasesInitialized, setTestCasesInitialized] =
        useState(false);

    const testCasesRemoteUpdateRef =
        useRef(false);

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

                    setRoomFiles((previous) =>
                        previous.map((file) =>
                            file.name === "main.cpp"
                                ? {
                                      ...file,
                                      content: loadedRoom.code,
                                  }
                                : file
                        )
                    );
                }

                if (Array.isArray(loadedRoom.testCases) && loadedRoom.testCases.length > 0) {
                    setTestCases(loadedRoom.testCases);
                } else {
                    setTestCases([
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
                }

                setTestCasesInitialized(true);

                // The room itself is ready now. Do not block the entire
                // editor while the persistent files and chat history load.
                if (!cancelled) {
                    setLoading(false);
                }

                // Load the persistent multi-file workspace in the background.
                try {
                    const filesResponse = await api.get(
                        `/rooms/${roomId}/files`
                    );

                    if (cancelled) {
                        return;
                    }

                    const persistedFiles =
                        Array.isArray(filesResponse.data.files)
                            ? filesResponse.data.files
                            : [];

                    if (persistedFiles.length > 0) {
                        const normalizedFiles: RoomFile[] =
                            persistedFiles.map((file: RoomFile) => ({
                                _id: file._id,
                                name: file.name,
                                path: file.path,
                                content: file.content || "",
                                language: file.language,
                                version:
                                    typeof file.version === "number"
                                        ? file.version
                                        : 1,
                            }));

                        setRoomFiles(normalizedFiles);

                        const savedActiveFilePath = localStorage.getItem(
                            `codecollab-active-file:${roomId}`
                        );

                        const preferredFile =
                            (savedActiveFilePath
                                ? normalizedFiles.find(
                                      (file) =>
                                          file.path === savedActiveFilePath
                                  )
                                : undefined) ||
                            normalizedFiles.find(
                                (file) => file.path === "main.cpp"
                            ) ||
                            normalizedFiles[0];

                        const firstFile = preferredFile;

                        setActiveFileName(firstFile.path);
                        localStorage.setItem(
                            `codecollab-active-file:${roomId}`,
                            firstFile.path
                        );

                        if (firstFile.content) {
                            setCode(firstFile.content);
                        } else if (firstFile._id) {
                            try {
                                const firstFileResponse = await api.get(
                                    `/rooms/${roomId}/files/${firstFile._id}`
                                );
                                const loadedServerFile =
                                    firstFileResponse.data.file;

                                const firstContent =
                                    loadedServerFile?.content || "";

                                const firstVersion =
                                    typeof loadedServerFile?.version === "number"
                                        ? loadedServerFile.version
                                        : firstFile.version ?? 1;

                                setCode(firstContent);
                                setRoomFiles((previous) =>
                                    previous.map((item) =>
                                        item._id === firstFile._id
                                            ? {
                                                  ...item,
                                                  content: firstContent,
                                                  version: firstVersion,
                                              }
                                            : item
                                    )
                                );
                            } catch (fileError) {
                                console.error(
                                    "Failed to load first room file:",
                                    fileError
                                );
                            }
                        }

                        const folderPaths = new Set<string>();
                        normalizedFiles.forEach((file) => {
                            const parts = file.path
                                .replace(/\\/g, "/")
                                .split("/")
                                .filter(Boolean);

                            let currentPath = "";
                            parts.slice(0, -1).forEach((part) => {
                                currentPath = currentPath
                                    ? `${currentPath}/${part}`
                                    : part;
                                folderPaths.add(currentPath);
                            });
                        });

                        setExpandedFolders((previous) => {
                            const next = new Set(previous);
                            folderPaths.forEach((path) => next.add(path));
                            return next;
                        });
                    }
                } catch (fileLoadError) {
                    console.error(
                        "Failed to load persistent room files:",
                        fileLoadError
                    );
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
                // Loading is cleared as soon as the core room data is ready.
                // File workspace and chat history continue loading in the background.
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
        if (!roomId || !room || isCompleted) {
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
        isCompleted,
    ]);

    // =========================
    // PERSIST + SYNC TEST CASES
    // =========================

    useEffect(() => {
        if (
            !roomId ||
            !room ||
            isCompleted ||
            !socket ||
            !testCasesInitialized
        ) {
            return;
        }

        if (testCasesRemoteUpdateRef.current) {
            testCasesRemoteUpdateRef.current = false;
            return;
        }

        const timeoutId = window.setTimeout(() => {
            socket.emit(
                "test-cases-update",
                {
                    roomId,
                    userId: user?.id,
                    testCases,
                }
            );
        }, 500);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        testCases,
        testCasesInitialized,
        roomId,
        room,
        socket,
        user,
        isCompleted,
    ]);

    // =========================
    // SOCKET
    // =========================

    useEffect(() => {
        let cancelled = false;
        let newSocket: Socket | null = null;
        let refreshAttempted = false;

        const connectSocket = async () => {
            if (
                !roomId ||
                !user
            ) {
                return;
            }

            const accessToken =
                await getFreshSocketAccessToken();

            if (
                cancelled ||
                !accessToken
            ) {
                if (!cancelled) {
                    setError(
                        "Your session has expired. Please login again."
                    );
                }

                return;
            }

            setParticipants([
                {
                    userId: user.id,
                    userName: user.name,
                    online: true,
                },
            ]);

            newSocket = io(
                "http://localhost:5000",
                {
                    auth: {
                        token:
                            accessToken,
                    },
                }
            );

            const connectedSocket = newSocket!;

            setSocket(
                connectedSocket
            );
            socketRef.current =
                connectedSocket;

        connectedSocket.on(
            "connect",
            () => {
                refreshAttempted = false;

                console.log(
                    "Socket connected:",
                    newSocket?.id
                );

                connectedSocket.emit(
                    "join-room",
                    {
                        roomId,
                        userId: user.id,
                        userName: user.name,
                    }
                );
            }
        );

        connectedSocket.on(
            "connect_error",
            async (
                socketError
            ) => {
                console.error(
                    "Socket connection error:",
                    socketError
                );

                /*
                 * Refresh only once for a rejected socket
                 * connection. A successful reconnect resets
                 * this guard.
                 */
                if (
                    refreshAttempted ||
                    cancelled
                ) {
                    return;
                }

                refreshAttempted =
                    true;

                const freshToken =
                    await getFreshSocketAccessToken();

                if (
                    cancelled ||
                    !newSocket
                ) {
                    return;
                }

                if (!freshToken) {
                    setError(
                        "Your session has expired. Please login again."
                    );

                    connectedSocket.disconnect();
                    return;
                }

                connectedSocket.auth = {
                    token:
                        freshToken,
                };

                connectedSocket.connect();
            }
        );

        connectedSocket.on(
            "code-update",
            (data: { code: string }) => {
                setCode(data.code);
            }
        );

        connectedSocket.on(
            "room-file-code-update",
            (data: {
                roomId: string;
                fileId: string;
                code: string;
                version?: number;
            }) => {
                if (
                    data.roomId !== roomId ||
                    !data.fileId ||
                    typeof data.code !== "string"
                ) {
                    return;
                }

                const currentFile =
                    roomFilesRef.current.find(
                        (file) => file._id === data.fileId
                    );

                /*
                 * Socket updates are real-time previews.
                 *
                 * The HTTP save is authoritative for version
                 * tracking. Therefore an older socket payload without
                 * a version must NEVER advance the local version.
                 *
                 * If a future backend sends a version, we use it for
                 * ordering.
                 */
                const remoteVersion = data.version;
                const hasRemoteVersion =
                    typeof remoteVersion === "number" &&
                    Number.isInteger(remoteVersion) &&
                    remoteVersion >= 1;

                if (
                    hasRemoteVersion &&
                    currentFile?.version !== undefined &&
                    remoteVersion <= currentFile.version
                ) {
                    return;
                }

                const nextVersion =
                    hasRemoteVersion
                        ? remoteVersion
                        : currentFile?.version;

                const activeFile =
                    roomFilesRef.current.find(
                        (file) =>
                            file.path ===
                            activeFileNameRef.current
                    );

                const isActiveFile =
                    activeFile?._id === data.fileId;

                const isDirty =
                    roomFileDirtyRef.current.has(
                        data.fileId
                    );

                /*
                 * Do not overwrite text that this user is
                 * currently editing.
                 *
                 * The remote update is still remembered as a
                 * conflict. The HTTP save will compare versions
                 * and retry the local change against the newer
                 * server version.
                 */
                if (isDirty) {
                    if (isActiveFile) {
                        setFileConflict(
                            "Another user changed this file. Your local changes are being synchronized."
                        );
                    }

                    return;
                }

                /*
                 * This is a clean local editor, so it is safe to
                 * apply the remote change immediately.
                 */
                if (isActiveFile) {
                    roomFileRemoteUpdateRef.current = true;
                    setCode(data.code);
                }

                setRoomFiles((previous) =>
                    previous.map((file) =>
                        file._id === data.fileId
                            ? {
                                  ...file,
                                  content: data.code,
                                  ...(nextVersion !== undefined
                                      ? { version: nextVersion }
                                      : {}),
                              }
                            : file
                    )
                );
            }
        );

        connectedSocket.on(
            "room-file-joined",
            (data: {
                roomId: string;
                fileId: string;
            }) => {
                if (
                    data?.roomId !== roomId ||
                    !data?.fileId
                ) {
                    return;
                }

                joinedRoomFileIdRef.current =
                    data.fileId;

                console.log(
                    `Room file socket ready: ${data.fileId}`
                );

                /*
                 * If the user typed while the join request was still
                 * being processed, replay the latest code immediately
                 * now that the server has confirmed the file room.
                 */
                const pendingCode =
                    latestRoomFileCodeRef.current;

                if (
                    pendingCode &&
                    pendingCode.fileId ===
                        data.fileId &&
                    socketRef.current?.connected
                ) {
                    socketRef.current.emit(
                        "room-file-code-change",
                        {
                            roomId,
                            fileId:
                                data.fileId,
                            code:
                                pendingCode.code,
                        }
                    );
                }

                /*
                 * Send the current cursor immediately after the
                 * server confirms that this socket is in the
                 * file-specific Socket.IO room.
                 */
                window.setTimeout(() => {
                    emitCurrentCursorPosition();
                }, 0);
            }
        );

        connectedSocket.on(
            "room-file-cursor-update",
            (data: RemoteRoomFileCursor) => {
                if (
                    data.roomId !== roomId ||
                    !data.fileId ||
                    !data.userId ||
                    data.userId === user.id ||
                    !Number.isInteger(
                        data.lineNumber
                    ) ||
                    !Number.isInteger(
                        data.column
                    ) ||
                    data.lineNumber < 1 ||
                    data.column < 1
                ) {
                    return;
                }

                remoteCursorsRef.current.set(
                    data.userId,
                    {
                        roomId: data.roomId,
                        userId:
                            data.userId,
                        userName:
                            data.userName ||
                            "Anonymous",
                        fileId:
                            data.fileId,
                        lineNumber:
                            data.lineNumber,
                        column:
                            data.column,
                    }
                );

                refreshRemoteCursorDecorations();
            }
        );

        connectedSocket.on(
            "room-file-user-left",
            (data: {
                userId: string;
                fileId: string;
            }) => {
                if (!data?.userId) {
                    return;
                }

                remoteCursorsRef.current.delete(
                    data.userId
                );

                refreshRemoteCursorDecorations();
            }
        );

        /*
         * When a new user opens the same file, send this user's
         * current cursor immediately so the new user can see it
         * without waiting for the next cursor movement.
         */
        connectedSocket.on(
            "room-file-user-joined",
            (data: {
                userId: string;
                fileId: string;
            }) => {
                const currentActiveFileId =
                    roomFilesRef.current.find(
                        (file) =>
                            file.path ===
                            activeFileNameRef.current
                    )?._id;

                if (
                    data?.userId &&
                    data.userId !== user.id &&
                    data.fileId ===
                        currentActiveFileId
                ) {
                    window.setTimeout(() => {
                        const editor =
                            editorRef.current;

                        const position =
                            editor?.getPosition();

                        if (
                            !position ||
                            !socketRef.current ||
                            !roomId ||
                            !user
                        ) {
                            return;
                        }

                        socketRef.current.emit(
                            "room-file-cursor-change",
                            {
                                roomId,
                                fileId:
                                    currentActiveFileId,
                                userId: user.id,
                                userName: user.name,
                                lineNumber:
                                    position.lineNumber,
                                column:
                                    position.column,
                            }
                        );
                    }, 20);
                }
            }
        );

        connectedSocket.on(
            "user-joined",
            (data) => {
                console.log(
                    `${data.userName} joined the room`
                );
            }
        );

        connectedSocket.on(
            "user-left",
            (data) => {
                console.log(
                    `${data.userName} left the room`
                );

                if (data?.userId) {
                    setTypingUsers((previous) => {
                        if (!previous[data.userId]) {
                            return previous;
                        }

                        const next = { ...previous };
                        delete next[data.userId];
                        return next;
                    });
                }
            }
        );
       connectedSocket.on(
    "room-participants",
    (data: RoomParticipant[]) => {
        if (!Array.isArray(data)) {
            setParticipants([]);
            return;
        }

        setParticipants(
            data.map((participant) => ({
                userId: participant.userId,
                userName:
                    participant.userName ||
                    "Unknown User",
                online:
                    typeof participant.online === "boolean"
                        ? participant.online
                        : true,
            }))
        );
    }
);

        connectedSocket.on(
    "room-status-changed",
    (data: {
        status: "waiting" | "active" | "completed";
        interviewMode?: boolean;
        interviewDurationMinutes?: number;
        interviewStartedAt?: string | null;
    }) => {
        if (!data?.status) {
            return;
        }

        setRoom((previous) =>
            previous
                ? {
                      ...previous,
                      status: data.status,
                      interviewMode:
                          data.interviewMode ??
                          previous.interviewMode,
                      interviewDurationMinutes:
                          data.interviewDurationMinutes ??
                          previous.interviewDurationMinutes,
                      interviewStartedAt:
                          data.interviewStartedAt !== undefined
                              ? data.interviewStartedAt
                              : previous.interviewStartedAt,
                  }
                : previous
        );
    }
);

        connectedSocket.on(
    "interview-mode-changed",
    (data: {
        enabled: boolean;
        durationMinutes: number;
    }) => {
        if (typeof data?.enabled !== "boolean") {
            return;
        }

        setRoom((previous) =>
            previous
                ? {
                      ...previous,
                      interviewMode: data.enabled,
                      interviewDurationMinutes:
                          data.durationMinutes ??
                          previous.interviewDurationMinutes,
                      interviewStartedAt: data.enabled
                          ? previous.interviewStartedAt
                          : null,
                  }
                : previous
        );
    }
);

        connectedSocket.on(
            "test-cases-update",
            (data: TestCase[]) => {
                if (Array.isArray(data)) {
                    testCasesRemoteUpdateRef.current = true;
                    setTestCases(data);
                    setTestResults([]);
                    setTestSummary(null);
                }
            }
        );

        connectedSocket.on(
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

        connectedSocket.on(
            "chat-typing",
            (data: {
                roomId: string;
                userId: string;
                userName: string;
                isTyping: boolean;
            }) => {
                if (
                    !data ||
                    data.roomId !== roomId ||
                    !data.userId ||
                    data.userId === user.id
                ) {
                    return;
                }

                setTypingUsers((previous) => {
                    const next = { ...previous };

                    if (data.isTyping) {
                        next[data.userId] =
                            data.userName ||
                            "Someone";
                    } else {
                        delete next[data.userId];
                    }

                    return next;
                });
            }
        );

        connectedSocket.on(
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

        connectedSocket.on(
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

        };

        connectSocket();

        return () => {
            cancelled = true;

            if (typingTimeoutRef.current !== null) {
                window.clearTimeout(
                    typingTimeoutRef.current
                );
                typingTimeoutRef.current = null;
            }

            if (newSocket?.connected && roomId && user) {
                newSocket.emit(
                    "chat-typing",
                    {
                        roomId,
                        userId: user.id,
                        userName: user.name,
                        isTyping: false,
                    }
                );
            }

            setTypingUsers({});

            if (
                cursorEmitTimeoutRef.current !==
                null
            ) {
                window.clearTimeout(
                    cursorEmitTimeoutRef.current
                );
                cursorEmitTimeoutRef.current =
                    null;
            }

            remoteCursorsRef.current.clear();
            joinedRoomFileIdRef.current = null;
            latestRoomFileCodeRef.current = null;

            if (editorRef.current) {
                remoteCursorDecorationIdsRef.current =
                    editorRef.current.deltaDecorations(
                        remoteCursorDecorationIdsRef.current,
                        []
                    );
            }

            if (newSocket) {
                newSocket.emit(
                    "leave-room"
                );

                newSocket.disconnect();
            }

            if (
                socketRef.current ===
                newSocket
            ) {
                socketRef.current =
                    null;
            }
        };
    }, [roomId, user]);

    // =========================
    // ACTIVE ROOM FILE SOCKET
    // =========================

    const activeRoomFileId =
    roomFiles.find(
        (file) => file.path === activeFileName
    )?._id || null;

    useEffect(() => {
        if (
            !socket ||
            !roomId ||
            !user ||
            !activeRoomFileId
        ) {
            return;
        }

        const fileId =
            activeRoomFileId;

        const joinRoomFile = () => {
            if (
                !socket.connected
            ) {
                return;
            }

            /*
             * Clear the previous acknowledgement before joining.
             * The server will set it again only after socket.join(...)
             * has succeeded.
             */
            joinedRoomFileIdRef.current =
                null;

            socket.emit(
                "join-room-file",
                {
                    roomId,
                    fileId,
                    userId: user.id,
                    userName: user.name,
                }
            );

            console.log(
                `Requesting room file socket: ${roomId}/${fileId}`
            );
        };

        const leaveRoomFile = () => {
            if (
                socket.connected &&
                joinedRoomFileIdRef.current ===
                    fileId
            ) {
                socket.emit(
                    "leave-room-file",
                    {
                        roomId,
                        fileId,
                    }
                );
            }

            if (
                joinedRoomFileIdRef.current ===
                fileId
            ) {
                joinedRoomFileIdRef.current =
                    null;
            }
        };

        /*
         * Rejoin after every Socket.IO reconnect as well as the
         * initial connection. This prevents collaboration from
         * silently stopping after a temporary network reconnect.
         */
        socket.on(
            "connect",
            joinRoomFile
        );

        if (socket.connected) {
            joinRoomFile();
        }

        return () => {
            socket.off(
                "connect",
                joinRoomFile
            );
            leaveRoomFile();
        };
    }, [
        socket,
        roomId,
        user,
        activeRoomFileId,
    ]);

    useEffect(() => {
        /*
         * The active file changed. Repaint only the cursors belonging
         * to this file.
         */
        refreshRemoteCursorDecorations();

        /*
         * Also publish this user's current cursor for the newly
         * selected file immediately.
         */
        window.setTimeout(() => {
            emitCurrentCursorPosition();
        }, 30);
    }, [
        activeFileName,
        activeRoomFileId,
    ]);

    // =========================
    // ROOM LIFECYCLE
    // =========================


const handleStartSession = async () => {
    if (!roomId || !user || !isOwner || !isWaiting) {
        return;
    }

    try {
        const response = await api.put(`/rooms/${roomId}/start`);

        const startedRoom = response.data;

        setRoom((previous) =>
            previous
                ? {
                      ...previous,
                      status: startedRoom.status,
                      interviewMode:
                          startedRoom.interviewMode ??
                          previous.interviewMode,
                      interviewDurationMinutes:
                          startedRoom.interviewDurationMinutes ??
                          previous.interviewDurationMinutes,
                      interviewStartedAt:
                          startedRoom.interviewStartedAt ??
                          previous.interviewStartedAt,
                  }
                : previous
        );

        socket?.emit("room-status-changed", {
            roomId,
            userId: user.id,
            status: startedRoom.status,
        });
    } catch (error: any) {
        alert(
            error.response?.data?.message ||
                "Failed to start the room session"
        );
    }
};
    const handleToggleInterviewMode = async () => {
    if (!roomId || !user || !isOwner || !room || isCompleted) {
        return;
    }

    const enabled = !room.interviewMode;

    let durationMinutes = room.interviewDurationMinutes || 60;

    if (enabled) {
        const input = window.prompt(
            "Enter interview duration in minutes (1-240):",
            String(durationMinutes)
        );

        if (input === null) {
            return;
        }

        const parsedDuration = Number(input);

        if (
            !Number.isInteger(parsedDuration) ||
            parsedDuration < 1 ||
            parsedDuration > 240
        ) {
            alert("Please enter a whole number between 1 and 240.");
            return;
        }

        durationMinutes = parsedDuration;
    }

    try {
        const response = await api.put(
            `/rooms/${roomId}/interview-mode`,
            enabled
                ? { enabled, durationMinutes }
                : { enabled }
        );

        const updatedRoom = response.data;

        setRoom((previous) =>
            previous
                ? {
                      ...previous,
                      interviewMode: updatedRoom.interviewMode,
                      interviewDurationMinutes:
                          updatedRoom.interviewDurationMinutes,
                      interviewStartedAt:
                          updatedRoom.interviewStartedAt,
                  }
                : previous
        );

        socket?.emit("interview-mode-changed", {
            roomId,
            userId: user.id,
            enabled,
            durationMinutes,
        });
    } catch (error: any) {
        alert(
            error.response?.data?.message ||
                "Failed to update interview mode"
        );
    }
};

    const handleEndSession = async () => {
        if (!roomId || !user || !isOwner || !isActive) {
            return;
        }

        if (
            !window.confirm(
                "End this coding session? The editor, test cases and code execution will become read-only."
            )
        ) {
            return;
        }

        try {
            await api.put(`/rooms/${roomId}/complete`);
            setRoom((previous) =>
                previous
                    ? { ...previous, status: "completed" }
                    : previous
            );
            socket?.emit("room-status-changed", {
                roomId,
                userId: user.id,
                status: "completed",
            });
        } catch (error: any) {
            alert(
                error.response?.data?.message ||
                    "Failed to end the room session"
            );
        }
    };


    const handleReopenRoom = async () => {
        if (!roomId || !user || !isOwner || !isCompleted) {
            return;
        }

        if (
            !window.confirm(
                "Reopen this room? The existing code and test cases will be preserved and the room will return to waiting."
            )
        ) {
            return;
        }

        try {
            await api.put(`/rooms/${roomId}/reopen`);

            setRoom((previous) =>
                previous
                    ? { ...previous, status: "waiting" }
                    : previous
            );

            socket?.emit("room-status-changed", {
                roomId,
                userId: user.id,
                status: "waiting",
            });
        } catch (error: any) {
            alert(
                error.response?.data?.message ||
                    "Failed to reopen the room"
            );
        }
    };

    // =========================
    // FILE UPLOAD
    // =========================

    const openFilePicker = () => {
        if (isCompleted) {
            return;
        }

        setUploadMenuOpen(false);
        fileInputRef.current?.click();
    };

    const openFolderPicker = () => {
        if (isCompleted) {
            return;
        }

        setUploadMenuOpen(false);
        folderInputRef.current?.click();
    };

    const readSelectedFiles = async (
        selectedFiles: FileList | null,
        preserveRelativePath: boolean
    ) => {
        if (
            !roomId ||
            !selectedFiles ||
            selectedFiles.length === 0 ||
            isCompleted
        ) {
            return;
        }

        try {
            const ignoredDirectories = new Set([
                ".git",
                "node_modules",
                "dist",
                "build",
                "uploads",
            ]);

            const candidates = Array.from(selectedFiles)
                .map((selectedFile) => {
                    const relativePath =
                        preserveRelativePath &&
                        selectedFile.webkitRelativePath
                            ? selectedFile.webkitRelativePath
                            : selectedFile.name;

                    const normalizedRelativePath = relativePath
                        .replace(/\\/g, "/")
                        .replace(/^\/+/, "");

                    const pathParts = normalizedRelativePath
                        .split("/")
                        .filter(Boolean);

                    if (
                        pathParts.some((part) =>
                            ignoredDirectories.has(part)
                        )
                    ) {
                        return null;
                    }

                    return {
                        selectedFile,
                        normalizedRelativePath,
                    };
                })
                .filter(
                    (item): item is { selectedFile: File; normalizedRelativePath: string } =>
                        item !== null
                );

            const uploadedFiles: RoomFile[] =
                await Promise.all(
                    candidates.map(async ({ selectedFile, normalizedRelativePath }) => ({
                        name: selectedFile.name,
                        path: normalizedRelativePath,
                        content: await selectedFile.text(),
                    }))
                );

            const persistedFiles: RoomFile[] = [];

            for (let index = 0; index < uploadedFiles.length; index += 20 * 3) {
                const batchGroup = [0, 1, 2]
                    .map((offset) =>
                        uploadedFiles.slice(
                            index + offset * 20,
                            index + (offset + 1) * 20
                        )
                    )
                    .filter((batch) => batch.length > 0);

                const responses = await Promise.all(
                    batchGroup.map((batch) =>
                        api.post(
                            `/rooms/${roomId}/files`,
                            { files: batch }
                        )
                    )
                );

                responses.forEach((response) => {
                    if (Array.isArray(response.data.files)) {
                        for (const persistedFile of response.data.files) {
                            const localFile = uploadedFiles.find(
                                (file) => file.path === persistedFile.path
                            );

                            persistedFiles.push({
                                ...persistedFile,
                                content: localFile?.content || "",
                            });
                        }
                    }
                });
            }

            setRoomFiles((previous) => {
                const next = [...previous];

                persistedFiles.forEach(
                    (uploadedFile) => {
                        const existingIndex =
                            next.findIndex(
                                (file) =>
                                    file.path ===
                                    uploadedFile.path
                            );

                        if (existingIndex >= 0) {
                            next[existingIndex] =
                                uploadedFile;
                        } else {
                            next.push(
                                uploadedFile
                            );
                        }
                    }
                );

                return next;
            });

            const folderPaths = new Set<string>();

            uploadedFiles.forEach((file) => {
                const parts = file.path
                    .replace(/\\/g, "/")
                    .replace(/^\/+/, "")
                    .split("/")
                    .filter(Boolean);

                let currentPath = "";

                parts.slice(0, -1).forEach((part) => {
                    currentPath = currentPath
                        ? `${currentPath}/${part}`
                        : part;
                    folderPaths.add(currentPath);
                });
            });

            setExpandedFolders((previous) => {
                const next = new Set(previous);
                folderPaths.forEach((path) => next.add(path));
                return next;
            });

            if (uploadedFiles.length > 0) {
                const firstFile =
                    uploadedFiles[0];

                setActiveFileName(
                    firstFile.path
                );
                localStorage.setItem(
                    `codecollab-active-file:${roomId}`,
                    firstFile.path
                );

                setCode(
                    firstFile.content
                );

                if (roomId) {
                    await api.put(
                        `/rooms/${roomId}/code`,
                        {
                            code:
                                firstFile.content,
                        }
                    );

                    socket?.emit(
                        "code-change",
                        {
                            roomId,
                            code:
                                firstFile.content,
                        }
                    );
                }
            }
        } catch (uploadError) {
            console.error(
                "File upload error:",
                uploadError
            );

            alert(
                "Failed to read the selected files."
            );
        }
    };

    const handleFileUpload = async (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles =
            event.target.files;

        await readSelectedFiles(
            selectedFiles,
            false
        );

        event.target.value = "";
    };

    const handleFolderUpload = async (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles =
            event.target.files;

        await readSelectedFiles(
            selectedFiles,
            true
        );

        event.target.value = "";
    };

    const buildFileTree = (
        projectFiles: RoomFile[]
    ): FileTreeNode[] => {
        const root: FileTreeNode[] = [];

        projectFiles.forEach((file) => {
            const normalizedPath = file.path
                .replace(/\\/g, "/")
                .replace(/^\/+/, "");

            const parts = normalizedPath
                .split("/")
                .filter(Boolean);

            let currentLevel = root;
            let currentPath = "";

            parts.forEach((part, index) => {
                currentPath = currentPath
                    ? `${currentPath}/${part}`
                    : part;

                const isFile =
                    index === parts.length - 1;

                let node = currentLevel.find(
                    (item) =>
                        item.name === part &&
                        item.type ===
                            (isFile ? "file" : "folder")
                );

                if (!node) {
                    node = {
                        name: part,
                        path: currentPath,
                        type: isFile ? "file" : "folder",
                        file: isFile ? file : undefined,
                        children: [],
                    };

                    currentLevel.push(node);
                }

                if (!isFile) {
                    currentLevel = node.children;
                }
            });
        });

        const sortTree = (nodes: FileTreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === "folder" ? -1 : 1;
                }

                return a.name.localeCompare(b.name);
            });

            nodes.forEach((node) => {
                if (node.type === "folder") {
                    sortTree(node.children);
                }
            });
        };

        sortTree(root);
        return root;
    };

    const fileTree = buildFileTree(roomFiles);

    const toggleFolder = (path: string) => {
        setExpandedFolders((previous) => {
            const next = new Set(previous);

            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }

            return next;
        });
    };

    const renderFileTree = (
        nodes: FileTreeNode[],
        depth = 0
    ): ReactNode[] => {
        return nodes.flatMap((node) => {
            const isExpanded =
                node.type === "folder" &&
                expandedFolders.has(node.path);

            if (node.type === "folder") {
                return [
                    <div key={node.path}>
                        <div
                            className="file-item"
                            onClick={() =>
                                toggleFolder(node.path)
                            }
                            title={node.path}
                            style={{
                                paddingLeft:
                                    `${10 + depth * 18}px`,
                                fontWeight: 600,
                            }}
                        >
                            <span style={{ width: "20px" }}>
                                {isExpanded ? "📂" : "📁"}
                            </span>
                            <span>{node.name}</span>
                        </div>

                        {isExpanded &&
                            renderFileTree(
                                node.children,
                                depth + 1
                            )}
                    </div>,
                ];
            }

            if (!node.file) {
                return [];
            }

            const isActive =
                activeFileName === node.file.path;

            return [
                <div
                    key={node.file.path}
                    className={`file-item ${
                        isActive ? "active" : ""
                    }`}
                    onClick={() =>
                        openRoomFile(node.file as RoomFile)
                    }
                    title={node.file.path}
                    style={{
                        paddingLeft:
                            `${10 + depth * 18}px`,
                    }}
                >
                    <span style={{ width: "20px" }}>
                        📄
                    </span>
                    <span>{node.name}</span>
                </div>,
            ];
        });
    };

    const openRoomFile = async (
        file: RoomFile
    ) => {
        if (isCompleted) {
            return;
        }

        setFileConflict(null);
        setActiveFileName(file.path);
        if (roomId) {
            localStorage.setItem(
                `codecollab-active-file:${roomId}`,
                file.path
            );
        }

        if (file.content) {
            setCode(file.content);
            return;
        }

        if (!roomId || !file._id) {
            setCode("");
            return;
        }

        try {
            const response = await api.get(
                `/rooms/${roomId}/files/${file._id}`
            );

            const serverFile = response.data.file;

            const loadedFile: RoomFile = {
                ...file,
                content: serverFile?.content || "",
                language:
                    serverFile?.language ||
                    file.language,
                version:
                    typeof serverFile?.version === "number"
                        ? serverFile.version
                        : file.version ?? 1,
            };

            setFileConflict(null);
            setCode(loadedFile.content);

            setRoomFiles((previous) =>
                previous.map((item) =>
                    item._id === file._id
                        ? loadedFile
                        : item
                )
            );
        } catch (fileError) {
            console.error(
                "Failed to load room file:",
                fileError
            );
            setCode("");
        }
    };

    // =========================
    // CODE CHANGE
    // =========================

    const handleCodeChange = (
        value: string | undefined
    ) => {
        if (isCompleted) {
            return;
        }

        const newCode = value || "";

        /*
         * Monaco fires onChange when we apply a remote update.
         * Do not treat that as a local edit.
         */
        if (roomFileRemoteUpdateRef.current) {
            roomFileRemoteUpdateRef.current = false;
            setCode(newCode);
            return;
        }

        setCode(newCode);
        setFileConflict(null);

        const activeRoomFile =
            roomFilesRef.current.find(
                (file) =>
                    file.path ===
                    activeFileNameRef.current
            );

        const fileId =
            activeRoomFile?._id;

        if (fileId) {
            roomFileDirtyRef.current.add(
                fileId
            );
        }

        setRoomFiles((previous) =>
            previous.map((file) =>
                file.path ===
                activeFileNameRef.current
                    ? {
                          ...file,
                          content: newCode,
                      }
                    : file
            )
        );

        /*
         * REAL-TIME PREVIEW:
         * Send the keystroke immediately. Do not wait for the
         * debounced MongoDB save.
         *
         * No version is sent here because this is only a preview.
         * The HTTP request below remains authoritative.
         */
        if (
            fileId &&
            roomId
        ) {
            latestRoomFileCodeRef.current = {
                fileId,
                code: newCode,
            };

            if (
                socket?.connected &&
                joinedRoomFileIdRef.current ===
                    fileId
            ) {
                socket.emit(
                    "room-file-code-change",
                    {
                        roomId,
                        fileId,
                        code: newCode,
                    }
                );
            }
        }

        if (
            fileId &&
            roomId
        ) {
            if (
                fileSaveTimeoutRef.current !==
                null
            ) {
                window.clearTimeout(
                    fileSaveTimeoutRef.current
                );
            }

            fileSaveTimeoutRef.current =
                window.setTimeout(
                    async () => {
                        /*
                         * Always read the latest local content and
                         * version when the debounce expires.
                         */
                        const currentFile =
                            roomFilesRef.current.find(
                                (file) =>
                                    file._id ===
                                    fileId
                            );

                        if (!currentFile) {
                            return;
                        }

                        const saveWithVersion =
                            async (
                                content: string,
                                expectedVersion: number,
                                attempt: number
                            ): Promise<void> => {
                                try {
                                    const response =
                                        await api.put(
                                            `/rooms/${roomId}/files/${fileId}`,
                                            {
                                                content,
                                                expectedVersion,
                                            }
                                        );

                                    const savedFile =
                                        response.data.file;

                                    const newVersion =
                                        typeof savedFile?.version ===
                                        "number"
                                            ? savedFile.version
                                            : expectedVersion + 1;

                                    /*
                                     * Keep the exact content that was
                                     * successfully persisted.
                                     */
                                    setRoomFiles(
                                        (previous) =>
                                            previous.map(
                                                (file) =>
                                                    file._id ===
                                                    fileId
                                                        ? {
                                                              ...file,
                                                              content,
                                                              version:
                                                                  newVersion,
                                                          }
                                                        : file
                                            )
                                    );

                                    roomFileDirtyRef.current.delete(
                                        fileId
                                    );

                                    setFileConflict(
                                        null
                                    );

                                } catch (
                                    fileSaveError: any
                                ) {
                                    const status =
                                        fileSaveError
                                            ?.response
                                            ?.status;

                                    if (
                                        status ===
                                        409
                                    ) {
                                        const serverFile =
                                            fileSaveError
                                                ?.response
                                                ?.data
                                                ?.file;

                                        if (
                                            serverFile
                                        ) {
                                            const serverVersion =
                                                typeof serverFile.version ===
                                                "number"
                                                    ? serverFile.version
                                                    : expectedVersion + 1;

                                            /*
                                             * IMPORTANT:
                                             *
                                             * Never replace the user's
                                             * local content with the
                                             * server content.
                                             *
                                             * Instead, advance the local
                                             * version to the server version
                                             * and retry the user's local
                                             * content.
                                             *
                                             * This gives us deterministic
                                             * last-writer convergence while
                                             * preventing typed code from
                                             * disappearing.
                                             */
                                            const latestLocalFile =
                                                roomFilesRef.current.find(
                                                    (file) =>
                                                        file._id ===
                                                        fileId
                                                );

                                            const latestLocalContent =
                                                latestLocalFile?.content ??
                                                content;

                                            setRoomFiles(
                                                (previous) =>
                                                    previous.map(
                                                        (file) =>
                                                            file._id ===
                                                            fileId
                                                                ? {
                                                                      ...file,
                                                                      content:
                                                                          latestLocalContent,
                                                                      version:
                                                                          serverVersion,
                                                                  }
                                                                : file
                                                    )
                                            );

                                            setFileConflict(
                                                `Another user saved version ${serverVersion}. Your local changes are being saved on top of it.`
                                            );

                                            /*
                                             * Retry a few times because
                                             * both users may be typing at
                                             * the same time.
                                             */
                                            if (
                                                attempt <
                                                3
                                            ) {
                                                window.setTimeout(
                                                    () => {
                                                        const latest =
                                                            roomFilesRef.current.find(
                                                                (file) =>
                                                                    file._id ===
                                                                    fileId
                                                            );

                                                        if (
                                                            !latest
                                                        ) {
                                                            return;
                                                        }

                                                        void saveWithVersion(
                                                            latest.content,
                                                            serverVersion,
                                                            attempt + 1
                                                        );
                                                    },
                                                    100 *
                                                        (attempt + 1)
                                                );
                                            } else {
                                                setFileConflict(
                                                    "The file is being edited simultaneously. Your changes are still in the editor; type again to retry saving."
                                                );
                                            }

                                            return;
                                        }
                                    }

                                    console.error(
                                        "Failed to save room file:",
                                        fileSaveError
                                    );
                                }
                            };

                        /*
                         * Start with the current version stored in
                         * this browser.
                         */
                        void saveWithVersion(
                            currentFile.content,
                            currentFile.version ??
                                1,
                            0
                        );
                    },
                    600
                );

            return;
        }

        /*
         * Legacy single-room code path.
         */
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
        if (isCompleted) {
            return;
        }

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
        if (isCompleted) {
            return;
        }

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
        if (isCompleted) {
            return;
        }

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
        if (isCompleted) {
            return;
        }

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
        if (isCompleted) {
            return;
        }

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

        if (typingTimeoutRef.current !== null) {
            window.clearTimeout(
                typingTimeoutRef.current
            );
            typingTimeoutRef.current = null;
        }

        socket.emit(
            "chat-typing",
            {
                roomId,
                userId: user.id,
                userName: user.name,
                isTyping: false,
            }
        );

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

    const handleChatInputChange = (
        value: string
    ) => {
        setChatInput(value);

        if (!socket || !roomId || !user) {
            return;
        }

        if (typingTimeoutRef.current !== null) {
            window.clearTimeout(
                typingTimeoutRef.current
            );
        }

        if (!value.trim()) {
            socket.emit(
                "chat-typing",
                {
                    roomId,
                    userId: user.id,
                    userName: user.name,
                    isTyping: false,
                }
            );
            typingTimeoutRef.current = null;
            return;
        }

        socket.emit(
            "chat-typing",
            {
                roomId,
                userId: user.id,
                userName: user.name,
                isTyping: true,
            }
        );

        typingTimeoutRef.current = window.setTimeout(() => {
            if (socket.connected) {
                socket.emit(
                    "chat-typing",
                    {
                        roomId,
                        userId: user.id,
                        userName: user.name,
                        isTyping: false,
                    }
                );
            }

            typingTimeoutRef.current = null;
        }, 1200);
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
       <div className={isInterviewRoomRoute ? "coding-room interview-room" : "coding-room"}>

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

{isInterviewRoomRoute && room.interviewMode && (
    <span className="interview-room-badge">
        🎤 Interview Room
    </span>
)}

                    <span>
                        {room.language ===
                        "cpp"
                            ? "C++"
                            : room.language}
                    </span>

                    <span className={`room-status-badge ${room.status}`}>
                        {room.status === "waiting"
                            ? "🟡 Waiting"
                            : room.status === "active"
                              ? "🟢 Active"
                              : "🔴 Completed"}
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
                            isRunningTests ||
                            isCompleted
                        }
                    >
                        {isExecuting
                            ? "⏳ Running..."
                            : "▶ Run Code"}
                    </button>
                    {/* // {room?.interviewMode && isActive && interviewRemainingSeconds !== null && ( */}

                     {isInterviewRoomRoute && room.interviewMode && (
    <div
        style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 16px",
            border: "1px solid #6366f1",
            borderRadius: "10px",
            background: "#1e1b4b",
            minWidth: "130px",
        }}
    >
        <span
            style={{
                fontSize: "10px",
                color: "#c7d2fe",
                letterSpacing: "1px",
            }}
        >
            INTERVIEW TIMER
        </span>

        <strong
            style={{
                fontSize: "22px",
                color: "#ffffff",
                fontVariantNumeric: "tabular-nums",
            }}
        >
            {isCompleted
                ? "00:00"
                : formatInterviewTime(
                    isActive
                        ? interviewRemainingSeconds ??
                            room.interviewDurationMinutes * 60
                        : room.interviewDurationMinutes * 60
                )}
        </strong>

        <span
            style={{
                fontSize: "10px",
                color: "#c7d2fe",
            }}
        >
            {isWaiting
                ? "Starts with interview"
                : isActive
                    ? "Time remaining"
                    : "Interview completed"}
        </span>
    </div>
)}

{!isInterviewRoomRoute && isOwner && !isCompleted && (
    <button
        className="interview-mode-button"
        onClick={handleToggleInterviewMode}
    >
        {room.interviewMode
            ? "🎤 Interview: ON"
            : "🎤 Interview: OFF"}
    </button>
)}

                    {isOwner && isWaiting && (
                        <button
                            className="start-session-button"
                            onClick={handleStartSession}
                        >
                            ▶ Start Session
                        </button>
                    )}

                    {isOwner && isActive && (
                        <button
                            className="end-session-button"
                            onClick={handleEndSession}
                        >
                            ■ End Session
                        </button>
                    )}

                    {isOwner && isCompleted && (
                        <button
                            className="reopen-session-button"
                            onClick={handleReopenRoom}
                        >
                            ↻ Reopen Room
                        </button>
                    )}

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

            {isInterviewRoomRoute && room.interviewMode && (
    <section className="interview-timer-panel">
        <div className="interview-timer-info">
            <span className="interview-timer-label">
                🎤 INTERVIEW SESSION
            </span>

            <span className="interview-timer-status">
                {isWaiting
                    ? "Ready to start"
                    : isCompleted
                        ? "Interview completed"
                        : "Interview in progress"}
            </span>
        </div>

        <div className="interview-timer-value">
            {isActive && interviewRemainingSeconds !== null
                ? formatInterviewTime(interviewRemainingSeconds)
                : formatInterviewTime(
                    room.interviewDurationMinutes * 60
                )}
        </div>

        <span className="interview-timer-duration">
            Duration: {room.interviewDurationMinutes} minutes
        </span>
    </section>
)}

            {isCompleted && (
                <div className="room-completed-banner">
                    🔒 This coding session is completed. The editor, test cases and code execution are read-only. Chat remains available.
                </div>
            )}

            {fileConflict && !isCompleted && (
                <div
                    style={{
                        padding: "8px 14px",
                        background: "#3a2f12",
                        color: "#ffd166",
                        borderBottom: "1px solid #66521c",
                        fontSize: "13px",
                    }}
                >
                    ⚠️ {fileConflict}
                </div>
            )}

            {/* BODY */}

            <div className="room-body">

                {/* FILE SIDEBAR */}

                <aside className="file-sidebar">

                    <div className="panel-header">

                        <span>
                            EXPLORER
                        </span>

                        <div
                            style={{
                                position: "relative",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setUploadMenuOpen(
                                        (previous) =>
                                            !previous
                                    )
                                }
                                disabled={isCompleted}
                                title={
                                    isCompleted
                                        ? "Room is completed"
                                        : "Upload file or folder"
                                }
                            >
                                +
                            </button>

                            {uploadMenuOpen &&
                                !isCompleted && (
                                    <div
                                        style={{
                                            position:
                                                "absolute",
                                            top:
                                                "32px",
                                            right:
                                                "0",
                                            zIndex:
                                                1000,
                                            minWidth:
                                                "170px",
                                            padding:
                                                "6px",
                                            border:
                                                "1px solid #30343d",
                                            borderRadius:
                                                "8px",
                                            background:
                                                "#151821",
                                            boxShadow:
                                                "0 8px 24px rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={
                                                openFilePicker
                                            }
                                            style={{
                                                display:
                                                    "block",
                                                width:
                                                    "100%",
                                                padding:
                                                    "9px 10px",
                                                border:
                                                    "none",
                                                borderRadius:
                                                    "6px",
                                                background:
                                                    "transparent",
                                                color:
                                                    "#ffffff",
                                                textAlign:
                                                    "left",
                                                cursor:
                                                    "pointer",
                                            }}
                                        >
                                            📄 Upload File
                                        </button>

                                        <button
                                            type="button"
                                            onClick={
                                                openFolderPicker
                                            }
                                            style={{
                                                display:
                                                    "block",
                                                width:
                                                    "100%",
                                                padding:
                                                    "9px 10px",
                                                border:
                                                    "none",
                                                borderRadius:
                                                    "6px",
                                                background:
                                                    "transparent",
                                                color:
                                                    "#ffffff",
                                                textAlign:
                                                    "left",
                                                cursor:
                                                    "pointer",
                                            }}
                                        >
                                            📁 Upload Folder
                                        </button>
                                    </div>
                                )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            multiple
                            onChange={handleFileUpload}
                            disabled={isCompleted}
                            accept=".cpp,.cc,.cxx,.c,.h,.hpp,.py,.js,.jsx,.ts,.tsx,.java,.html,.css,.json,.txt,.md"
                        />

                        <input
                            ref={folderInputRef}
                            type="file"
                            hidden
                            multiple
                            {...({
                                webkitdirectory:
                                    "",
                                directory:
                                    "",
                            } as any)}
                            onChange={handleFolderUpload}
                            disabled={isCompleted}
                        />

                    </div>

                    {fileTree.length === 0 ? (
                        <div
                            style={{
                                padding: "12px",
                                color: "#6b7280",
                                fontSize: "13px",
                            }}
                        >
                            No files uploaded yet.
                        </div>
                    ) : (
                        renderFileTree(fileTree)
                    )}

                </aside>

                {/* EDITOR */}

                <main className="editor-area">

                    <div className="editor-tabs">

                        <div className="editor-tab active">

                            <span>
                                📄
                            </span>

                            {activeFileName}

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
                                readOnly: isCompleted,
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
                                            disabled={isCompleted}
                                        >
                                            + Add Test
                                        </button>

                                        <button
                                            className="run-tests-button"
                                            onClick={
                                                handleRunTests
                                            }
                                            disabled={
                                                isCompleted ||
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
        <span>PARTICIPANTS</span>

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
            participants.map((participant) => {
                const isCurrentUser =
                    participant.userId === user?.id;

                const isOnline =
                    participant.online === true;

                return (
                    <div
                        className={`participant ${
                            isOnline
                                ? "participant-online"
                                : "participant-offline"
                        }`}
                        key={participant.userId}
                    >
                        {/* Avatar */}
                        <div className="participant-avatar">
                            {participant.userName
                                ?.charAt(0)
                                .toUpperCase() || "U"}
                        </div>

                        {/* User information */}
                        <div className="participant-info">
                            <p className="participant-name">
                                {participant.userName ||
                                    "Unknown User"}

                                {isCurrentUser && (
                                    <span className="participant-you">
                                        You
                                    </span>
                                )}
                            </p>

                            <span
                                className={`participant-status ${
                                    isOnline
                                        ? "status-online"
                                        : "status-offline"
                                }`}
                            >
                                {isOnline
                                    ? "Online"
                                    : "Offline"}
                            </span>
                        </div>

                        {/* Online / Offline indicator */}
                        <div
                            className={`online-dot ${
                                isOnline
                                    ? "online"
                                    : "offline"
                            }`}
                            title={
                                isOnline
                                    ? "Online"
                                    : "Offline"
                            }
                        />
                    </div>
                );
            })
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

                        {Object.keys(typingUsers).length > 0 && (
                            <div className="chat-typing-indicator">
                                <span className="chat-typing-dots" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                                <span>
                                    {(() => {
                                        const names = Object.values(typingUsers);

                                        if (names.length === 1) {
                                            return `${names[0]} is typing...`;
                                        }

                                        if (names.length === 2) {
                                            return `${names[0]} and ${names[1]} are typing...`;
                                        }

                                        return `${names[0]} and ${names.length - 1} others are typing...`;
                                    })()}
                                </span>
                            </div>
                        )}

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
                                        handleChatInputChange(event.target.value)
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
