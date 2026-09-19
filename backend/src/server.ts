import dns from "dns";
import express from "express";
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

dns.setServers([
    "8.8.8.8",
    "8.8.4.4",
]);

const app = express();

const httpServer =
    http.createServer(app);

const io = new Server(
    httpServer,
    {
        cors: {
            origin:
                "http://localhost:5173",

            methods: [
                "GET",
                "POST",
                "PUT",
                "DELETE",
            ],
        },
    }
);

const PORT =
    process.env.PORT || 5000;

// CORS
app.use(
    cors({
        origin:
            "http://localhost:5173",
    })
);

// JSON
app.use(
    express.json()
);

app.use(
    "/api/execute",
    codeExecutionRoutes
);
app.use(
    "/api/test-cases",
    testCaseRoutes
);

// HEALTH CHECK
app.get(
    "/api/health",
    (req, res) => {
        res.json({
            success: true,
            message:
                "CodeCollab Backend is running 🚀",
        });
    }
);

// AUTH ROUTES
app.use(
    "/api/auth",
    authRoutes
);

// USER ROUTES
app.use(
    "/api/users",
    userRoutes
);

// ROOM ROUTES
app.use(
    "/api/rooms",
    roomRoutes
);

// PROJECT ROUTES
app.use(
    "/api/projects",
    projectRoutes
);

// SOCKET.IO
initializeSocket(io);

// START SERVER
const startServer =
    async (): Promise<void> => {
        await connectDB();

        httpServer.listen(
            PORT,
            () => {
                console.log(
                    `Server running on http://localhost:${PORT}`
                );

                console.log(
                    "Socket.IO server ready 🔥"
                );
            }
        );
    };

startServer();