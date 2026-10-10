"use client";
import { DirectMessage } from "@/server";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const fakeSession = {
  userId: "efg",
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
    socket.emit("private_message", {
      recipientId: "abc",
      content: msg,
      senderId: fakeSession.userId,
      timestamp: new Date().toDateString(),
    } as DirectMessage);
  };

  return (
    <div>
      <div>
        <h1>Logs:</h1>
        {logs.map((log) => (
          <li>{log}</li>
        ))}
      </div>

      <input type="text" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button onClick={sendMsg}>Send</button>
    </div>
  );
};

export default page;
