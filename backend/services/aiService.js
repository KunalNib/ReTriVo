import { ai } from "../config/cloudinary.js";

export async function generateAnswer(query, chunks) {
  const SYSTEM_PROMPT = `
  you are an AI assistant who helps resolving user query based on the content available to you from a pdf file with the content and page number.
  only ans based on the availabe context from the file only.give short and precise response like you are a human and don't just send any big text

  Context: 
  ${JSON.stringify(chunks)}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "user", parts: [{ text: query }] },
    ],
  });

  return response.text;
}
