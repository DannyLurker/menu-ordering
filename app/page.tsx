"use client";
import { DirectMessage } from "@/server";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const fakeSession = {
  userId: "abc",
};

let socket: Socket;

const page = () => {
  const [msg, setMsg] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    socket = io();

    socket.on("connect", () => {
      socket.emit("register_user", fakeSession.userId);
    });

    socket.on("private_message", (data: DirectMessage) => {
      setLogs((prev) => [...prev, data.content]);
    });
  }, []);

  const sendMsg = () => {
    const now = new Date().toString();

    socket.emit("private_message", {
      recipientId: "efg",
      content: msg,
      senderId: fakeSession.userId,
      timestamp: now,
    } as DirectMessage);
  };

  return (
    <div>
      <div>
        <h1>Logs:</h1>
        {logs.map((log, idx) => (
          <li key={idx}>{log}</li>
        ))}
      </div>

      <input type="text" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button onClick={sendMsg}>Send</button>
    </div>
  );
};

export default page;
