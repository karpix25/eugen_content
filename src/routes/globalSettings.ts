import { Router } from "express";
import { uploadToS3 } from "../lib/s3.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { SettingsManager } from "../services/SettingsManager.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/logo", async (req, res) => {
  try {
    const logoUrl = await SettingsManager.getCarouselLogo();
    res.json({ url: logoUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logo" });
  }
});

router.post("/logo", authenticateToken, requireAdmin, upload.single('logo'), async (req: any, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const key = `global/logo_${Date.now()}_${file.originalname}`;
    const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
    let imageUrl = (uploadResult as any).Location;

    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      imageUrl = endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    await SettingsManager.setCarouselLogo(imageUrl);
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

router.get("/analysis-target-audience", authenticateToken, async (req, res) => {
  try {
    const value = await SettingsManager.getAnalysisTargetAudience();
    res.json({ value });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analysis target audience" });
  }
});

router.get("/carousel-limit", authenticateToken, async (req, res) => {
  try {
    const value = await SettingsManager.getCarouselDailyLimitPerUser();
    res.json({ value });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch carousel limit" });
  }
});

router.post("/analysis-target-audience", authenticateToken, requireAdmin, async (req, res) => {
  const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
  if (!value) {
    return res.status(400).json({ error: "Target audience is required" });
  }

  try {
    await SettingsManager.setAnalysisTargetAudience(value);
    res.json({ success: true, value });
  } catch (err) {
    res.status(500).json({ error: "Failed to update analysis target audience" });
  }
});

router.post("/carousel-limit", authenticateToken, requireAdmin, async (req, res) => {
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: "Carousel limit must be a non-negative number" });
  }

  try {
    await SettingsManager.setCarouselDailyLimitPerUser(value);
    res.json({ success: true, value: Math.floor(value) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update carousel limit" });
  }
});

router.get("/vizard", authenticateToken, async (req, res) => {
  try {
    const settings = await SettingsManager.getVizardSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Vizard settings" });
  }
});

router.post("/vizard", authenticateToken, requireAdmin, async (req, res) => {
  const settings = req.body;
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (['vizard_prefer_length', 'vizard_remove_silence', 'vizard_auto_broll'].includes(key)) {
        await SettingsManager.setSetting(key, String(value));
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update Vizard settings" });
  }
});

export default router;
