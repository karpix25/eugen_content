import { Router } from "express";
import { uploadToS3 } from "../lib/s3.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";
import { UserManager } from "../services/UserManager.js";
import { UserSettingsSchema } from "../lib/schemas.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", authenticateToken, async (req: any, res) => {
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  try {
    const users = await UserManager.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/settings", authenticateToken, async (req: any, res) => {
  try {
    // Validate request body using Zod
    const validatedData = UserSettingsSchema.parse(req.body);
    
    await UserManager.updateSettings(
      String(req.user.id), 
      req.user.username || '', 
      req.user.first_name || '',
      validatedData
    );
    
    res.json({ success: true });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid data format", details: err.errors });
    }
    console.error("Settings update error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.post("/:id/authorize", authenticateToken, async (req: any, res) => {
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  const { id } = req.params;
  const { authorize } = req.body;
  try {
    await UserManager.setAuthorization(id, authorize);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update authorization" });
  }
});

router.post("/:telegram_id/watermark", authenticateToken, upload.single('watermark'), async (req: any, res) => {
  const { telegram_id } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const key = `watermarks/${telegram_id}_${file.originalname}`;
    const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
    let imageUrl = (uploadResult as any).Location;

    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      imageUrl = endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    await UserManager.updateWatermarkUrl(telegram_id, imageUrl);
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error("Watermark upload error:", error);
    res.status(500).json({ error: "Failed to upload watermark" });
  }
});

router.post("/:telegram_id/face", authenticateToken, upload.single('face'), async (req: any, res) => {
  const { telegram_id } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const key = `faces/${telegram_id}_${file.originalname}`;
    const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
    let imageUrl = (uploadResult as any).Location;

    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      imageUrl = endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    await UserManager.updateFaceImageUrl(telegram_id, imageUrl);
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error("Face upload error:", error);
    res.status(500).json({ error: "Failed to upload face" });
  }
});

export default router;
