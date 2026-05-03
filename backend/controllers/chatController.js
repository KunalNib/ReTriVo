import db from "../db.js";
import { retrieveChunks } from "../services/vectorService.js";
import { generateAnswer, rewriteQuery } from "../services/aiService.js";
import { v4 as uuidv4 } from "uuid";
import { getGraphStore, graphLlm } from "../services/graphService.js";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
import { PromptTemplate } from "@langchain/core/prompts";

export async function chat(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userQuery = req.body.question;
    let chatId = req.body.chatId;

    let history = [];
    if (!chatId) {
      chatId = uuidv4();
      const title = userQuery.substring(0, 50) || "New Chat";
      await db.execute({
        sql: "INSERT INTO chats (id, userId, title) VALUES (?, ?, ?)",
        args: [chatId, userId, title],
      });
    } else {
      const historyResult = await db.execute({
        sql: "SELECT role, content FROM messages WHERE chatId = ? ORDER BY createdAt DESC LIMIT 10",
        args: [chatId],
      });
      // Reverse to get chronological order
      history = historyResult.rows.reverse();
    }

    await db.execute({
      sql: "INSERT INTO messages (id, chatId, role, content) VALUES (?, ?, ?, ?)",
      args: [uuidv4(), chatId, "user", userQuery],
    });

    const standaloneQuery = await rewriteQuery(userQuery, history);
    console.log("Original Query:", userQuery, "| Standalone:", standaloneQuery);

    const chunks = await retrieveChunks(standaloneQuery, userId);
    
    let graphFacts = "";
    const graph = await getGraphStore();
    if (graph) {
      try {
        const cypherPrompt = PromptTemplate.fromTemplate(`Task: Generate Cypher statement to query a graph database.
Instructions:
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.
If you cannot generate a Cypher query based on the provided schema for the given question, you MUST output exactly: MATCH (n:__NOT_FOUND__) RETURN n LIMIT 0
Schema:
{schema}
Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.

Question: {question}`);

        const graphChain = GraphCypherQAChain.fromLLM({
          llm: graphLlm,
          graph: graph,
          cypherPrompt
        });
        const graphRes = await graphChain.invoke({ query: standaloneQuery });
        graphFacts = graphRes.result;
      } catch (err) {
        console.error("Graph query failed:", err.message);
      }
    }

    const aiAnswer = await generateAnswer(userQuery, chunks, history, graphFacts);

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
