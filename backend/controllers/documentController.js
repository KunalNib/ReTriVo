import db from "../db.js";

export async function getDocuments(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute({
      sql: "SELECT * FROM documents WHERE userId = ? ORDER BY createdAt DESC",
      args: [userId],
    });
    res.json({ documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
