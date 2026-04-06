import { Router } from "express";
import { getDocuments } from "../controllers/documentController.js";

const router = Router();

router.get("/", getDocuments);

export default router;
