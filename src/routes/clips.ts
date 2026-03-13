import { Router } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { query } from "../lib/db.js";
import { authenticateToken, isAdmin, requireAdmin, JWT_SECRET } from "../middleware/auth.js";
import { processClip, extractScreenshots } from "../services/processor.js";
import { sanitizeFolderName } from "../lib/sanitize.js";

const router = Router();
// Removed hardcoded JWT_SECRET fallback

router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = String(req.user.id);
    const result = await query(`
      SELECT c.*, 
             EXISTS(SELECT 1 FROM publications WHERE clip_id = c.id AND user_id = $1) as published_by_me
      FROM clips c 
      ORDER BY created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Clips fetch error:", err);
    res.status(500).json({ error: "Failed to fetch clips" });
  }
});

router.post("/:id/apply-plaque", async (req: any, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  let user: any;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const { id } = req.params;
  const { plaque_id } = req.body;

  try {
    const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
    if (clipRes.rows.length === 0) return res.status(404).json({ error: "Clip not found" });
    const clip = clipRes.rows[0];

    let plaqueImageUrl = null;
    if (plaque_id) {
      const plaqueRes = await query("SELECT * FROM ad_plaques WHERE id = $1", [plaque_id]);
      if (plaqueRes.rows.length > 0) plaqueImageUrl = plaqueRes.rows[0].image_url;
    }

    const { bot } = await import("../services/telegram.js");
    const telegramId = user.telegram_id || user.id;

    await query("INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING", [telegramId, user.username || '', user.first_name || 'Worker']);

    const dbUserRes = await query("SELECT * FROM users WHERE telegram_id = $1", [String(telegramId)]);
    const dbUser = dbUserRes.rows[0];

    const watermarkConfig = (dbUser.watermark_text || user.username) ? {
      text: dbUser.watermark_text || (user.username ? `@${user.username}` : user.first_name),
      opacity: parseFloat(dbUser.watermark_opacity) || 0.08,
      position: dbUser.watermark_position || 'center'
    } : null;

    const subtitleConfig = {
      enabled: dbUser.subtitle_enabled !== false,
      font_size: dbUser.subtitle_font_size ? parseFloat(dbUser.subtitle_font_size) : 16,
      font_color: dbUser.subtitle_font_color || '#FFFFFF',
      position: dbUser.subtitle_position || '80',
      style: dbUser.subtitle_style || 'karaoke',
      font_family: dbUser.subtitle_font_family || 'Anton',
      highlight_color: dbUser.subtitle_highlight_color || '#FFFF00',
      highlight_enabled: dbUser.subtitle_highlight_enabled !== false,
      outline_color: dbUser.subtitle_outline_color || '#000000'
    };

    const plaqueConfig = {
      position: dbUser.plaque_position || 'top',
      size: dbUser.plaque_size ? Number(dbUser.plaque_size) : 80,
      timerange: dbUser.plaque_timerange ? Number(dbUser.plaque_timerange) : 0
    };

    const videoRes = await query("SELECT title FROM videos WHERE id = $1", [clip.video_id]);
    const folderName = sanitizeFolderName(videoRes.rows[0]?.title || "Unknown_Video");

    const localFilePath = await processClip(id, clip.url, plaqueImageUrl, clip.language, null, true, watermarkConfig as any, plaqueConfig, subtitleConfig, folderName);

    if (telegramId !== 'dev') {
      const message = await bot.telegram.sendVideo(telegramId, { source: fs.createReadStream(localFilePath) }, { caption: `🎥 ${clip.title}` });
      
      // Ensure user exists before inserting publication
      await query(
        "INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING", 
        [String(telegramId), user.username || '', user.first_name || 'Worker']
      );

      await query(
        "INSERT INTO publications (clip_id, user_id, plaque_id, message_id, status) VALUES ($1, $2, $3, $4, 'sent')", 
        [id, String(telegramId), plaque_id || null, message.message_id]
      );
      fs.unlinkSync(localFilePath);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process video" });
  }
});

router.post("/:id/carousel", async (req: any, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token" });
  
  let decoded: any;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(403).json({ error: "Invalid token" }); }

  const { id } = req.params;
  const telegramId = decoded.telegram_id || decoded.id;

  try {
    const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
    const clip = clipRes.rows[0];
    const screenshotPaths = await extractScreenshots(clip.url, id, 5);
    const { bot } = await import("../services/telegram.js");

    const mediaGroup = screenshotPaths.map((p, idx) => ({
      type: 'photo' as const,
      media: { source: fs.createReadStream(p) },
      caption: idx === 0 ? `🖼️ Карусель: ${clip.title}` : undefined
    }));

    await bot.telegram.sendMediaGroup(telegramId, mediaGroup);
    screenshotPaths.forEach(p => fs.unlinkSync(p));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed carousel generation" });
  }
});

router.post("/:id/reprocess", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { plaque_id, target_lang, source_lang } = req.body;
  try {
    const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
    const clip = clipRes.rows[0];
    const videoRes = await query("SELECT * FROM videos WHERE id = $1", [clip.video_id]);
    const video = videoRes.rows[0];

    let plaqueImageUrl = null;
    if (plaque_id || clip.ad_plaque_id) {
      const pRes = await query("SELECT image_url FROM ad_plaques WHERE id = $1", [plaque_id || clip.ad_plaque_id]);
      if (pRes.rows.length > 0) plaqueImageUrl = pRes.rows[0].image_url;
    }

    const tLang = target_lang || clip.language || video?.target_language;
    const sLang = source_lang || video?.detected_language;
    const folderName = sanitizeFolderName(video?.title || "Unknown_Video");

    processClip(id, clip.url, plaqueImageUrl, tLang, sLang, false, undefined, undefined, undefined, folderName).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Reprocess failed" });
  }
});

export default router;
