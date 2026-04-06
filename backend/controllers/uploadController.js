import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import * as xlsx from "xlsx";
import { cloudinary } from "../config/cloudinary.js";
import db from "../db.js";
import { indexDocuments } from "../services/vectorService.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

export async function uploadDocument(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!req.file && !req.body.text) return res.json({ error: "file not found" });

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
        fs.writeFileSync("error.dump", String(err.stack || err));
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

    docs.forEach((doc) => {
      // Vector stores heavily restrict nested objects in metadata
      // Strip everything down to flat primitive strings/numbers
      const safeMetadata = {};
      
      if (doc.metadata) {
        if (typeof doc.metadata.source === 'string') safeMetadata.source = doc.metadata.source;
        if (typeof doc.metadata.pageNumber === 'number') safeMetadata.pageNumber = doc.metadata.pageNumber;
        if (doc.metadata.loc && doc.metadata.loc.pageNumber) safeMetadata.pageNumber = doc.metadata.loc.pageNumber;
      }
      
      safeMetadata.userId = userId;
      doc.metadata = safeMetadata;
    });

    await indexDocuments(docs);
    res.status(200).json({ success: true, message: "document loaded successfully" });
  } catch (err) {
    fs.writeFileSync("global_error.dump", String(err.stack || err));
    console.error("Route error:", err);
    res.status(500).json({ error: err.message || "something went wrong" });
  }
}
