import { Router } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { query } from "../lib/db.js";
import { authenticateToken, isEnvAdmin, requireAdmin, JWT_SECRET } from "../middleware/auth.js";
import { processClip, extractScreenshots } from "../services/processor.js";
import { analyzeStyle, generateCarouselScript, generateGridImage, detectLanguage } from "../services/gemini.js";
import { sliceCarouselGrid } from "../services/slicer.js";
import { sendCarouselToTelegram } from "../services/telegram.js";
import { sanitizeFolderName } from "../lib/sanitize.js";
import { PreviewGenerator } from "../services/preview-generator.js";
import { uploadToS3 } from "../lib/s3.js";
import { renderingQueue } from "../lib/queues.js";
import { SettingsManager } from "../services/SettingsManager.js";
import { buildClipAccessCondition, getAccessibleClipById, resolveUserAdminAccess } from "../services/clip-access.js";

const router = Router();
// Removed hardcoded JWT_SECRET fallback

const ensureCarouselDailyLimit = async (userId: string) => {
  const dailyLimit = await SettingsManager.getCarouselDailyLimitPerUser();
  if (!dailyLimit) return null;

  const usageRes = await query(
    `SELECT COUNT(*)::int AS count
     FROM carousels
     WHERE user_id = $1
       AND created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
    [userId]
  );

  const usedToday = usageRes.rows[0]?.count || 0;
  if (usedToday >= dailyLimit) {
    return { dailyLimit, usedToday };
  }

  return null;
};

router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = String(req.user.id);
    const isUserAdmin = await resolveUserAdminAccess(userId, req.user.is_admin === true);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let queryText = `
      SELECT c.*, 
             v.title as video_title,
             v.thumbnail as video_thumbnail,
             v.is_public as video_is_public,
             EXISTS(SELECT 1 FROM publications WHERE clip_id = c.id AND user_id = $1) as published_by_me
      FROM clips c 
      JOIN videos v ON c.video_id = v.id
      LEFT JOIN channels ch ON v.channel_id = ch.id
    `;

    let countQueryText = `
      SELECT COUNT(*) as total 
      FROM clips c 
      JOIN videos v ON c.video_id = v.id
      LEFT JOIN channels ch ON v.channel_id = ch.id
    `;

    const queryParams: any[] = [userId];

    if (!isUserAdmin) {
      const filter = ` WHERE ${buildClipAccessCondition("$1")}`;
      queryText += filter;
      countQueryText += filter;
    }

    queryText += " ORDER BY c.created_at DESC LIMIT $2 OFFSET $3";
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);
    const countResult = await query(countQueryText, isUserAdmin ? [] : [userId]);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      items: result.rows,
      total,
      limit,
      offset
    });
  } catch (err) {
    console.error("Clips fetch error:", err);
    res.status(500).json({ error: "Failed to fetch clips" });
  }
});

router.post("/:id/toggle-public", authenticateToken, requireAdmin, async (req: any, res) => {
  if (!req.user.is_admin && !isEnvAdmin(req.user.id)) return res.sendStatus(403);
  const { id } = req.params;
  const { is_public } = req.body;

  try {
    await query("UPDATE clips SET is_public = $1 WHERE id = $2", [is_public, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error toggling clip visibility:", err);
    res.status(500).json({ error: "Failed to update visibility" });
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
    let plaqueImageUrl = null;
    if (plaque_id) {
      const plaqueRes = await query("SELECT * FROM ad_plaques WHERE id = $1", [plaque_id]);
      if (plaqueRes.rows.length > 0) plaqueImageUrl = plaqueRes.rows[0].image_url;
    }

    const { bot } = await import("../services/telegram.js");
    const telegramId = user.telegram_id || user.id;
    const clip = await getAccessibleClipById(id, String(telegramId), user.is_admin === true);
    if (!clip) return res.status(404).json({ error: "Clip not found or access denied" });

    await query("INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING", [telegramId, user.username || '', user.first_name || 'Worker']);

    const dbUserRes = await query("SELECT * FROM users WHERE telegram_id = $1", [String(telegramId)]);
    const dbUser = dbUserRes.rows[0];

    // Enforce plaque requirement
    if (!plaqueImageUrl && dbUser.default_plaque_id) {
      const defaultPlaqueRes = await query("SELECT image_url FROM ad_plaques WHERE id = $1", [dbUser.default_plaque_id]);
      plaqueImageUrl = defaultPlaqueRes.rows[0]?.image_url || null;
    }

    if (!plaqueImageUrl) {
      return res.status(400).json({ error: "Для обработки видео требуется рекламная плашка (выберите её или установите плашку по умолчанию в настройках)." });
    }

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

    const videoRes = await query("SELECT title, detected_language FROM videos WHERE id = $1", [clip.video_id]);
    const videoMeta = videoRes.rows[0];
    const folderName = sanitizeFolderName(videoMeta?.title || "Unknown_Video");
    const sourceLang = videoMeta?.detected_language || null;

    // Add to BullMQ instead of direct execution
    await renderingQueue.add(`render-${id}`, {
      clipId: id,
      videoUrl: clip.source_url || clip.url,
      plaqueImageUrl,
      targetLang: clip.language,
      sourceLang,
      watermarkConfig,
      plaqueConfig,
      subtitleConfig,
      videoFolderName: folderName,
      telegramId: String(telegramId),
      user: dbUser
    });

    res.json({ success: true, message: "Задание добавлено в очередь обработки. Вы получите видео в Telegram, когда оно будет готово." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to queue video processing" });
  }
});

router.post("/:id/carousel", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const telegramId = req.user.telegram_id || req.user.id;
  const { styleId = 'ios-notes', topic, targetAudience } = req.body;

  try {
    const limitState = await ensureCarouselDailyLimit(String(req.user.id));
    if (limitState) {
      return res.status(429).json({
        error: `Достигнут суточный лимит генерации каруселей: ${limitState.dailyLimit} на пользователя.`
      });
    }

    const clip = await getAccessibleClipById(id, String(req.user.id), req.user?.is_admin === true);
    if (!clip) return res.status(404).json({ error: "Clip not found or access denied" });
    const { transcript, title } = clip;

    // Get style analysis
    let analysis: any;
    if (styleId === 'ios-notes') {
      // Default analysis for templates (can be enriched if needed)
      analysis = { styleDescription: styleId };
    } else {
      const styleRes = await query("SELECT analysis FROM carousel_styles WHERE id = $1", [styleId]);
      analysis = styleRes.rows[0]?.analysis || { styleDescription: 'Minimalist' };
    }

    const carouselRes = await query("INSERT INTO carousels (clip_id, user_id, status) VALUES ($1, $2, 'generating') RETURNING id", [id, String(req.user.id)]);
    const carouselId = carouselRes.rows[0].id;

    // Run generation in background
    (async () => {
      try {
        console.log(`[Carousel] Starting background generation for clip ${id}, carousel ${carouselId}`);
        const userRes = await query("SELECT face_image_url, use_face_in_carousels FROM users WHERE telegram_id = $1", [String(req.user.id)]);
        const user = userRes.rows[0];
        const faceRef = user?.use_face_in_carousels ? user.face_image_url : undefined;

        console.log(`[Carousel] Detecting language for transcript...`);
        const detectedLang = await detectLanguage(transcript) || 'ru';

        console.log(`[Carousel] Generating script (lang: ${detectedLang})...`);
        const script = await generateCarouselScript(transcript, topic || title, styleId, detectedLang, targetAudience);

        console.log(`[Carousel] Generating grid image (faceRef: ${faceRef ? 'yes' : 'no'})...`);
        const gridUrl = await generateGridImage(script, analysis, faceRef);
        console.log(`[Carousel] Grid image generated: ${gridUrl}`);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'carousels');
        console.log(`[Carousel] Slicing grid reached. UploadsDir: ${uploadsDir}`);

        const slices = await sliceCarouselGrid(gridUrl, uploadsDir);
        console.log(`[Carousel] Slices created: ${slices.length} items`);

        console.log(`[Carousel] Updating database...`);
        await query("UPDATE carousels SET script = $1, image_url = $2, slides = $3, status = 'ready' WHERE id = $4", [JSON.stringify(script), gridUrl, slices, carouselId]);

        console.log(`[Carousel] Sending to Telegram id: ${telegramId}...`);
        const absoluteSlicePaths = slices.map(s => path.join(process.cwd(), 'public', s));
        console.log(`[Carousel] Absolute paths: ${JSON.stringify(absoluteSlicePaths)}`);

        await sendCarouselToTelegram(String(telegramId), absoluteSlicePaths, id);
        console.log(`[Carousel] Successfully completed for clip ${id}`);
      } catch (err: any) {
        console.error("[Carousel] Background error:", err);
        await query("UPDATE carousels SET status = 'error', error_message = $1 WHERE id = $2", [err.message, carouselId]);
      }
    })();

    res.json({ success: true, carouselId, status: 'generating' });
  } catch (err) {
    console.error("Carousel generation error:", err);
    res.status(500).json({ error: "Failed carousel generation" });
  }
});

// Aliases for frontend
router.post("/send-to-telegram", authenticateToken, async (req: any, res) => {
  const { clipId, plaqueId } = req.body;
  req.params.id = clipId;
  req.body.plaque_id = plaqueId;
  // Redirect to existing logic by calling the handler directly or via redirect
  // For simplicity, let's just use the logic from apply-plaque
  // But wait, the existing apply-plaque route uses authenticateToken as well now (I should add it there too)
  res.redirect(307, `/api/clips/${clipId}/apply-plaque`);
});

router.post("/send-carousel", authenticateToken, async (req: any, res) => {
  const { clipId } = req.body;
  res.redirect(307, `/api/clips/${clipId}/carousel`);
});

router.post("/:id/reprocess", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { plaque_id, target_lang, source_lang } = req.body;
  try {
    const clip = await getAccessibleClipById(id, String(req.user.id), req.user?.is_admin === true);
    if (!clip) {
      return res.status(404).json({ error: "Clip not found or access denied" });
    }
    const videoRes = await query("SELECT * FROM videos WHERE id = $1", [clip.video_id]);
    const video = videoRes.rows[0];

    let plaqueImageUrl = null;
    if (plaque_id || clip.ad_plaque_id) {
      const pRes = await query("SELECT image_url FROM ad_plaques WHERE id = $1", [plaque_id || clip.ad_plaque_id]);
      if (pRes.rows.length > 0) plaqueImageUrl = pRes.rows[0].image_url;
    }

    if (!plaqueImageUrl) {
      const dbUserRes = await query("SELECT default_plaque_id FROM users WHERE telegram_id = $1", [String(req.user.id)]);
      const dbUser = dbUserRes.rows[0];
      if (dbUser?.default_plaque_id) {
        const pRes = await query("SELECT image_url FROM ad_plaques WHERE id = $1", [dbUser.default_plaque_id]);
        if (pRes.rows.length > 0) plaqueImageUrl = pRes.rows[0].image_url;
      }
    }

    // Still check if plaqueImageUrl is resolved
    if (!plaqueImageUrl) {
      return res.status(400).json({ error: "Для переработки видео требуется рекламная плашка (выберите её или установите плашку по умолчанию в настройках)." });
    }

    const tLang = target_lang || clip.language || video?.target_language;
    const sLang = source_lang || video?.detected_language;
    const folderName = sanitizeFolderName(video?.title || "Unknown_Video");

    processClip(id, clip.source_url || clip.url, plaqueImageUrl, tLang, sLang, false, undefined, undefined, undefined, folderName).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Reprocess failed" });
  }
});

export default router;
