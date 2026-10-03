# CodeCollab 💻

**CodeCollab** is a real-time collaborative coding platform where users can work together in coding rooms, edit files, communicate, and run code.

The project is built using React, TypeScript, Node.js, Express, MongoDB, and Socket.IO.

## ✨ Features

* **User Authentication** — Register, log in, and access protected features.
* **Collaborative Coding Rooms** — Create and join coding rooms.
* **Real-Time Code Synchronization** — Collaborate on code with other participants.
* **Multi-File Support** — Create, select, and work with multiple files in a room.
* **Monaco Code Editor** — Write and edit code in an editor powered by Monaco.
* **Real-Time Chat** — Communicate with other participants in a room.
* **Code Execution** — Run code with supported languages: C++, Python, and JavaScript.
* **Test Cases** — Work with test cases in coding rooms.
* **Room Management** — Manage room lifecycle and participant access.
* **Project Management** — Create and manage coding projects.
* **Owner Dashboard** — Manage rooms and projects through owner features.

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* React Router
* Axios
* Socket.IO Client
* Monaco Editor

### Backend

* Node.js
* Express.js
* TypeScript
* Socket.IO
* MongoDB
* Mongoose
* JWT Authentication
* Multer

## 📁 Project Structure

```text
CodeCollab/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── server.ts
│   │   └── socket.ts
│   └── package.json
│
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

Make sure you have installed:

* Node.js
* npm
* MongoDB Atlas account or a MongoDB instance
* Git

### 1. Clone the Repository

```bash
git clone https://github.com/kundankr93/CodeCollab.git
cd CodeCollab
```

Replace `https://github.com/kundankr93` with your GitHub username.

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_ACCESS_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
```

Add your actual MongoDB connection string and strong, private JWT secrets. **Never commit your `.env` file to GitHub.**

Start the backend development server:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Vite will display the local URL in the terminal, usually:

```text
http://localhost:5173
```

> **Note:** The current frontend API configuration uses `http://localhost:5000/api`. If you deploy the application, update the frontend API URL and configure the backend's allowed CORS origins for your deployed frontend.

## 🧪 Build Commands

### Frontend

```bash
cd frontend
npm run build
```

### Backend

```bash
cd backend
npm run build
```

## 🔐 Environment Variables

| Variable             | Description                        |
| -------------------- | ---------------------------------- |
| `PORT`               | Backend server port                |
| `MONGODB_URI`        | MongoDB connection string          |
| `JWT_ACCESS_SECRET`  | Secret used to sign access tokens  |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens |

## 🚀 Future Improvements

* Improve deployment configuration.
* Add more collaborative coding features.
* Enhance the user experience and room management.
* Extend support for additional programming languages.

## 👨‍💻 Author

**Kundan Kumar**

B.Tech — Information Technology

[NIT Raipur](https://www.nitrr.ac.in/)

---

⭐ If you find this project interesting, feel free to explore the repository and share your feedback.
