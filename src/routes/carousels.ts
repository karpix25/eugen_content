import { Router } from "express";
import path from "path";
import { query } from "../lib/db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { analyzeStyle, generateCarouselScript, generateGridImage, detectLanguage } from "../services/gemini.js";
import { sliceCarouselGrid } from "../services/slicer.js";
import { sendCarouselToTelegram } from "../services/telegram.js";
import multer from "multer";
import { uploadToS3 } from "../lib/s3.js";
import { SettingsManager } from "../services/SettingsManager.js";
import { carouselQueue } from "../lib/queues.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/styles", authenticateToken, async (req: any, res) => {
  try {
    const templates = [
      { id: 'ios-notes', name: 'Заметки iOS', image_url: '/templates/ios-notes.png', analysis: { design_dna: { vibe: "Minimalist, Clean, Apple-style", core_principles: ["Clarity", "Negative Space", "San Francisco Type"] } } },
      { id: 'dark-luxury', name: 'Темная Роскошь', image_url: '/templates/dark-luxury.png', analysis: { design_dna: { vibe: "Elegant, Premium, High-end", core_principles: ["Contrast", "Gold Accents", "Serif Typography"] } } },
      { id: 'cyber-brutalist', name: 'Кибер-Брутализм', image_url: '/templates/cyber-brutalist.png', analysis: { design_dna: { vibe: "Bold, Raw, Experimental", core_principles: ["High Contrast", "Grid System", "Neon Accents"] } } }
    ];
    const result = await query("SELECT * FROM carousel_styles WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC", [String(req.user.id)]);
    res.json([...templates, ...result.rows]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch styles" });
  }
});

router.post("/styles/analyze", authenticateToken, requireAdmin, async (req: any, res) => {
  const { image, images } = req.body;
  const targetImages = images || (image ? [image] : null);
  
  if (!targetImages || (Array.isArray(targetImages) && targetImages.length === 0)) {
    return res.status(400).json({ error: "No images provided" });
  }
  
  try {
    const analysis = await analyzeStyle(targetImages);
    res.json(analysis);
  } catch (err: any) {
    console.error("Style analysis error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze style" });
  }
});

router.post("/styles", authenticateToken, requireAdmin, async (req: any, res) => {
  const { name, image_url, analysis, is_global } = req.body;

  try {
    // If image_url is base64, we should ideally upload it to S3, 
    // but StyleManager currently sends base64/URL directly.
    // For now, let's just save what we get.
    const result = await query(
      "INSERT INTO carousel_styles (user_id, name, image_url, analysis) VALUES ($1, $2, $3, $4) RETURNING *",
      [is_global ? null : String(req.user.id), name, image_url, JSON.stringify(analysis)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Style save error:", error);
    res.status(500).json({ error: "Failed to save style" });
  }
});

const SYSTEM_STYLE_IDS = ['ios-notes', 'dark-luxury', 'cyber-brutalist'];

router.delete("/styles/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Don't attempt to delete system styles from database
    if (SYSTEM_STYLE_IDS.includes(id)) {
      return res.json({ success: true, message: "System style preserved" });
    }

    await query("DELETE FROM carousel_styles WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Style deletion error:", err);
    res.status(500).json({ error: "Failed to delete style" });
  }
});

router.post("/generate", authenticateToken, async (req: any, res) => {
  const { clipId, styleId, topic, targetAudience } = req.body;
  try {
    const carouselRes = await query(
      "INSERT INTO carousels (clip_id, user_id, status, style_id, target_audience, topic) VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING id", 
      [clipId, String(req.user.id), styleId, targetAudience, topic]
    );
    const carouselId = carouselRes.rows[0].id;

    // Add to BullMQ instead of direct execution
    await carouselQueue.add(`carousel-${carouselId}`, {
        carouselId,
        clipId,
        userId: String(req.user.id),
        styleId,
        topic,
        targetAudience
    });

    res.json({ carouselId, status: 'generating' });
  } catch (err) {
    console.error("Carousel generation trigger error:", err);
    res.status(500).json({ error: "Failed to start generation" });
  }
});

router.get("/:id", authenticateToken, async (req: any, res) => {
    const result = await query("SELECT * FROM carousels WHERE id = $1", [req.params.id]);
    res.json(result.rows[0]);
});

export default router;
