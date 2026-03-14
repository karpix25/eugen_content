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

export default router;
