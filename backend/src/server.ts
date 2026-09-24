import dns from "dns";
import express, {
    Request,
    Response,
    NextFunction,
} from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import roomRoutes from "./routes/room.routes.js";
import projectRoutes from "./routes/project.routes.js";
import codeExecutionRoutes from "./routes/codeExecution.routes.js";
import testCaseRoutes from "./routes/testCase.routes.js";

import { initializeSocket } from "./socket.js";

dotenv.config();

/*
 * ==========================================
 * DNS
 * ==========================================
 */

dns.setServers([
    "8.8.8.8",
    "8.8.4.4",
]);

/*
 * ==========================================
 * EXPRESS APP
 * ==========================================
 */

const app = express();

const httpServer =
    http.createServer(app);

/*
 * ==========================================
 * ALLOWED FRONTEND ORIGINS
 * ==========================================
 */

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
];

/*
 * ==========================================
 * SOCKET.IO
 * ==========================================
 */

const io = new Server(
    httpServer,
    {
        cors: {
            origin: allowedOrigins,

            methods: [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS",
            ],
        },
    }
);

/*
 * ==========================================
 * PORT
 * ==========================================
 */

const PORT =
    Number(process.env.PORT) || 5000;

/*
 * ==========================================
 * CORS
 * ==========================================
 */

app.use(
    cors({
        origin: (
            origin,
            callback
        ) => {
            /*
             * Requests without an Origin header
             * can still be accepted.
             *
             * Example:
             * curl / Postman requests.
             */

            if (!origin) {
                callback(null, true);
                return;
            }

            if (
                allowedOrigins.includes(
                    origin
                )
            ) {
                callback(null, true);
                return;
            }

            console.warn(
                `CORS blocked origin: ${origin}`
            );

            callback(
                new Error(
                    "Not allowed by CORS"
                )
            );
        },

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],

        credentials: true,
    })
);

/*
 * ==========================================
 * JSON BODY PARSER
 * ==========================================
 */

app.use(
    express.json()
);

/*
 * ==========================================
 * HEALTH CHECK
 * ==========================================
 */

app.get(
    "/api/health",
    (
        _req: Request,
        res: Response
    ) => {
        res.status(200).json({
            success: true,
            message:
                "CodeCollab Backend is running 🚀",
        });
    }
);

/*
 * ==========================================
 * AUTH ROUTES
 * ==========================================
 */

app.use(
    "/api/auth",
    authRoutes
);

/*
 * ==========================================
 * USER ROUTES
 * ==========================================
 */

app.use(
    "/api/users",
    userRoutes
);

/*
 * ==========================================
 * ROOM ROUTES
 * ==========================================
 */

app.use(
    "/api/rooms",
    roomRoutes
);

/*
 * ==========================================
 * PROJECT ROUTES
 * ==========================================
 */

app.use(
    "/api/projects",
    projectRoutes
);

/*
 * ==========================================
 * CODE EXECUTION ROUTES
 * ==========================================
 */

app.use(
    "/api/execute",
    codeExecutionRoutes
);

/*
 * ==========================================
 * TEST CASE ROUTES
 * ==========================================
 */

app.use(
    "/api/test-cases",
    testCaseRoutes
);

/*
 * ==========================================
 * SOCKET.IO
 * ==========================================
 */

initializeSocket(io);

/*
 * ==========================================
 * 404 HANDLER
 * ==========================================
 */

app.use(
    (
        req: Request,
        res: Response
    ) => {
        res.status(404).json({
            success: false,
            message:
                `Route not found: ${req.method} ${req.originalUrl}`,
        });
    }
);

/*
 * ==========================================
 * ERROR HANDLER
 * ==========================================
 */

app.use(
    (
        error: Error,
        _req: Request,
        res: Response,
        _next: NextFunction
    ) => {
        console.error(
            "Express error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error",
        });
    }
);

/*
 * ==========================================
 * START SERVER
 * ==========================================
 */

const startServer =
    async (): Promise<void> => {
        try {
            await connectDB();

            /*
             * We intentionally don't pass
             * "0.0.0.0" here.
             *
             * This avoids the TypeScript
             * overload issue and is sufficient
             * for our local development setup.
             */

            httpServer.listen(
                PORT,
                () => {
                    console.log(
                        `Server running on http://localhost:${PORT}`
                    );

                    console.log(
                        "Socket.IO server ready 🔥"
                    );

                    console.log(
                        "Allowed frontend origins:",
                        allowedOrigins
                    );
                }
            );
        } catch (error) {
            console.error(
                "Failed to start server ❌",
                error
            );

            process.exit(1);
        }
    };

startServer();