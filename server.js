const express = require("express");
const path = require("path");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

// --- Socket.IO Setup ---
const io = require("socket.io")(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000", // Dynamic CORS origin
      "https://join-chatroom.up.railway.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// --- In-memory Data ---
const users = new Map();
const connectedUsers = new Map();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Optional: Serve frontend if bundled in /public ---
app.use(express.static(path.join(__dirname, "public")));

// --- Health Check ---
app.get("/", (req, res) => {
  res.json({
    status: "✅ ChatRoom server is running",
    connectedUsers: connectedUsers.size,
    totalUsers: users.size,
    port: process.env.PORT || 5500,
    environment: process.env.NODE_ENV || "development"
  });
});

// --- Socket.IO Events ---
io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  socket.on("signup", ({ username, password }) => {
    if (users.has(username)) {
      return socket.emit("auth-response", {
        success: false,
        message: "Username already exists"
      });
    }
    users.set(username, password);
    socket.emit("auth-response", {
      success: true,
      username,
      message: "Account created successfully!"
    });
  });

  socket.on("signin", ({ username, password }) => {
    const storedPassword = users.get(username);
    if (!storedPassword) {
      return socket.emit("auth-response", {
        success: false,
        message: "Username not found"
      });
    }
    if (storedPassword !== password) {
      return socket.emit("auth-response", {
        success: false,
        message: "Incorrect password"
      });
    }
    socket.emit("auth-response", {
      success: true,
      username,
      message: "Welcome back!"
    });
  });

  socket.on("newuser", (username) => {
    connectedUsers.set(socket.id, username);
    socket.broadcast.emit("update", `${username} joined the chatroom`);
    io.emit("userCount", connectedUsers.size);
  });

  socket.on("exituser", (username) => {
    connectedUsers.delete(socket.id);
    socket.broadcast.emit("update", `${username} left the chatroom`);
    io.emit("userCount", connectedUsers.size);
  });

  socket.on("chat", (message) => {
    socket.broadcast.emit("chat", message);
  });

  socket.on("disconnect", () => {
    const username = connectedUsers.get(socket.id);
    if (username) {
      connectedUsers.delete(socket.id);
      socket.broadcast.emit("update", `${username} left the chatroom`);
      io.emit("userCount", connectedUsers.size);
    }
    console.log("❌ Disconnected:", socket.id);
  });
});

// --- Server Start ---
const PORT = process.env.PORT || 5500;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Chatroom server running on port ${PORT}`);
});
