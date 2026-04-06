import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const getEmbeddings = () =>
  new GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-001" });

const qdrantConfig = {
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  collectionName: "user-collection",
};

export async function indexDocuments(docs) {
  const embeddings = getEmbeddings();

  const CHUNK_SIZE = 1500;
  const CHUNK_OVERLAP = 200;
  
  const chunkedDocs = [];
  for (const doc of docs) {
    if (!doc.pageContent) continue;
    const text = doc.pageContent;
    let i = 0;
    while (i < text.length) {
      const chunk = text.slice(i, i + CHUNK_SIZE);
      chunkedDocs.push({
        pageContent: chunk,
        metadata: { ...doc.metadata }
      });
      // Move forward by CHUNK_SIZE minus overlap
      i += (CHUNK_SIZE - CHUNK_OVERLAP);
    }
  }

  await QdrantVectorStore.fromDocuments(chunkedDocs, embeddings, qdrantConfig);
}

export async function retrieveChunks(query, userId) {
  const embeddings = getEmbeddings();
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, qdrantConfig);
  const retriever = vectorStore.asRetriever({
    k: 3,
    filter: {
      must: [{ key: "metadata.userId", match: { value: userId } }],
    },
  });
  return retriever.invoke(query);
}
