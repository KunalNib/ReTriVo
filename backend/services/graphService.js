import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import "dotenv/config";

// LangChain LLM instance for graph operations
export const graphLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
});

let graphInstance = null;

export async function getGraphStore() {
  if (graphInstance) return graphInstance;
  
  if (!process.env.NEO4J_URI) {
    console.warn("NEO4J_URI not set. Graph operations will be skipped.");
    return null;
  }
  
  try {
    graphInstance = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USERNAME,
      password: process.env.NEO4J_PASSWORD,
      database: process.env.NEO4J_DATABASE || "neo4j",
    });
    return graphInstance;
  } catch (err) {
    console.error("Failed to initialize Neo4j Graph:", err);
    return null;
  }
}
