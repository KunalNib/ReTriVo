import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export { cloudinary, ai };
