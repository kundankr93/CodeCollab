
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Rooms from "./pages/Rooms";
import CodingRoom from "./pages/CodingRoom";
import Projects from "./pages/Projects";
import OwnerDashboard from "./pages/OwnerDashboard";
import OwnerRoomDetails from "./pages/OwnerRoomDetails";
import Settings from "./pages/Settings";

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/register"
                        element={<Register />}
                    />

                    <Route
                        path="/forgot-password"
                        element={<ForgotPassword />}
                    />

                    <Route
                        path="/reset-password"
                        element={<ResetPassword />}
                    />

                    <Route element={<ProtectedRoute />}>
                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                        <Route
                            path="/rooms"
                            element={<Rooms />}
                        />

                        {/* Coding Room */}
                        <Route
                            path="/rooms/:roomId"
                            element={<CodingRoom />}
                        />

                        {/* Interview Room */}
                        <Route
                            path="/interview-rooms/:roomId"
                            element={<CodingRoom />}
                        />

                        <Route
                            path="/projects"
                            element={<Projects />}
                        />

                        <Route
                            path="/settings"
                            element={<Settings />}
                        />

                        <Route
                            element={
                                <ProtectedRoute
                                    allowedRoles={["owner"]}
                                />
                            }
                        >
                            <Route
                                path="/owner"
                                element={<OwnerDashboard />}
                            />

                            <Route
                                path="/owner/rooms/:roomId"
                                element={<OwnerRoomDetails />}
                            />
                        </Route>
                    </Route>

                    <Route
                        path="*"
                        element={
                            <Navigate
                                to="/dashboard"
                                replace
                            />
                        }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;