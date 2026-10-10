import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";

export interface DirectMessage {
  recipientId: string; // Target socket ID or User ID
  senderId?: string;
  content: string;
  timestamp?: string;
}

const app = next({ dev: process.env.NODE_ENV !== "production" });
const port = Number(process.env.PORT || "3000");
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  const userSocketMap = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("register_user", (userId: string) => {
      userSocketMap.set(userId, socket.id);
      console.log(`User ${userId} mapped to socket ${socket.id}`);
    });

    socket.on("private_message", (data: DirectMessage) => {
      const targetSocketId =
        userSocketMap.get(data.recipientId) || data.recipientId;

      if (targetSocketId) {
        io.to(targetSocketId).emit("private_message", {
          senderId: socket.id,
          content: data.content,
          timestamp: new Date().toISOString(),
        });
      } else {
        socket.emit("error_message", { msg: "Recipient not online" });
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, sId] of userSocketMap.entries()) {
        if (sId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
      console.log("Disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server.`);
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
