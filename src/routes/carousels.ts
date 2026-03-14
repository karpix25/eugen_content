import { Router } from "express";
import path from "path";
import { query } from "../lib/db.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";
import { analyzeStyle, generateCarouselScript, generateGridImage, detectLanguage } from "../services/gemini.js";
import { sliceCarouselGrid } from "../services/slicer.js";
import { sendCarouselToTelegram } from "../services/telegram.js";
import multer from "multer";
import { uploadToS3 } from "../lib/s3.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/styles", authenticateToken, async (req: any, res) => {
  try {
    const templates = [
      { id: 'ios-notes', name: 'iOS Notes', image_url: '...', analysis: { prompt: "..." } },
      { id: 'dark-luxury', name: 'Dark Luxury', image_url: '...', analysis: { prompt: "..." } },
      { id: 'cyber-brutalist', name: 'Cyber Brutalist', image_url: '...', analysis: { prompt: "..." } }
    ];
    const result = await query("SELECT * FROM carousel_styles WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC", [String(req.user.id)]);
    res.json([...templates, ...result.rows]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch styles" });
  }
});

router.post("/styles/analyze", authenticateToken, isAdmin, async (req: any, res) => {
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

router.post("/styles", authenticateToken, isAdmin, async (req: any, res) => {
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

router.delete("/styles/:id", authenticateToken, isAdmin, async (req: any, res) => {
  try {
    await query("DELETE FROM carousel_styles WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete style" });
  }
});

router.post("/generate", authenticateToken, async (req: any, res) => {
  const { clipId, styleId, topic, targetAudience } = req.body;
  try {
    const clipRes = await query("SELECT transcript, title FROM clips WHERE id = $1", [clipId]);
    const { transcript, title } = clipRes.rows[0];

    let analysis: any;
    if (['ios-notes', 'dark-luxury', 'cyber-brutalist'].includes(styleId)) {
        // ... (template prompts)
    } else {
      const styleRes = await query("SELECT analysis FROM carousel_styles WHERE id = $1", [styleId]);
      analysis = styleRes.rows[0].analysis;
    }

    const carouselRes = await query("INSERT INTO carousels (clip_id, user_id, status) VALUES ($1, $2, 'generating') RETURNING id", [clipId, String(req.user.id)]);
    const carouselId = carouselRes.rows[0].id;

    (async () => {
      try {
        const userRes = await query("SELECT face_image_url, use_face_in_carousels FROM users WHERE telegram_id = $1", [String(req.user.id)]);
        const user = userRes.rows[0];
        const faceRef = user?.use_face_in_carousels ? user.face_image_url : undefined;

        const detectedLang = await detectLanguage(transcript) || 'ru';
        const script = await generateCarouselScript(transcript, topic || title, styleId, detectedLang, targetAudience);
        const gridUrl = await generateGridImage(script, analysis, faceRef);
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'carousels');
        const slices = await sliceCarouselGrid(gridUrl, uploadsDir);
        await query("UPDATE carousels SET script = $1, image_url = $2, slides = $3, status = 'ready' WHERE id = $4", [JSON.stringify(script), gridUrl, slices, carouselId]);
        await sendCarouselToTelegram(String(req.user.id), slices.map(s => path.join(process.cwd(), 'public', s)), clipId);
      } catch (err: any) {
        await query("UPDATE carousels SET status = 'error', error_message = $1 WHERE id = $2", [err.message, carouselId]);
      }
    })();
    res.json({ carouselId, status: 'generating' });
  } catch (err) {
    res.status(500).json({ error: "Failed to start generation" });
  }
});

router.get("/:id", authenticateToken, async (req: any, res) => {
    const result = await query("SELECT * FROM carousels WHERE id = $1", [req.params.id]);
    res.json(result.rows[0]);
});

export default router;
