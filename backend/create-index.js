import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";

async function main() {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    await client.createPayloadIndex("user-collection", {
      field_name: "metadata.userId",
      field_schema: "keyword",
    });
    console.log("Payload index 'metadata.userId' created successfully.");
  } catch (err) {
    console.error("Failed to create payload index:", err);
  }
}

main();
