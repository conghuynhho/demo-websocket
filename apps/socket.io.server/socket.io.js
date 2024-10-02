import { Server } from "socket.io";
import http from "http";
import express from "express";
const app = express();
const server = http.createServer(app);



const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for CORS
    methods: ["GET", "POST"], // Allow specific methods
  },
});

io.on("connection", (socket) => {
  console.log("New connection");

  socket.on("message", (message) => {
    console.log("Received message:", message);
    const messageString = message.toString(); // Convert to string if necessary

    if (messageString.includes("ping")) {
      socket.emit("message", JSON.stringify({ action: "pong" }));
    }

    if (messageString.includes("send-msg")) {
      const {
        data: { message: msg },
      } = JSON.parse(messageString);
      io.emit("message", JSON.stringify({ action: "receive-msg", data: { message: msg } }));
    }

    if (messageString.includes("chat-send")) {
      const {
        data: { message: msg },
      } = JSON.parse(messageString);

      // Notify the sender of success
      socket.emit("message", JSON.stringify({ action: "chat/sendSuccess", data: { message: msg } }));

      // Broadcast the message to other clients
      socket.broadcast.emit("message", JSON.stringify({ action: "chat/receive", data: { message: msg } }));
    } else {
      // Handle failure case (you can define your own logic here)
      // socket.emit("message", JSON.stringify({ action: "chat/sendFailed", data: { message: "Failed to send message" } }));
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
