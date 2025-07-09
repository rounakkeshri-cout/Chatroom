const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
   cors: {
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500", 
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://join-chatroom.up.railway.app"  // Add your Railway URL here
  ],
  methods: ["GET", "POST"],
  credentials: true
},
    allowEIO3: true
});

// Simple in-memory user storage (username -> password)
let users = new Map();
let connectedUsers = new Map();

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Add CORS headers for Express routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    console.log("Root route accessed");
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on("connection", function (socket) {
    console.log("A user connected with ID:", socket.id);

    // Handle sign up
    socket.on("signup", function (data) {
        const { username, password } = data;
        
        console.log("Sign up attempt:", username);
        
        // Check if username already exists
        if (users.has(username)) {
            socket.emit("auth-response", {
                success: false,
                message: "Username already exists"
            });
            return;
        }

        // Store user credentials
        users.set(username, password);
        console.log("New user registered:", username);
        
        socket.emit("auth-response", {
            success: true,
            username: username,
            message: "Account created successfully!"
        });
    });

    // Handle sign in
    socket.on("signin", function (data) {
        const { username, password } = data;
        
        console.log("Sign in attempt:", username);
        
        // Check if username exists
        if (!users.has(username)) {
            socket.emit("auth-response", {
                success: false,
                message: "Username not found"
            });
            return;
        }

        // Check password
        const storedPassword = users.get(username);
        if (storedPassword === password) {
            console.log("User signed in:", username);
            
            socket.emit("auth-response", {
                success: true,
                username: username,
                message: "Welcome back!"
            });
        } else {
            socket.emit("auth-response", {
                success: false,
                message: "Incorrect password"
            });
        }
    });

    socket.on("newuser", function (username) {
        console.log(username + " joined the chatroom");
        
        connectedUsers.set(socket.id, username);
        socket.broadcast.emit("update", username + " joined the chatroom");
        io.emit("userCount", connectedUsers.size);
        
        console.log("Current users:", Array.from(connectedUsers.values()));
    });

    socket.on("exituser", function (username) {
        console.log(username + " left the chatroom");
        
        connectedUsers.delete(socket.id);
        socket.broadcast.emit("update", username + " left the chatroom");
        io.emit("userCount", connectedUsers.size);
    });

    socket.on("chat", function (message) {
        console.log("Message from", message.username + ":", message.text);
        
        // Log reply information if present
        if (message.replyTo) {
            console.log("  └─ Replying to", message.replyTo.username + ":", message.replyTo.text);
        }
        
        // Broadcast message to all other users (not the sender)
        socket.broadcast.emit("chat", message);
    });

    socket.on("disconnect", function() {
        console.log("User disconnected:", socket.id);
        
        const username = connectedUsers.get(socket.id);
        
        if (username) {
            connectedUsers.delete(socket.id);
            socket.broadcast.emit("update", username + " left the chatroom");
            io.emit("userCount", connectedUsers.size);
            console.log(username + " disconnected");
        }
        
        console.log("Current users:", Array.from(connectedUsers.values()));
    });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
    console.log(`Chatroom server is running on http://localhost:${PORT}`);
    console.log("Simple username/password authentication enabled");
    console.log("Make sure your HTML, CSS, and JS files are in the 'public' folder");
});