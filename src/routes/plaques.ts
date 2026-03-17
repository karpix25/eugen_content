import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { query } from "../lib/db.js";
import { uploadToS3 } from "../lib/s3.js";
import { authenticateToken, isAdmin, requireAdmin, JWT_SECRET } from "../middleware/auth.js";
import { generatePlaqueImage } from "../services/gemini.js";
import { plaqueQueue } from "../lib/queues.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/ad-plaques", authenticateToken, async (req: any, res) => {
  try {
    const isAdmin = req.user.is_admin;
    let result;
    
    if (isAdmin) {
      result = await query("SELECT * FROM ad_plaques WHERE status = 'completed' ORDER BY created_at DESC");
    } else {
      result = await query("SELECT * FROM ad_plaques WHERE user_id IS NULL AND status = 'completed' ORDER BY created_at DESC");
    }
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plaques" });
  }
});

router.post("/ad-plaques", authenticateToken, requireAdmin, upload.single("file"), async (req, res) => {
  const { name, text, user_id } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const key = `ad-plaques/${file.originalname}`;
    const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
    let imageUrl = (uploadResult as any).Location;
    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      imageUrl = endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    }
    const id = uuidv4();
    // In this project, all plaques uploaded by admin become global (user_id = null)
    await query("INSERT INTO ad_plaques (id, name, image_url, text, user_id) VALUES ($1, $2, $3, $4, $5)", [id, name, imageUrl, text || '', null]);
    res.json({ id, imageUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.post("/ad-plaques/generate", authenticateToken, requireAdmin, async (req: any, res) => {
  const { topic, name } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required" });

  try {
    const id = uuidv4();
    // Create plaque record with 'pending' status
    await query(
      "INSERT INTO ad_plaques (id, name, image_url, text, user_id, status) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, name || topic, '', topic, null, 'pending']
    );

    // Add to queue
    await plaqueQueue.add(`plaque-${id}`, {
      plaqueId: id,
      topic,
      name: name || topic
    });

    res.json({ id, status: 'pending' });
  } catch (error: any) {
    console.error("Plaque generation error:", error);
    res.status(500).json({ error: error.message || "Failed to start plaque generation" });
  }
});

router.get("/ad-plaques/status/:id", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const result = await query("SELECT status, image_url, error_message FROM ad_plaques WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Plaque not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plaque status" });
  }
});

router.post("/ad-plaques/approve/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    await query("UPDATE ad_plaques SET status = 'completed' WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve plaque" });
  }
});

router.delete("/ad-plaques/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    // Basic dependency cleanup (though if these are many, a transaction or cascade is better)
    await query("UPDATE publications SET plaque_id = NULL WHERE plaque_id = $1", [id]);
    await query("UPDATE users SET default_plaque_id = NULL WHERE default_plaque_id = $1", [id]);
    await query("UPDATE clips SET ad_plaque_id = NULL WHERE ad_plaque_id = $1", [id]);
    
    await query("DELETE FROM ad_plaques WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete plaque error:", error);
    res.status(500).json({ error: "Failed to delete plaque" });
  }
});

router.get("/fonts", authenticateToken, async (req, res) => {
  try {
    const fontsDir = path.join(process.cwd(), 'public', 'fonts');
    if (!fs.existsSync(fontsDir)) return res.json([]);
    const files = fs.readdirSync(fontsDir);
    const fonts = files.filter(f => f.endsWith('.ttf') || f.endsWith('.otf')).map(f => {
      const name = f.split('.')[0];
      return { id: name, name: name.charAt(0).toUpperCase() + name.slice(1), file: f };
    });
    res.json(fonts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch fonts" });
  }
});

export default router;
