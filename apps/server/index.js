import WebSocket from "ws";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3000 });

const clients = new Map();

wss.on("connection", (ws, req) => {
  console.log("New connection");


  // get userId from url websocket
  console.log("url: ", req.url);
  const userId = req.url.split("=")[1];

  if (userId) {
    clients.set(userId, ws);
  }

  ws.on("message", (message) => {
    console.log("Received message:", message);
    // why message receive is Received message: <Buffer 7b 22 61 63 74 69 6f 6e 22 3a 22 70 69 6e 67 22 7d>
    // because message is a buffer, we need to convert it to a string
    const messageString = message.toString();
    console.log("Received message:", messageString);

    if (messageString.includes("ping")) {
      ws.send(JSON.stringify({ action: "pong" }));
    }

    if (messageString.includes("send-msg")) {
      const {
        data: { message: msg },
      } = JSON.parse(messageString);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ action: "receive-msg", data: { message: msg } })
          );
        }
      });
    }

    if (messageString.includes("chat-send")) {
      const {
        data: { message: msg },
      } = JSON.parse(messageString);

      // Notify the sender of success
      ws.send(JSON.stringify({ action: "chat/sendSuccess", data: { message: msg } }));

      // Broadcast the message to other clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(
            JSON.stringify({ action: "chat/receive", data: { message: msg } })
          );
        }
      });
    } else {
      // Handle failure case (you can define your own logic here)
      // ws.send(JSON.stringify({ action: "chat/sendFailed", data: { message: "Failed to send message" } }));
    }
  });
});
