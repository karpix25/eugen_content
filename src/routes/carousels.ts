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

router.post("/styles", authenticateToken, upload.single('image'), async (req: any, res) => {
  const { name } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No image uploaded" });

  try {
    const key = `carousel-styles/${req.user.id}_${file.originalname}`;
    const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
    let imageUrl = (uploadResult as any).Location;

    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      imageUrl = endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    // Analyze style via Gemini
    const styleAnalysis = await analyzeStyle(imageUrl);

    const result = await query(
      "INSERT INTO carousel_styles (user_id, name, image_url, analysis) VALUES ($1, $2, $3, $4) RETURNING *",
      [String(req.user.id), name, imageUrl, JSON.stringify(styleAnalysis)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Style upload error:", error);
    res.status(500).json({ error: "Failed to upload style" });
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
        const detectedLang = await detectLanguage(transcript) || 'ru';
        const script = await generateCarouselScript(transcript, topic || title, styleId, detectedLang, targetAudience);
        const gridUrl = await generateGridImage(script, analysis);
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'carousels');
        const slices = await sliceCarouselGrid(gridUrl, uploadsDir);
        await query("UPDATE carousels SET script = $1, image_url = $2, slides = $3, status = 'ready' WHERE id = $4", [JSON.stringify(script), gridUrl, slices, carouselId]);
        await sendCarouselToTelegram(String(req.user.id), slices.map(s => path.join(process.cwd(), 'public', s)));
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
