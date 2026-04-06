import { Router } from "express";
import multer from "multer";
import { uploadDocument } from "../controllers/uploadController.js";

const router = Router();
const upload = multer({ dest: "uploads" });

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      import("fs").then(fs => fs.writeFileSync("multer_error.dump", String(err.stack || err.message)));
      console.error("Multer error:", err);
      return res.status(500).json({ error: "Multer error: " + err.message });
    }
    next();
  });
}, uploadDocument);

export default router;
