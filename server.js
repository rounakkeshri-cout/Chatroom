const express = require("express");
const path = require("path");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

// --- Socket.IO ---
const io = require("socket.io")(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://your-frontend.vercel.app", // Replace with your actual frontend domain
      "https://join-chatroom.up.railway.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// --- In-memory user data ---
const users = new Map();
const connectedUsers = new Map();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Optional: serve static files if using a frontend in /public
app.use(express.static(path.join(__dirname, "public")));

// --- Health check ---
app.get("/", (req, res) => {
  res.json({
    status: "ChatRoom server is running",
    connectedUsers: connectedUsers.size,
    totalUsers: users.size,
    port: process.env.PORT || 5500,
    environment: process.env.NODE_ENV || "development"
  });
});

// --- Socket.IO Events ---
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("signup", ({ username, password }) => {
    if (users.has(username)) {
      socket.emit("auth-response", { success: false, message: "Username already exists" });
    } else {
      users.set(username, password);
      socket.emit("auth-response", { success: true, username, message: "Account created successfully!" });
    }
  });

  socket.on("signin", ({ username, password }) => {
    if (!users.has(username)) {
      socket.emit("auth-response", { success: false, message: "Username not found" });
    } else if (users.get(username) === password) {
      socket.emit("auth-response", { success: true, username, message: "Welcome back!" });
    } else {
      socket.emit("auth-response", { success: false, message: "Incorrect password" });
    }
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
    console.log(`Disconnected: ${socket.id}`);
  });
});

// --- Server start ---
const PORT = process.env.PORT || 5500;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
