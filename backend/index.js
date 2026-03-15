import "dotenv/config";
import express from "express";
const app = express();
import cors from "cors";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import { GoogleGenAI } from "@google/genai";
import multer from "multer";

import db, { initDb } from "./db.js";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import os from "os";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const upload = multer({
  dest: "uploads",
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);

app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file && !req.body.text) {
      return res.json({ error: "file not found" });
    }
    const docs = [];
    if (req.file) {
      let cloudUrl = null;
      try {
        console.log("Uploading to Cloudinary...", req.file.originalname);
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "rag-chatbot-docs",
          resource_type: "raw",
          public_id: req.file.originalname.replace(/\.[^/.]+$/, "")
        });
        cloudUrl = uploadResult.secure_url;
        console.log("Cloud URL:", cloudUrl);

        const loader = new PDFLoader(req.file.path);
        const pdfdocs = await loader.load();
        docs.push(...pdfdocs);
      } catch (err) {
        console.error("Upload/Processing Error:", err);
        return res.status(500).json({ error: "Failed to process file." });
      } finally {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
      
      const docId = uuidv4();
      await db.execute({
        sql: "INSERT INTO documents (id, userId, filename, url) VALUES (?, ?, ?, ?)",
        args: [docId, userId, req.file.originalname, cloudUrl]
      });
    }
    if (req.body.text) {
      docs.push({
        pageContent: req.body.text,
        metadata: { source: "manual-text" },
      });
      
      const docId = uuidv4();
      await db.execute({
        sql: "INSERT INTO documents (id, userId, filename, url) VALUES (?, ?, ?, ?)",
        args: [docId, userId, "Manual Text Input", null]
      });
    }

    docs.forEach(doc => {
      doc.metadata = doc.metadata || {};
      doc.metadata.userId = userId;
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
    });

    const vectorStore = await QdrantVectorStore.fromDocuments(
      docs,
      embeddings,
      {
        url:process.env.QDRANT_URL,
        apiKey:process.env.QDRANT_API_KEY,
        collectionName: "user-collection",
      }
    );
    console.log("indexing of documents for user:", userId);
    res.status(200).json({ success: true, message: "pdf loaded successfully" });
  } catch (err) {
    console.error("Route error:", err);
    res.status(500).json({ error: err.message || "something went wrong" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userQuery = req.body.question;
    let chatId = req.body.chatId;

    if (!chatId) {
      chatId = uuidv4();
      const title = userQuery.substring(0, 50) || "New Chat";
      await db.execute({
        sql: "INSERT INTO chats (id, userId, title) VALUES (?, ?, ?)",
        args: [chatId, userId, title]
      });
    }

    await db.execute({
      sql: "INSERT INTO messages (id, chatId, role, content) VALUES (?, ?, ?, ?)",
      args: [uuidv4(), chatId, "user", userQuery]
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url:process.env.QDRANT_URL,
        apiKey:process.env.QDRANT_API_KEY,
        collectionName: "user-collection",
      }
    );
    const vectorSearcher = await vectorStore.asRetriever({
      k: 3,
      filter: {
        must: [
          {
            key: "metadata.userId",
            match: { value: userId }
          }
        ]
      }
    });

    const relevantChunks = await vectorSearcher.invoke(userQuery);

    const SYSTEM_PROMPT = `
    you are an AI assistant who helps resolving user query based on the content available to you from a pdf file with the content and page number.
    only ans based on the availabe context from the file only.give short and precise response like you are a human and don't just send any big text

    Context: 
    ${JSON.stringify(relevantChunks)}
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              text: userQuery,
            },
          ],
        },
      ],
    });

    const aiAnswer = response.text;
    await db.execute({
      sql: "INSERT INTO messages (id, chatId, role, content) VALUES (?, ?, ?, ?)",
      args: [uuidv4(), chatId, "assistant", aiAnswer]
    });

    res.json({ answer: aiAnswer, chatId });
  } catch(err) {
    console.log(err);
    res.json({ error: err });
  }
});

app.get("/api/chats", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute({
      sql: "SELECT * FROM chats WHERE userId = ? ORDER BY createdAt DESC",
      args: [userId]
    });
    res.json({ chats: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chats/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const chatResult = await db.execute({
      sql: "SELECT * FROM chats WHERE id = ? AND userId = ?",
      args: [req.params.id, userId]
    });
    const chat = chatResult.rows[0];
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    
    const messagesResult = await db.execute({
      sql: "SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC",
      args: [req.params.id]
    });
    res.json({ chat, messages: messagesResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/documents", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute({
      sql: "SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC",
      args: [userId]
    });
    res.json({ documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = 3000;
initDb().then(() => {
  app.listen(port, () => {
    console.log(`app is listening on port ${port}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
});
