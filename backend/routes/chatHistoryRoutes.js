import { Router } from "express";
import { getChats, getChatById } from "../controllers/chatController.js";

const router = Router();

router.get("/", getChats);
router.get("/:id", getChatById);

export default router;
