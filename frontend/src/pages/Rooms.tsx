import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import "../styles/rooms.css";


interface Room {
    _id: string;
    roomId: string;
    name: string;
    language: string;
    status: "waiting" | "active" | "completed";
    createdAt: string;
}


const Rooms = () => {

    const navigate = useNavigate();

    const [rooms, setRooms] = useState<Room[]>([]);

    const [name, setName] = useState("");

    const [language, setLanguage] = useState("cpp");

    const [loading, setLoading] = useState(false);

    const [fetching, setFetching] = useState(true);

    const [error, setError] = useState("");


    const fetchRooms = async () => {

        try {

            setFetching(true);

            const response = await api.get("/rooms");

            setRooms(response.data.rooms);

        } catch (error: any) {

            setError(
                error.response?.data?.message ||
                "Failed to load rooms"
            );

        } finally {

            setFetching(false);

        }
    };


    useEffect(() => {

        fetchRooms();

    }, []);


    const handleCreateRoom = async () => {

        if (!name.trim()) {

            setError("Room name is required");

            return;
        }


        try {

            setLoading(true);

            setError("");


            const response = await api.post(
                "/rooms",
                {
                    name,
                    language,
                }
            );


            const room = response.data.room;


            setName("");

            await fetchRooms();


            navigate(`/rooms/${room.roomId}`);

        } catch (error: any) {

            setError(
                error.response?.data?.message ||
                "Failed to create room"
            );

        } finally {

            setLoading(false);

        }
    };


    const handleJoinRoom = async (
        roomId: string
    ) => {

        try {

            setError("");

            await api.post(
                `/rooms/${roomId}/join`
            );

            navigate(`/rooms/${roomId}`);

        } catch (error: any) {

            setError(
                error.response?.data?.message ||
                "Failed to join room"
            );

        }
    };


    return (
        <div className="rooms-page">

            <header className="rooms-header">

                <button
                    className="back-button"
                    onClick={() => navigate("/dashboard")}
                >
                    ← Dashboard
                </button>


                <div>

                    <h1>
                        Coding Rooms 💻
                    </h1>

                    <p>
                        Create or join a collaborative coding session
                    </p>

                </div>

            </header>


            <main className="rooms-content">

                {/* CREATE ROOM */}

                <section className="create-room-card">

                    <div className="card-title">

                        <div className="card-icon">
                            +
                        </div>

                        <div>

                            <h2>
                                Create New Room
                            </h2>

                            <p>
                                Start a collaborative coding session
                            </p>

                        </div>

                    </div>


                    <div className="room-form">

                        <div className="form-group">

                            <label>
                                Room Name
                            </label>

                            <input
                                type="text"
                                placeholder="e.g. DSA Interview Practice"
                                value={name}
                                onChange={(e) =>
                                    setName(e.target.value)
                                }
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Programming Language
                            </label>

                            <select
                                value={language}
                                onChange={(e) =>
                                    setLanguage(e.target.value)
                                }
                            >

                                <option value="cpp">
                                    C++
                                </option>

                                <option value="javascript">
                                    JavaScript
                                </option>

                                <option value="python">
                                    Python
                                </option>

                                <option value="java">
                                    Java
                                </option>

                            </select>

                        </div>


                        <button
                            className="create-button"
                            onClick={handleCreateRoom}
                            disabled={loading}
                        >

                            {loading
                                ? "Creating..."
                                : "Create Room →"}

                        </button>

                    </div>


                    {error && (
                        <p className="room-error">
                            {error}
                        </p>
                    )}

                </section>


                {/* MY ROOMS */}

                <section className="my-rooms-section">

                    <div className="rooms-section-title">

                        <div>

                            <h2>
                                My Coding Rooms
                            </h2>

                            <p>
                                Your recent collaborative sessions
                            </p>

                        </div>

                    </div>


                    {fetching ? (

                        <div className="rooms-empty">
                            Loading rooms...
                        </div>

                    ) : rooms.length === 0 ? (

                        <div className="rooms-empty">

                            <div className="rooms-empty-icon">
                                💻
                            </div>

                            <h3>
                                No rooms yet
                            </h3>

                            <p>
                                Create your first coding room above.
                            </p>

                        </div>

                    ) : (

                        <div className="rooms-grid">

                            {rooms.map((room) => (

                                <div
                                    className="room-card"
                                    key={room._id}
                                >

                                    <div className="room-card-top">

                                        <div className="room-language">
                                            {room.language === "cpp"
                                                ? "C++"
                                                : room.language}
                                        </div>

                                        <span
                                            className={`room-status ${room.status}`}
                                        >
                                            {room.status}
                                        </span>

                                    </div>


                                    <h3>
                                        {room.name}
                                    </h3>


                                    <p className="room-id">
                                        Room ID: {room.roomId}
                                    </p>


                                    <button
                                        className="join-button"
                                        onClick={() =>
                                            handleJoinRoom(
                                                room.roomId
                                            )
                                        }
                                    >
                                        Open Room →
                                    </button>

                                </div>

                            ))}

                        </div>

                    )}

                </section>

            </main>

        </div>
    );
};


export default Rooms;