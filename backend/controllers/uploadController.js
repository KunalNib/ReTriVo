import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import * as xlsx from "xlsx";
import { cloudinary } from "../config/cloudinary.js";
import db from "../db.js";
import { indexDocuments } from "../services/vectorService.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { YoutubeTranscript } from "youtube-transcript";
import { getGraphStore, graphLlm } from "../services/graphService.js";
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm";
import { Document } from "@langchain/core/documents";

function extractYouTubeID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export async function uploadDocument(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!req.file && !req.body.text && !req.body.youtubeUrl) return res.json({ error: "no content provided" });

    const docs = [];

    if (req.file) {
      let cloudUrl = null;
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "rag-chatbot-docs",
          resource_type: "raw",
          public_id: req.file.originalname.replace(/\.[^/.]+$/, ""),
        });
        cloudUrl = uploadResult.secure_url;

        const originalExt = req.file.originalname.toLowerCase();

        if (originalExt.endsWith(".pdf")) {
            const loader = new PDFLoader(req.file.path);
            const pdfdocs = await loader.load();
            docs.push(...pdfdocs);
        } else if (originalExt.endsWith(".csv")) {
            const rawCsv = fs.readFileSync(req.file.path, "utf-8");
            docs.push({ pageContent: rawCsv, metadata: { source: req.file.originalname } });
        } else if (originalExt.endsWith(".xlsx") || originalExt.endsWith(".xls")) {
            const workbook = xlsx.readFile(req.file.path);
            let combinedText = "";
            workbook.SheetNames.forEach((sheetName) => {
              const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
              combinedText += `\n--- Sheet: ${sheetName} ---\n${csvData}`;
            });
            docs.push({ pageContent: combinedText, metadata: { source: req.file.originalname } });
        } else {
            throw new Error("Unsupported file format");
        }
      } catch (err) {
        console.error("Upload/Processing Error:", err);
        return res.status(500).json({ error: "Failed to process file." });
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }

      await db.execute({
        sql: "INSERT INTO documents (id, userId, filename, url) VALUES (?, ?, ?, ?)",
        args: [uuidv4(), userId, req.file.originalname, cloudUrl],
      });
    }

    if (req.body.text) {
      docs.push({ pageContent: req.body.text, metadata: { source: "manual-text" } });
      await db.execute({
        sql: "INSERT INTO documents (id, userId, filename, url) VALUES (?, ?, ?, ?)",
        args: [uuidv4(), userId, "Manual Text Input", null],
      });
    }

    if (req.body.youtubeUrl) {
      try {
        const videoId = extractYouTubeID(req.body.youtubeUrl);
        if (!videoId) {
          return res.status(400).json({ error: "Invalid YouTube URL provided." });
        }

        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        if (!transcriptItems || transcriptItems.length === 0) {
          return res.status(400).json({ error: "No transcript available for this video." });
        }

        const fullText = transcriptItems.map(item => item.text).join(" ");
        docs.push({ 
          pageContent: fullText, 
          metadata: { source: req.body.youtubeUrl, type: "youtube" } 
        });

        await db.execute({
          sql: "INSERT INTO documents (id, userId, filename, url) VALUES (?, ?, ?, ?)",
          args: [uuidv4(), userId, "YouTube Video", req.body.youtubeUrl],
        });
      } catch (err) {
        console.error("YouTube Transcript Error:", err.message);
        if (err.message.includes("Transcript is disabled") || err.message.includes("No transcripts are available")) {
          return res.status(400).json({ error: "Transcripts are disabled or unavailable for this video." });
        }
        return res.status(500).json({ error: "Failed to process YouTube URL: " + err.message });
      }
    }

    docs.forEach((doc) => {
      const safeMetadata = {};
      if (doc.metadata) {
        if (typeof doc.metadata.source === 'string') safeMetadata.source = doc.metadata.source;
        if (typeof doc.metadata.pageNumber === 'number') safeMetadata.pageNumber = doc.metadata.pageNumber;
        if (doc.metadata.loc && doc.metadata.loc.pageNumber) safeMetadata.pageNumber = doc.metadata.loc.pageNumber;
      }
      safeMetadata.userId = userId;
      doc.metadata = safeMetadata;
    });

    const graph = await getGraphStore();
    if (graph && docs.length > 0) {
      try {
        console.log("Extracting Graph Knowledge...");
        const allowedNodes = ["Person", "Organization", "Location"];
        const allowedRelationships = ["WORKS_FOR", "LOCATED_IN", "PARTICIPATES_IN"];
        
        const llmTransformer = new LLMGraphTransformer({ 
          llm: graphLlm,
          allowedNodes,
          allowedRelationships
        });
        const lcDocs = docs.map(d => new Document({ pageContent: d.pageContent, metadata: d.metadata }));
        
        // Only process the first 5 chunks to save tokens and time if it's too large
        const chunksToProcess = lcDocs.slice(0, 5);
        const graphDocuments = await llmTransformer.convertToGraphDocuments(chunksToProcess);
        await graph.addGraphDocuments(graphDocuments, { includeSource: true });
        console.log("Graph Knowledge Extracted.");
      } catch (err) {
        console.error("Graph extraction failed:", err.message);
      }
    }

    await indexDocuments(docs);
    res.status(200).json({ success: true, message: "document loaded successfully" });
  } catch (err) {
    console.error("Route error:", err);
    res.status(500).json({ error: err.message || "something went wrong" });
  }
}
