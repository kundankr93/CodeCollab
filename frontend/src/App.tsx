import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Rooms from "./pages/Rooms";
import CodingRoom from "./pages/CodingRoom";
import Projects from "./pages/Projects";

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* PUBLIC ROUTES */}

                    <Route
                        path="/login"
                        element={
                            <Login />
                        }
                    />

                    <Route
                        path="/register"
                        element={
                            <Register />
                        }
                    />

                    {/* PROTECTED ROUTES */}

                    <Route
                        element={
                            <ProtectedRoute />
                        }
                    >
                        <Route
                            path="/dashboard"
                            element={
                                <Dashboard />
                            }
                        />

                        <Route
                            path="/rooms"
                            element={
                                <Rooms />
                            }
                        />

                        <Route
                            path="/rooms/:roomId"
                            element={
                                <CodingRoom />
                            }
                        />

                        <Route
                            path="/projects"
                            element={
                                <Projects />
                            }
                        />
                    </Route>

                    {/* DEFAULT ROUTE */}

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