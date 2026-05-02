import "dotenv/config";
import express from "express";
import cors from "cors";

import { initDb } from "./db.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import chatHistoryRoutes from "./routes/chatHistoryRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));

app.use("/api/upload", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chats", chatHistoryRoutes);
app.use("/api/documents", documentRoutes);


const port = 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`app is listening on port ${port}`));
}).catch(err => {
  console.error("Failed to initialize database:", err);
});
