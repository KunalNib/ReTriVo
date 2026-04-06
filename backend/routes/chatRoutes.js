import { Router } from "express";
import { chat, getChats, getChatById } from "../controllers/chatController.js";

const router = Router();

router.post("/", chat);

export default router;

