import { ai } from "../config/cloudinary.js";

export async function rewriteQuery(query, history = []) {
  if (!history || history.length === 0) return query;

  const REWRITE_PROMPT = `
  Given the following conversation history and a follow-up user query, rephrase the follow-up query into a standalone query that can be understood without the conversation history.
  Do not answer the query, just rewrite it.
  
  History:
  ${history.map(m => `${m.role}: ${m.content}`).join("\n")}
  
  Follow-up Query: ${query}
  
  Standalone Query:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: REWRITE_PROMPT }] }],
  });

  return response.text.trim();
}

export async function generateAnswer(query, chunks, history = [], graphFacts = "") {
  const SYSTEM_PROMPT = `
  You are an AI assistant who helps resolve user queries based strictly on the provided Context from their knowledge base (documents, YouTube videos, and text).
  Only answer based on the available context. Give short, precise, and human-like responses.

  Vector Context: 
  ${JSON.stringify(chunks)}

  Graph Context:
  ${graphFacts}
  `;

  const contents = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Understood. I will use the provided context to answer." }] }
  ];

  for (const msg of history) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    });
  }

  contents.push({ role: "user", parts: [{ text: query }] });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
  });

  return response.text;
}
