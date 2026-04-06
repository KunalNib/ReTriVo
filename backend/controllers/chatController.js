import db from "../db.js";
import { retrieveChunks } from "../services/vectorService.js";
import { generateAnswer } from "../services/aiService.js";
import { v4 as uuidv4 } from "uuid";

export async function chat(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userQuery = req.body.question;
    let chatId = req.body.chatId;

    if (!chatId) {
      chatId = uuidv4();
      const title = userQuery.substring(0, 50) || "New Chat";
      await db.execute({
        sql: "INSERT INTO chats (id, userId, title) VALUES (?, ?, ?)",
        args: [chatId, userId, title],
      });
    }

    await db.execute({
      sql: "INSERT INTO messages (id, chatId, role, content) VALUES (?, ?, ?, ?)",
      args: [uuidv4(), chatId, "user", userQuery],
    });

    const chunks = await retrieveChunks(userQuery, userId);
    const aiAnswer = await generateAnswer(userQuery, chunks);

    await db.execute({
      sql: "INSERT INTO messages (id, chatId, role, content) VALUES (?, ?, ?, ?)",
      args: [uuidv4(), chatId, "assistant", aiAnswer],
    });

    res.json({ answer: aiAnswer, chatId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function getChats(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute({
      sql: "SELECT * FROM chats WHERE userId = ? ORDER BY createdAt DESC",
      args: [userId],
    });
    res.json({ chats: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getChatById(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const chatResult = await db.execute({
      sql: "SELECT * FROM chats WHERE id = ? AND userId = ?",
      args: [req.params.id, userId],
    });
    const chat = chatResult.rows[0];
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const messagesResult = await db.execute({
      sql: "SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC",
      args: [req.params.id],
    });
    res.json({ chat, messages: messagesResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
