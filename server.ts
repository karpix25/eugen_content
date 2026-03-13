import express from "express";

// --- Logger Override for Timestamps ---
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const getTimestamp = () => new Date().toLocaleString('ru-RU', { 
  year: 'numeric', month: '2-digit', day: '2-digit', 
  hour: '2-digit', minute: '2-digit', second: '2-digit' 
});
console.log = (...args) => originalLog(`[${getTimestamp()}]`, ...args);
console.error = (...args) => originalError(`[${getTimestamp()}]`, ...args);
console.warn = (...args) => originalWarn(`[${getTimestamp()}]`, ...args);

import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import fs from "fs";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { v4 as uuidv4 } from "uuid";

import { query, initDb } from "./src/lib/db.js";
import { s3Client, uploadToS3 } from "./src/lib/s3.js";
import { getTranscript, getChannelInfo, getLatestVideos } from "./src/services/apify.js";
import { evaluateContent, translateText, detectLanguage, analyzeStyle } from "./src/services/gemini.js";
import { sendToVizard, getVizardProjectStatus } from "./src/services/vizard.js";
import { downloadYouTubeVideo } from "./src/services/video-downloader.js";
import { startBot, sendCarouselToTelegram } from "./src/services/telegram.js";
import { processClip, extractScreenshots } from "./src/services/processor.js";
import cron from "node-cron";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Carousel Services
import { generateCarouselScript, generateGridImage } from "./src/services/gemini.js";
import { sliceCarouselGrid } from "./src/services/slicer.js";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-me";

const app = express();

// Extends Express Request explicitly without breaking the global namespace implicitly
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

async function getChannelIdFromUrl(url: string): Promise<{ id?: string, handle?: string } | null> {
  const trimmedUrl = url.trim();

  // Support raw handles directly
  if (trimmedUrl.startsWith('@')) {
    return { handle: trimmedUrl };
  }

  // Flexible regex to catch channel IDs and handles
  const idMatch = trimmedUrl.match(/(?:youtube\.com|youtu\.be)\/channel\/(UC[\w-]+)/i);
  if (idMatch) return { id: idMatch[1] };

  const handleMatch = trimmedUrl.match(/(?:youtube\.com|youtu\.be)\/(@[\w.-]+)/i);
  if (handleMatch) return { handle: handleMatch[1] };

  // Fallback for old custom URLs
  const customMatch = trimmedUrl.match(/(?:youtube\.com|youtu\.be)\/([\w.-]+)/i);
  if (customMatch && !['watch', 'search', 'results', 'shorts'].includes(customMatch[1].toLowerCase())) {
    return { handle: `@${customMatch[1].replace(/^@/, '')}` };
  }

  return null;
}

function calculateNextCheck(interval: string): Date {
  const now = new Date();
  if (interval === 'weekly') {
    now.setDate(now.getDate() + 7);
  } else if (interval === 'daily') {
    now.setDate(now.getDate() + 1);
  } else {
    // manual or unknown
    now.setFullYear(now.getFullYear() + 10); // Far future
  }
  return now;
}

const normalizeLang = (lang: string | null): string | null => {
  if (!lang) return null;
  const l = lang.toLowerCase().trim();
  if (l.includes('russian') || l === 'ru') return 'ru';
  if (l.includes('english') || l === 'en') return 'en';
  if (l.includes('spanish') || l === 'es') return 'es';
  return l;
};

const syncChannel = async (channelId: string, name: string, monitoringInterval: string, scrapeDays: number = 7, handle?: string) => {
  console.log(`Syncing channel: ${name} (${channelId}) - Handle: ${handle || 'N/A'}`);
  try {
    const searchUrl = handle ? `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}` : `https://www.youtube.com/channel/${channelId}`;
    const discoveredVideos = await getLatestVideos(searchUrl, 20, scrapeDays);
    for (const item of discoveredVideos) {
      const videoId = item.id;
      if (!videoId) {
        console.warn(`Sync: Skipping video with missing ID: ${item.title}`);
        continue;
      }
      const existing = await query("SELECT id FROM videos WHERE id = $1", [videoId]);
      if (existing.rows.length === 0) {
        console.log(`Sync: Discovered NEW video ${videoId} for ${name}`);
        await query(`
          INSERT INTO videos (id, channel_id, title, description, published_at, thumbnail)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [videoId, channelId, item.title, item.description, item.publishedAt, item.thumbnail]);

        let transcript = item.transcript;
        if (!transcript) {
          console.log(`Sync: Transcript missing for ${videoId}, fetching solo...`);
          transcript = await getTranscript(`https://www.youtube.com/watch?v=${videoId}`);
        }

        if (transcript) {
          await query("UPDATE videos SET transcript = $1 WHERE id = $2", [transcript, videoId]);

          console.log(`[AI] Starting evaluation for video: ${item.title}`);
          const evaluation = await evaluateContent(item.title, transcript, "Предприниматели, интересующиеся ИИ и автоматизацией");
          if (evaluation) {
            await query("UPDATE videos SET ai_score = $1, ai_evaluation = $2, detected_language = $3 WHERE id = $4",
              [evaluation.score, evaluation.evaluation, evaluation.detected_language, videoId]);
            console.log(`[AI] Evaluation complete for ${videoId}: Score ${evaluation.score}/100, Lang: ${evaluation.detected_language}`);
            
            // AUTO APPROVAL: Automatically approve videos with high score (80+)
            if (evaluation.score >= 80) {
              console.log(`[Auto] High score (${evaluation.score}) detected for ${videoId}. Automatically approving...`);
              await query("UPDATE videos SET status = 'approved' WHERE id = $1", [videoId]);
            }
          } else {
            console.error(`[AI] Evaluation failed for ${videoId}`);
          }
        }
      }
    }

    const nextCheck = calculateNextCheck(monitoringInterval);
    await query("UPDATE channels SET last_checked = CURRENT_TIMESTAMP, next_check = $1 WHERE id = $2", [nextCheck, channelId]);
  } catch (err) {
    console.error(`Sync error for ${channelId}:`, err);
  }
};

const monitorChannels = async () => {
  console.log("Running scheduled monitoring check...");
  const channels = await query("SELECT * FROM channels WHERE next_check <= CURRENT_TIMESTAMP OR next_check IS NULL");

  for (const channel of channels.rows) {
    if (channel.monitoring_interval === 'manual') continue;
    await syncChannel(channel.id, channel.name, channel.monitoring_interval, channel.scrape_days, channel.handle);
  }
};

// Run every hour
cron.schedule('0 * * * *', monitorChannels);

const autoSendToVizard = async () => {
  console.log("Checking for approved videos to send to Vizard...");
  try {
    const approvedVideos = await query("SELECT id FROM videos WHERE status = 'approved' AND vizard_project_id IS NULL LIMIT 5");
    for (const video of approvedVideos.rows) {
      console.log(`[Auto] Sending approved video ${video.id} to Vizard...`);
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const vizardId = await sendToVizard(videoUrl, video.id);
      if (vizardId) {
        await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard' WHERE id = $2", [vizardId, video.id]);
        console.log(`[Auto] Successfully sent ${video.id} to Vizard. ID: ${vizardId}`);
      }
    }
  } catch (err) {
    console.error("Auto-Vizard error:", err);
  }
};

// Run auto-Vizard check every 15 minutes
cron.schedule('*/15 * * * *', autoSendToVizard);

const autoPublish = async () => {
  console.log("Running scheduled auto-publish check...");
  try {
    // Get all users who have auto mode enabled AND are authorized
    const usersRes = await query("SELECT * FROM users WHERE auto_mode_enabled = true AND is_authorized = true AND telegram_id IS NOT NULL");
    
    for (const user of usersRes.rows) {
      const telegramId = user.telegram_id;
      const videosPerDay = parseFloat(user.auto_mode_videos_per_day) || 3;
      
      // Calculate how many hours we should wait between posts
      // e.g., if 3 videos per day, spacing is 8 hours
      const hoursSpacing = 24 / videosPerDay;
      const lastPost = user.last_auto_post ? new Date(user.last_auto_post) : new Date(0);
      const now = new Date();
      const diffHours = (now.getTime() - lastPost.getTime()) / (1000 * 60 * 60);
      
      if (diffHours >= hoursSpacing) {
        console.log(`Auto-publishing for user ${telegramId} - diffHours: ${diffHours}, spacing: ${hoursSpacing}`);
        
        // Find an eligible clip
        // An eligible clip: 
        // 1. Must be from a channel they track, OR generally available if the app is global
        // 2. Status 'raw' or 'processed' depends on your pipeline, we'll pick 'raw' or 'processed'. 
        // Let's pick a 'processed' clip (already transcribed/dubbed) that hasn't been sent to this user.
        
        const clipRes = await query(`
          SELECT c.* FROM clips c
          JOIN videos v ON c.video_id = v.id
          WHERE c.status IN ('raw', 'processed') 
          AND v.status IN ('completed', 'approved')
          AND c.id NOT IN (
            SELECT clip_id FROM publications WHERE user_id = $1
          )
          ORDER BY random() 
          LIMIT 1
        `, [telegramId]);

        if (clipRes.rows.length === 0) {
          console.log(`No completely new clips available for auto-publish for user ${telegramId}`);
          continue;
        }

        const clip = clipRes.rows[0];

        // Pick a random plaque for this user
        const plaqueRes = await query("SELECT * FROM ad_plaques WHERE user_id = $1 ORDER BY random() LIMIT 1", [telegramId]);
        const plaque = plaqueRes.rows[0];

        // Set up processor settings
        const defaultText = user.username ? `@${user.username}` : user.first_name;
        const watermarkConfig = {
          text: user.watermark_text !== null && user.watermark_text !== undefined ? user.watermark_text : defaultText,
          opacity: user.watermark_opacity !== null && user.watermark_opacity !== undefined ? parseFloat(user.watermark_opacity) : 0.08,
          position: user.watermark_position || 'center'
        };

        const plaqueConfig = {
          position: user.plaque_position || 'top',
          size: user.plaque_size !== null && user.plaque_size !== undefined ? parseFloat(user.plaque_size) : 80,
          timerange: user.plaque_timerange || 0
        };

        const subtitleConfig = {
          enabled: user.subtitle_enabled !== false,
          font_size: user.subtitle_font_size ? parseFloat(user.subtitle_font_size) : 16,
          font_color: user.subtitle_font_color || '#FFFFFF',
          position: user.subtitle_position || '80',
          style: user.subtitle_style || 'karaoke',
          font_family: user.subtitle_font_family || 'Anton',
          highlight_color: user.subtitle_highlight_color || '#FFFF00',
          highlight_enabled: user.subtitle_highlight_enabled !== false,
          outline_color: user.subtitle_outline_color || '#000000'
        };

        try {
          const { bot } = await import("./src/services/telegram.js");

          // Send loading message to track progress? For auto mode, usually silent until ready.
          
          console.log(`Processing clip ${clip.id} for auto-publish to ${telegramId}`);
          const processedUrl = await processClip(
            clip.id,
            clip.url,
            plaque ? plaque.image_url : null,
            null, // targetLang handled early if needed
            null, // detectedLang handled early if needed
            true, // skip s3 upload if local telegram send is fine 
            watermarkConfig,
            plaqueConfig,
            subtitleConfig
          );

          const videoSource = processedUrl.startsWith('http') ? { url: processedUrl } : { source: processedUrl };

          await bot.telegram.sendVideo(telegramId, videoSource, {
            caption: `🎬 **Автоматическая публикация**\n\n${clip.title}\n\n#auto`,
            parse_mode: 'Markdown'
          });

          // Cleanup local file if it's not a URL
          if (!processedUrl.startsWith('http')) {
            try {
              fs.unlinkSync(processedUrl);
              console.log(`[Auto] Cleaned up local file: ${processedUrl}`);
            } catch (cleanupErr) {
              console.warn(`[Auto] Failed to cleanup ${processedUrl}:`, cleanupErr);
            }
          }

          // Record publication
          await query(`
            INSERT INTO publications (clip_id, user_id, plaque_id, status)
            VALUES ($1, $2, $3, 'sent')
          `, [clip.id, telegramId, plaque ? plaque.id : null]);

          // Update last post
          await query("UPDATE users SET last_auto_post = NOW() WHERE telegram_id = $1", [telegramId]);
          
          console.log(`Successfully auto-published to ${telegramId}`);

        } catch (err: any) {
          console.error(`Error processing/sending auto-publish clip for user ${telegramId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Auto-publish check failed:", err);
  }
};

// Run auto-publish check every 5 minutes для более точного соблюдения лимитов
cron.schedule('*/5 * * * *', autoPublish);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize DB and Bot (Gracefully skip if config is missing)
  try {
    await initDb();
    console.log("Database initialized successfully.");
  } catch (err) {
    console.warn("Database initialization failed. Server starting in limited mode (Frontend only). Check .env file.");
  }

  // Vizard Fallback Handler
  const handleVizardFallback = async (videoId: string) => {
    try {
      await query("UPDATE videos SET status = 'vizard_fallback_running', error_message = 'Downloading video for S3 fallback...' WHERE id = $1", [videoId]);
      
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const downloaded = await downloadYouTubeVideo(videoUrl);
      
      if (!downloaded) {
        throw new Error("Failed to download video via yt-dlp");
      }

      const { filePath, fileName } = downloaded;
      const fileBuffer = fs.readFileSync(filePath);
      
      console.log(`[Vizard Fallback] Uploading ${fileName} to S3...`);
      const uploadResult = await uploadToS3(fileBuffer, fileName, 'video/mp4');
      
      const s3Url = uploadResult.Location;
      console.log(`[Vizard Fallback] S3 URL: ${s3Url}`);

      console.log(`[Vizard Fallback] Resending to Vizard with Direct URL...`);
      const newProjectId = await sendToVizard(s3Url, videoId, 1); // videoType 1 = Direct URL

      if (newProjectId) {
        await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard', error_message = 'Resent via S3 fallback' WHERE id = $2", [newProjectId, videoId]);
        console.log(`[Vizard Fallback] Success! New Project ID: ${newProjectId}`);
      } else {
        throw new Error("Failed to resend to Vizard after S3 upload");
      }

      // Cleanup local file
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error: any) {
      console.error(`[Vizard Fallback] Hard failure for ${videoId}:`, error.message);
      await query("UPDATE videos SET status = 'failed', error_message = $1 WHERE id = $2", 
        [`Fallback Failed: ${error.message}`, videoId]);
    }
  };

  // Vizard Polling Cron Job
  cron.schedule('*/2 * * * *', async () => {
    console.log("Polling Vizard for completed projects...");
    try {
      const sentVideos = await query("SELECT id, vizard_project_id FROM videos WHERE status = 'sent_to_vizard'");
      for (const v of sentVideos.rows) {
        if (!v.vizard_project_id) continue;

        const statusData = await getVizardProjectStatus(v.vizard_project_id);
        if (!statusData) {
          console.log(`No status data for project ${v.vizard_project_id}`);
          continue;
        }

        console.log(`Polling status for ${v.vizard_project_id}:`, JSON.stringify(statusData).substring(0, 500));

        // Assume format is like: { code: 0, videos: [{ videoUrl: '...', title: '...' }] }
        const clips = statusData.videos || statusData.data;
        const isSuccess = (statusData.code === 0 || statusData.code === 2000) && clips && Array.isArray(clips);
        const isPending = statusData.code === 1000 || statusData.code === 0 && (!clips || !Array.isArray(clips));
        const isError = !isSuccess && !isPending && statusData.code !== undefined;

        if (isError) {
          const errMsg = statusData.errMsg || statusData.message || "Unknown Vizard error";
          console.error(`[Vizard] Project ${v.vizard_project_id} failed with code ${statusData.code}: ${errMsg}`);
          
          if (statusData.code === 4008) {
            console.log(`[Vizard Fallback] Error 4008 detected for ${v.id}. Starting S3 fallback...`);
            handleVizardFallback(v.id);
            continue;
          }

          await query("UPDATE videos SET status = 'failed', error_message = $1 WHERE id = $2", 
            [`Vizard Error ${statusData.code}: ${errMsg}`, v.id]);
          continue;
        }

        if (isSuccess) {
          console.log(`Vizard project ${v.vizard_project_id} completed. Saving clips... count: ${clips.length}`);

          await query("UPDATE videos SET status = 'completed', error_message = NULL WHERE id = $1", [v.id]);

          // Get plaque to use for branding
          const plaqueResult = await query("SELECT * FROM ad_plaques LIMIT 1");
          const plaque = plaqueResult.rows[0];

          // Get final language logic
          const videoResult = await query("SELECT detected_language, target_language, transcript FROM videos WHERE id = $1", [v.id]);
          const video = videoResult.rows[0];
          
          let detLang = normalizeLang(video?.detected_language);
          const tarLang = normalizeLang(video?.target_language);

          // FALLBACK DETECTION: If detected_language is missing, try to detect it now from the transcript
          if (!detLang && video?.transcript) {
            console.log(`[Lang] Detected language missing for ${v.id}. Attempting fallback detection...`);
            detLang = await detectLanguage(video.transcript);
            if (detLang) {
              detLang = normalizeLang(detLang);
              await query("UPDATE videos SET detected_language = $1 WHERE id = $2", [detLang, v.id]);
              console.log(`[Lang] Fallback detection successful for ${v.id}: ${detLang}`);
            }
          }

          const finalLanguage = tarLang || detLang || null;
          const needsTranslation = tarLang && detLang && tarLang !== detLang;

          console.log(`[Lang] Decision for ${v.id}: Target=${tarLang}, Detected=${detLang}, NeedsTranslation=${needsTranslation}`);


          for (const c of clips) {
            // ALWAYS DO ORIGINAL CLIP FIRST
            const originalClipId = Math.random().toString(36).substr(2, 9);
            const originalTitle = c.title || "Vizard Clip";
            const originalTranscript = c.transcript || '';
            const originalLanguage = video?.detected_language || null;

            console.log(`Inserting original clip for project ${v.vizard_project_id}: ${originalTitle}`);
            await query(
              "INSERT INTO clips (id, video_id, url, title, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, 'raw', $7)",
              [originalClipId, v.id, c.videoUrl || c.url || c.video_url, originalTitle, c.thumbnail_url || '', originalTranscript, originalLanguage]
            );

            // No automatic plaques anymore. Raw means ready for user customization.
            await query("UPDATE clips SET status = 'processed' WHERE id = $1", [originalClipId]);

            // NOW DO DUBBED CLIP IF NEEDED
            if (needsTranslation && finalLanguage) {
              const dubbedClipId = Math.random().toString(36).substr(2, 9);
              let translatedTitle = originalTitle;
              let translatedTranscript = originalTranscript;

              console.log(`Translating clip metadata to ${finalLanguage}...`);
              const [tTitle, tTranscript] = await Promise.all([
                translateText(originalTitle, finalLanguage),
                translateText(originalTranscript, finalLanguage)
              ]);

              if (tTitle) translatedTitle = tTitle;
              if (tTranscript) translatedTranscript = tTranscript;

              console.log(`Inserting dubbed clip for project ${v.vizard_project_id}: ${translatedTitle}`);
              await query(
                "INSERT INTO clips (id, video_id, url, title, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, 'raw', $7)",
                [dubbedClipId, v.id, c.videoUrl || c.url || c.video_url, translatedTitle, c.thumbnail_url || '', translatedTranscript, finalLanguage]
              );

              // Process dubbed without plaque
              try {
                await processClip(
                  dubbedClipId,
                  c.videoUrl || c.url || c.video_url,
                  null, // No automatic plaque
                  finalLanguage,
                  originalLanguage
                );
              } catch (err) {
                console.error(`Error processing dubbed clip ${dubbedClipId}:`, err);
              }
            }
          }
        } else if (!isPending) {
          console.log(`Vizard project ${v.vizard_project_id} failed with code ${statusData.code}: ${statusData.errMsg || 'Unknown error'}`);
          await query("UPDATE videos SET status = 'rejected' WHERE id = $1", [v.id]);
        } else {
          console.log(`Project ${v.vizard_project_id} still in progress. Code: ${statusData.code}`);
        }
      }
    } catch (e) {
      console.error("Error pooling Vizard statuses", e);
    }
  });

  try {
    startBot();
    console.log("Telegram bot started.");
  } catch (err) {
    console.warn("Telegram bot failed to start. Check your TELEGRAM_BOT_TOKEN.");
  }

  // --- Auth Middleware (Optional for now, but good to have) ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // --- Deep Link Auth Endpoints ---
  app.get("/api/auth/init", async (req, res) => {
    const sessionId = uuidv4();
    try {
      await query("INSERT INTO auth_sessions (id, status) VALUES ($1, 'pending')", [sessionId]);
      res.json({ sessionId });
    } catch (err) {
      console.error("Auth init error:", err);
      res.status(500).json({ error: "Failed to init auth" });
    }
  });

  const isAdmin = (telegramId: string | number): boolean => {
    const tid = String(telegramId);
    if (tid === 'dev') return true;

    // Check plural IDs
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim());
    if (adminIds.includes(tid)) return true;

    // Check singular ID
    const singleAdminId = (process.env.ADMIN_TELEGRAM_ID || "").trim();
    if (singleAdminId && tid === singleAdminId) return true;

    return false;
  };

  app.get("/api/auth/check/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    try {
      const result = await query("SELECT * FROM auth_sessions WHERE id = $1", [sessionId]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Session not found" });

      const session = result.rows[0];
      if (session.status === 'authorized') {
        const userObj = {
          id: session.telegram_id,
          username: session.username,
          first_name: session.first_name,
          is_admin: isAdmin(session.telegram_id)
        };
        // Return JWT and clean up session (optional but safer)
        res.json({
          status: 'authorized',
          token: session.jwt,
          user: userObj
        });

        // Clean up session after successful retrieval
        await query("DELETE FROM auth_sessions WHERE id = $1", [sessionId]);
      } else {
        res.json({ status: 'pending' });
      }
    } catch (err) {
      console.error("Auth check error:", err);
      res.status(500).json({ error: "Check failed" });
    }
  });

  // Simple token verification / "Who am I" hydration
  app.get("/api/auth/check", authenticateToken, async (req: any, res) => {
    try {
      let userRes = await query("SELECT * FROM users WHERE telegram_id = $1", [String(req.user.id)]);

      if (userRes.rows.length === 0) {
        // Automatically insert the user to satisfy foreign key constraints across the DB
        await query(
          "INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING",
          [req.user.id, req.user.username, req.user.first_name]
        );
        // Refetch after insertion
        userRes = await query("SELECT * FROM users WHERE telegram_id = $1", [String(req.user.id)]);
      }

      const dbUser = userRes.rows[0];
      res.json({
        user: {
          ...req.user,
          ...dbUser,
          id: dbUser.telegram_id, // maintain frontend id
          is_admin: isAdmin(req.user.id)
        }
      });
    } catch (err) {
      console.error("Hydration Error:", err);
      res.json({
        user: {
          ...req.user,
          is_admin: isAdmin(req.user.id)
        }
      });
    }
  });

  app.post("/api/users/settings", authenticateToken, async (req: any, res) => {
    const {
      watermark_text, watermark_opacity, watermark_position,
      subtitle_enabled, subtitle_font_size, subtitle_font_color,
      subtitle_position, subtitle_style, subtitle_font_family,
      subtitle_highlight_color, subtitle_highlight_enabled, subtitle_outline_color,
      default_plaque_id, plaque_position, plaque_size, plaque_timerange,
      auto_mode_enabled, auto_mode_videos_per_day
    } = req.body;
    try {
      await query(`
        INSERT INTO users (
          telegram_id, username, first_name, watermark_text, watermark_opacity, watermark_position, 
          subtitle_enabled, subtitle_font_size, subtitle_font_color, subtitle_position, subtitle_style, subtitle_font_family,
          subtitle_highlight_color, subtitle_highlight_enabled, subtitle_outline_color, default_plaque_id, plaque_position, plaque_size, plaque_timerange,
          auto_mode_enabled, auto_mode_videos_per_day
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (telegram_id) DO UPDATE SET 
          watermark_text = EXCLUDED.watermark_text,
          watermark_opacity = EXCLUDED.watermark_opacity,
          watermark_position = EXCLUDED.watermark_position,
          subtitle_enabled = EXCLUDED.subtitle_enabled,
          subtitle_font_size = EXCLUDED.subtitle_font_size,
          subtitle_font_color = EXCLUDED.subtitle_font_color,
          subtitle_position = EXCLUDED.subtitle_position,
          subtitle_style = EXCLUDED.subtitle_style,
          subtitle_font_family = EXCLUDED.subtitle_font_family,
          subtitle_highlight_color = EXCLUDED.subtitle_highlight_color,
          subtitle_highlight_enabled = EXCLUDED.subtitle_highlight_enabled,
          subtitle_outline_color = EXCLUDED.subtitle_outline_color,
          default_plaque_id = EXCLUDED.default_plaque_id,
          plaque_position = EXCLUDED.plaque_position,
          plaque_size = EXCLUDED.plaque_size,
          plaque_timerange = EXCLUDED.plaque_timerange,
          auto_mode_enabled = EXCLUDED.auto_mode_enabled,
          auto_mode_videos_per_day = EXCLUDED.auto_mode_videos_per_day
      `, [
        String(req.user.id), req.user.username || '', req.user.first_name || '',
        watermark_text, watermark_opacity, watermark_position,
        subtitle_enabled, subtitle_font_size, subtitle_font_color,
        subtitle_position, subtitle_style, subtitle_font_family,
        subtitle_highlight_color, subtitle_highlight_enabled, subtitle_outline_color,
        default_plaque_id, plaque_position, plaque_size, plaque_timerange,
        auto_mode_enabled, auto_mode_videos_per_day
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error("Settings update error:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/auth/telegram", async (req, res) => {
    const { hash, ...data } = req.body;
    if (!hash) return res.status(400).json({ error: "No hash provided" });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(500).json({ error: "Bot token not configured" });

    const secretKey = crypto.createHash("sha256").update(token).digest();
    const dataCheckString = Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join("\n");

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return res.status(401).json({ error: "Invalid hash" });
    }

    const authDate = Number(data.auth_date);
    if (Date.now() / 1000 - authDate > 86400) {
      return res.status(401).json({ error: "Auth data expired" });
    }

    const adminStatus = isAdmin(data.id);
    const userPayload = { ...data, is_admin: adminStatus };
    const jwtToken = jwt.sign({ id: data.id, username: data.username, is_admin: adminStatus }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token: jwtToken, user: userPayload });
  });

  // Users Management
  app.get("/api/users", async (req, res) => {
    const result = await query("SELECT * FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  });

  app.post("/api/users/:id/authorize", async (req, res) => {
    const { id } = req.params;
    const { authorize } = req.body;
    await query("UPDATE users SET is_authorized = $1 WHERE telegram_id = $2", [authorize, id]);
    res.json({ success: true });
  });


  // Channels
  app.get("/api/channels", async (req, res) => {
    const result = await query("SELECT * FROM channels");
    res.json(result.rows);
  });

  app.post("/api/channels", async (req, res) => {
    const { channelUrl, monitoring_interval = 'daily', scrapeDays = 7 } = req.body;
    console.log("==> [API] /api/channels called with channelUrl:", channelUrl);

    const parsed = await getChannelIdFromUrl(channelUrl);
    console.log("==> [API] Parsed result:", parsed);

    if (!parsed) {
      return res.status(400).json({ error: "Invalid YouTube URL or Channel ID" });
    }

    let apifyUrl = channelUrl;
    if (parsed.id) {
      apifyUrl = `https://www.youtube.com/channel/${parsed.id}`;
    } else if (parsed.handle) {
      apifyUrl = `https://www.youtube.com/${parsed.handle}`;
    }

    try {
      const channelData = await getChannelInfo(apifyUrl);
      if (!channelData) {
        console.warn(`Apify failed to resolve channel for URL: ${apifyUrl}`);
        return res.status(404).json({ error: "Apify could not find this channel. Please make sure the URL is correct and public." });
      }

      const nextCheck = calculateNextCheck(monitoring_interval);
      await query(
        "INSERT INTO channels (id, name, handle, thumbnail, subscribers, monitoring_interval, next_check, scrape_days) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name = $2, handle = $3, thumbnail = $4, subscribers = $5, monitoring_interval = $6, next_check = $7, scrape_days = $8",
        [channelData.id, channelData.name, channelData.handle, channelData.thumbnail, channelData.subscribers, monitoring_interval, nextCheck, scrapeDays]
      );

      // Trigger immediate sync without waiting for client response
      syncChannel(channelData.id, channelData.name, monitoring_interval, scrapeDays, channelData.handle).catch(err => console.error("Immediate sync failed:", err));

      res.json({ success: true, channel: channelData.name });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch channel details via Apify" });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Manual cascade delete because schema might not have ON DELETE CASCADE
      const videos = await query("SELECT id FROM videos WHERE channel_id = $1", [id]);

      for (const video of videos.rows) {
        const clips = await query("SELECT id FROM clips WHERE video_id = $1", [video.id]);
        for (const clip of clips.rows) {

        }
        await query("DELETE FROM clips WHERE video_id = $1", [video.id]);
      }

      await query("DELETE FROM videos WHERE channel_id = $1", [id]);
      await query("DELETE FROM channels WHERE id = $1", [id]);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting channel:", err);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  // Vizard Webhooks
  app.post("/api/webhooks/vizard", async (req, res) => {
    try {
      // Vizard usually sends a payload with the project status and the generated clips.
      // E.g. { project_id: "...", status: "done", clips: [{ url: "...", duration: 15, title: "..." }] }
      console.log("==> [API] /api/webhooks/vizard received payload", JSON.stringify(req.body, null, 2));
      const payload = req.body;

      // Let's assume vizard payload has `project_id` or `id` and `clips` array when finished
      const projectId = payload.project_id || payload.id;
      if (!projectId) {
        return res.status(400).json({ error: "Missing project ID in webhook" });
      }

      // Find which video this project belongs to
      const videoResult = await query("SELECT id FROM videos WHERE vizard_project_id = $1", [projectId]);
      if (videoResult.rows.length === 0) {
        console.warn(`[API] Webhook received for unknown Vizard project ${projectId}`);
        return res.status(200).json({ message: "Unknown project, ignored." });
      }
      const videoId = videoResult.rows[0].id;

      // Update the videos table status to completed
      await query("UPDATE videos SET status = 'completed' WHERE id = $1", [videoId]);

      // If the webhook contains clips
      if (payload.clips && Array.isArray(payload.clips)) {
        for (const c of payload.clips) {
          const clipId = Math.random().toString(36).substr(2, 9); // Or use the id from vizard if available
          // Note: Adjust payload.title, payload.url based on the actual Vizard payload structure
          await query(
            "INSERT INTO clips (id, video_id, url, title, thumbnail, status) VALUES ($1, $2, $3, $4, $5, 'raw')",
            [clipId, videoId, c.url || c.video_url, c.title, c.thumbnail_url || '']
          );
        }
      } else if (payload.status === "done" && payload.video_url) {
        // fallback if it sends just one video/clip in the root object
        const clipId = Math.random().toString(36).substr(2, 9);
        await query(
          "INSERT INTO clips (id, video_id, url, title, thumbnail, status) VALUES ($1, $2, $3, $4, $5, 'raw')",
          [clipId, videoId, payload.video_url, payload.title || "Vizard Clip", payload.thumbnail_url || '']
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error handling Vizard webhook:", err);
      // We still return 200 so Vizard doesn't retry infinitely unless it's a critical error
      res.status(200).json({ error: "Processed with internal errors" });
    }
  });

  // Videos
  app.get("/api/videos", async (req, res) => {
    const result = await query("SELECT * FROM videos ORDER BY published_at DESC");
    res.json(result.rows);
  });

  // Trigger Monitoring & Transcript Fetching
  app.post("/api/monitor", async (req, res) => {
    const channelsResult = await query("SELECT * FROM channels");
    const results = [];

    for (const channel of channelsResult.rows) {
      try {
        const scrapeDays = channel.scrape_days ?? 0; // 0 means all/no limit
        let publishedAfter = undefined;
        if (scrapeDays > 0) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - scrapeDays);
          publishedAfter = pastDate.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'
        }

        const discoveredVideos = await getLatestVideos(`https://www.youtube.com/channel/${channel.id}/videos`, 10, publishedAfter);

        for (const item of discoveredVideos) {
          const videoId = item.id;
          if (!videoId) {
            console.warn(`Sync: Skipping video with missing ID: ${item.title}`);
            continue;
          }

          // STRICT DEDUPLICATION
          const existing = await query("SELECT id, status FROM videos WHERE id = $1", [videoId]);

          if (existing.rows.length > 0) {
            console.log(`Video ${videoId} already exists. Skipping.`);
            continue;
          }

          console.log(`Discovered NEW video: ${videoId}. Starting processing.`);

          try {
            await query(`
              INSERT INTO videos (id, channel_id, title, description, published_at, thumbnail)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              videoId,
              channel.id,
              item.title,
              item.description,
              item.publishedAt,
              item.thumbnail
            ]);

            // Automatically fetch transcript via Apify
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            // We do not await this immediately to avoid blocking other videos
            getTranscript(videoUrl).then(async (transcript) => {
              if (transcript) {
                await query("UPDATE videos SET transcript = $1 WHERE id = $2", [transcript, videoId]);
                console.log(`Evaluating transcript for video ${videoId}...`);
                const latestVideoResult = await query("SELECT * FROM videos WHERE id = $1", [videoId]);
                const v = latestVideoResult.rows[0];
                if (v && v.title) {
                  // We default targetAudience to blank or get it from elsewhere if needed. Since we don't have it here, we will just use a default string.
                  const evaluation = await evaluateContent(v.title, transcript, "Предприниматели, интересующиеся ИИ и автоматизацией");
                  if (evaluation) {
                    await query("UPDATE videos SET ai_score = $1, ai_evaluation = $2, detected_language = $3 WHERE id = $4", [evaluation.score, evaluation.evaluation, evaluation.detected_language, videoId]);
                    console.log(`Evaluation complete for ${videoId}: ${evaluation.score}%, Lang: ${evaluation.detected_language}`);
                  }
                }
              }
            }).catch(console.error);

            results.push(videoId);
          } catch (insertErr) {
            console.error(`Failed to handle discovery for ${videoId}:`, insertErr);
          }
        }
      } catch (error) {
        console.error(`Error monitoring channel ${channel.id}:`, error);
      }
    }
    res.json({ newVideos: results });
  });

  // AI Evaluation via OpenRouter
  app.post("/api/videos/:id/evaluate", async (req, res) => {
    const { id } = req.params;
    const { targetAudience } = req.body;
    const result = await query("SELECT * FROM videos WHERE id = $1", [id]);
    const video = result.rows[0];

    if (!video) return res.status(404).json({ error: "Video not found" });
    if (!video.transcript) return res.status(400).json({ error: "Transcript not available for evaluation" });

    try {
      const evaluation = await evaluateContent(video.title, video.transcript, targetAudience);

      if (evaluation) {
        await query("UPDATE videos SET ai_score = $1, ai_evaluation = $2, detected_language = $3 WHERE id = $4",
          [evaluation.score, evaluation.evaluation, evaluation.detected_language, id]);
        res.json(evaluation);
      } else {
        res.status(500).json({ error: "AI Evaluation failed" });
      }
    } catch (error) {
      console.error("AI Evaluation error:", error);
      res.status(500).json({ error: "AI Evaluation failed" });
    }
  });

  app.post("/api/videos/:id/complete", async (req, res) => {
    const { id } = req.params;
    try {
      await query("UPDATE videos SET status = 'completed' WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Error completing video:", err);
      res.status(500).json({ error: "Failed to mark video as completed" });
    }
  });

  // Approval & Vizard
  app.post("/api/videos/:id/approve", async (req, res) => {
    const { id } = req.params;
    const { target_language } = req.body;

    // Set to approved temporarily and update target language if requested
    await query("UPDATE videos SET status = 'approved', target_language = $2 WHERE id = $1", [id, target_language || null]);

    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const vizardId = await sendToVizard(videoUrl, id);

    if (vizardId) {
      await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard' WHERE id = $2", [vizardId, id]);
      res.json({ success: true, vizardId });
    } else {
      // Revert back to pending
      await query("UPDATE videos SET status = 'pending' WHERE id = $1", [id]);
      res.status(500).json({ error: "Failed to send to Vizard AI" });
    }
  });



  // Apply Plaque on Demand & Send to Telegram
  app.post("/api/clips/:id/apply-plaque", async (req, res) => {
    // 1. Manually decode token because middleware is scoped globally later down
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    let decodedUser: any;
    try {
      decodedUser = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    const user = decodedUser;
    if (!user || (!user.telegram_id && !user.id)) return res.status(401).json({ error: "Unauthorized payload" });

    const { id } = req.params;
    const { plaque_id } = req.body;

    try {
      const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
      if (clipRes.rows.length === 0) return res.status(404).json({ error: "Clip not found" });
      const clip = clipRes.rows[0];

      let plaqueImageUrl = null;
      if (plaque_id) {
        const plaqueRes = await query("SELECT * FROM ad_plaques WHERE id = $1", [plaque_id]);
        if (plaqueRes.rows.length === 0) return res.status(404).json({ error: "Plaque not found" });
        plaqueImageUrl = plaqueRes.rows[0].image_url;
      }

      // Import the bot directly here since it might have side effects on global if top-level
      const { bot } = await import("./src/services/telegram.js");

      // 3. Prepare watermark settings from Global DB Settings
      const telegramId = user.telegram_id || user.id;

      // Ensure user exists right here before grabbing settings, this fixes foreign key problems universally
      await query(`
        INSERT INTO users (telegram_id, username, first_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (telegram_id) DO NOTHING
      `, [telegramId, user.username || '', user.first_name || 'Worker']);

      const userRes = await query("SELECT * FROM users WHERE telegram_id = $1", [String(telegramId)]);
      const dbUser = userRes.rows[0] || {};

      const defaultText = user.username ? `@${user.username}` : user.first_name;
      // If dbUser.watermark_text is NULL but there IS a row, it could be empty string meaning turn it off. 
      // If it is strictly undefined/null we fall back to default text.
      const text = dbUser.watermark_text !== null && dbUser.watermark_text !== undefined
        ? dbUser.watermark_text
        : defaultText;

      const opacity = dbUser.watermark_opacity !== null && dbUser.watermark_opacity !== undefined
        ? parseFloat(dbUser.watermark_opacity)
        : 0.08;

      const position = dbUser.watermark_position || 'center';

      const subtitleConfig = {
        enabled: dbUser.subtitle_enabled !== false, // default true
        font_size: dbUser.subtitle_font_size ? parseFloat(dbUser.subtitle_font_size) : 16,
        font_color: dbUser.subtitle_font_color || '#FFFFFF',
        position: dbUser.subtitle_position || '80',
        style: dbUser.subtitle_style || 'karaoke',
        font_family: dbUser.subtitle_font_family || 'Anton',
        highlight_color: dbUser.subtitle_highlight_color || '#FFFF00',
        highlight_enabled: dbUser.subtitle_highlight_enabled !== false, // default true
        outline_color: dbUser.subtitle_outline_color || '#000000'
      };

      // Pass skipS3Upload = true and watermark object
      const watermarkConfig = text ? { text, opacity, position } : null;
      const plaqueConfig = {
        position: dbUser.plaque_position || 'top',
        size: dbUser.plaque_size ? Number(dbUser.plaque_size) : 80,
        timerange: dbUser.plaque_timerange ? Number(dbUser.plaque_timerange) : 0
      };
      const localFilePath = await processClip(id, clip.url, plaqueImageUrl, clip.language, null, true, watermarkConfig as any, plaqueConfig, subtitleConfig);

      // Now send via Telegram directly
      if (telegramId !== 'dev') {
        const fs = await import('fs');
        // Send via Telegram
        const message = await bot.telegram.sendVideo(telegramId, {
          source: fs.createReadStream(localFilePath)
        }, {
          caption: `🎥 ${clip.title}`
        });
        // 4. Log the publication
        // Defensive check already handled above.

        await query(`
          INSERT INTO publications (clip_id, user_id, plaque_id, message_id, status)
          VALUES ($1, $2, $3, $4, 'sent')
        `, [id, telegramId, plaque_id || null, message.message_id]);

        // Clean up the temporary file
        fs.unlinkSync(localFilePath);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Apply plaque error:", err);
      res.status(500).json({ error: "Failed to process video" });
    }
  });

  app.post("/api/clips/:id/carousel", async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    let decodedUser: any;
    try {
      decodedUser = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    const { id } = req.params;
    const telegramId = decodedUser.telegram_id || decodedUser.id;

    try {
      const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
      if (clipRes.rows.length === 0) return res.status(404).json({ error: "Clip not found" });
      const clip = clipRes.rows[0];

      // Use the raw video URL for screenshots to avoid processing overhead
      const screenshotPaths = await extractScreenshots(clip.url, id, 5);
      
      const { bot } = await import("./src/services/telegram.js");
      const fs = await import('fs');

      if (telegramId !== 'dev') {
        const mediaGroup = screenshotPaths.map((p, idx) => ({
          type: 'photo' as const,
          media: { source: fs.createReadStream(p) },
          caption: idx === 0 ? `🖼️ Карусель скриншотов: ${clip.title}` : undefined
        }));

        await bot.telegram.sendMediaGroup(telegramId, mediaGroup);

        // Cleanup screenshots
        screenshotPaths.forEach(p => fs.unlinkSync(p));
        const dir = path.dirname(screenshotPaths[0]);
        if (fs.existsSync(dir)) {
          try {
            fs.rmdirSync(dir);
          } catch (e) {
            console.error("Failed to remove screenshots directory:", e);
          }
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Carousel generation error:", err);
      res.status(500).json({ error: "Failed to generate carousel" });
    }
  });

  // Clips
  app.get("/api/clips", authenticateToken, async (req: any, res) => {
    try {
      const result = await query(`
        SELECT c.*, 
               EXISTS(SELECT 1 FROM publications WHERE clip_id = c.id AND user_id = $1) as published_by_me
        FROM clips c 
        ORDER BY created_at DESC
      `, [req.user.id]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch clips" });
    }
  });
  
  app.post("/api/clips/:id/reprocess", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { plaque_id, target_lang, source_lang } = req.body;

    try {
      const clipRes = await query("SELECT * FROM clips WHERE id = $1", [id]);
      if (clipRes.rows.length === 0) return res.status(404).json({ error: "Clip not found" });
      const clip = clipRes.rows[0];

      const videoRes = await query("SELECT * FROM videos WHERE id = $1", [clip.video_id]);
      const video = videoRes.rows[0];

      let plaqueImageUrl = null;
      if (plaque_id || clip.ad_plaque_id) {
        const pId = plaque_id || clip.ad_plaque_id;
        const plaqueRes = await query("SELECT * FROM ad_plaques WHERE id = $1", [pId]);
        if (plaqueRes.rows.length > 0) {
          plaqueImageUrl = plaqueRes.rows[0].image_url;
        }
      }

      const tLang = target_lang || clip.language || video?.target_language;
      const sLang = source_lang || video?.detected_language;

      console.log(`[Admin] Re-processing clip ${id} (TLang: ${tLang}, SLang: ${sLang})`);
      
      processClip(id, clip.url, plaqueImageUrl, tLang, sLang).catch(console.error);
      
      res.json({ success: true, message: "Re-processing started" });
    } catch (err) {
      console.error("Reprocess error:", err);
      res.status(500).json({ error: "Failed to re-process clip" });
    }
  });

  // Ad Plaques
  app.get("/api/ad-plaques", async (req, res) => {
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    let result;
    if (userId) {
      result = await query("SELECT * FROM ad_plaques WHERE user_id = $1 OR user_id IS NULL", [userId]);
    } else {
      result = await query("SELECT * FROM ad_plaques");
    }
    res.json(result.rows);
  });

  app.post("/api/ad-plaques", upload.single("file"), async (req, res) => {
    const { name, text, user_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const key = `ad-plaques/${file.originalname}`;
      const uploadResult = await uploadToS3(file.buffer, key, file.mimetype);
      // AWS SDK v3 may not return Location for non-AWS S3 providers
      let imageUrl = uploadResult.Location;
      if (!imageUrl) {
        const endpoint = process.env.S3_ENDPOINT || '';
        const bucket = process.env.S3_BUCKET_NAME || '';
        if (endpoint) {
          imageUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
        } else {
          imageUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
        }
      }
      const id = Math.random().toString(36).substr(2, 9);
      await query("INSERT INTO ad_plaques (id, name, image_url, text, user_id) VALUES ($1, $2, $3, $4, $5)", [id, name, imageUrl, text || '', user_id || null]);
      res.json({ id, imageUrl });
    } catch (error) {
      console.error("Error uploading to S3:", error);
      res.status(500).json({ error: "Failed to upload file to storage" });
    }
  });

  app.get("/api/config", (req, res) => {
    res.json({
      bot_username: process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || "YOUR_BOT_USERNAME"
    });
  });

  app.delete("/api/ad-plaques/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Nullify all foreign key references before deleting
      await query("UPDATE publications SET plaque_id = NULL WHERE plaque_id = $1", [id]);
      await query("UPDATE users SET default_plaque_id = NULL WHERE default_plaque_id = $1", [id]);
      await query("UPDATE clips SET ad_plaque_id = NULL WHERE ad_plaque_id = $1", [id]);
      await query("DELETE FROM ad_plaques WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting plaque:", err);
      res.status(500).json({ error: "Failed to delete plaque" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
  }

  // Fetch all publications for admins
  app.get('/api/admin/publications', authenticateToken, async (req, res) => {
    if (!isAdmin(req.user.id)) return res.sendStatus(403);
    try {
      const result = await query(`
        SELECT p.*, u.username, u.first_name, c.title as clip_title, c.thumbnail as clip_thumbnail
        FROM publications p
        JOIN users u ON p.user_id = u.telegram_id
        JOIN clips c ON p.clip_id = c.id
        ORDER BY p.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch publications" });
    }
  });

  // Get all users (Admin only)
  app.get('/api/users', authenticateToken, async (req, res) => {
    if (!isAdmin(req.user.id)) return res.sendStatus(403);
    try {
      const result = await query(`
        SELECT
          u.*,
          COUNT(p.id)::int as publication_count,
          COALESCE(
            (SELECT array_agg(link) FROM (SELECT unnest(social_links) as link FROM publications WHERE user_id = u.telegram_id) as links),
            '{}'
          ) as published_links
        FROM users u
        LEFT JOIN publications p ON u.telegram_id = p.user_id
        GROUP BY u.telegram_id
        ORDER BY u.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin Statistics
  app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    if (!isAdmin(req.user.id)) return res.sendStatus(403);
    try {
      const stats = await query(`
        SELECT 
          (SELECT COUNT(DISTINCT user_id) FROM publications WHERE status = 'published' AND array_length(social_links, 1) > 0) as reporting_users,
          (SELECT COUNT(id) FROM publications WHERE status = 'published' AND array_length(social_links, 1) > 0) as total_published_videos
      `);

      const topClips = await query(`
        SELECT c.id, c.title, c.thumbnail, COUNT(p.id) as publish_count
        FROM publications p
        JOIN clips c ON p.clip_id = c.id
        WHERE p.status = 'published' AND array_length(p.social_links, 1) > 0
        GROUP BY c.id, c.title, c.thumbnail
        ORDER BY publish_count DESC
        LIMIT 10
      `);

      res.json({
        reporting_users: parseInt(stats.rows[0].reporting_users) || 0,
        total_published_videos: parseInt(stats.rows[0].total_published_videos) || 0,
        top_clips: topClips.rows.map((row: any) => ({
          ...row,
          publish_count: parseInt(row.publish_count) || 0
        }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // --- Carousel Styles ---
  app.get("/api/carousel/styles", authenticateToken, async (req: any, res) => {
    try {
      // Hardcoded templates from instacarousel-ai
      const templates = [
        {
          id: 'ios-notes',
          name: 'iOS Notes',
          image_url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=400', // Paper/Note aesthetic
          analysis: { prompt: "Aesthetic: iOS Notes app. Background: Light cream/off-white paper texture. Typography: Clean system sans-serif (Inter). Accents: Subtle yellow highlights. Layout: Minimalist, organized." }
        },
        {
          id: 'dark-luxury',
          name: 'Dark Luxury',
          image_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400', // Dark/Luxury aesthetic
          analysis: { prompt: "Aesthetic: Premium Dark Minimalist. Background: Pure black (#000000). Typography: High-contrast white. Mix of bold sans-serif and elegant italic serifs. Layout: Spacious, high-end feel." }
        },
        {
          id: 'cyber-brutalist',
          name: 'Cyber Brutalist',
          image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400', // Cyber/Tech aesthetic
          analysis: { prompt: "Aesthetic: Modern Cyber Brutalist. Background: Dark charcoal. Typography: Bold sans-serif and Monospace. Accents: Neon green or electric blue. Layout: Thick borders, edgy." }
        }
      ];

      const result = await query("SELECT * FROM carousel_styles WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC", [String(req.user.id)]);
      res.json([...templates, ...result.rows]);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch styles" });
    }
  });

  app.post("/api/carousel/styles/analyze", authenticateToken, async (req: any, res) => {
    // Both ENV and DB check for is_admin
    const user = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [String(req.user.id)]);
    const isAdminDb = user.rows[0]?.is_admin || req.user.is_admin;
    
    if (!isAdminDb) return res.status(403).json({ error: "Only admins can analyze styles" });
    
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Image reference required" });

    try {
      const analysis = await analyzeStyle(image);
      res.json(analysis);
    } catch (err) {
      console.error("Style analysis failed:", err);
      res.status(500).json({ error: "Style analysis failed" });
    }
  });

  app.post("/api/carousel/styles", authenticateToken, async (req: any, res) => {
    const { name, image_url, analysis, is_global } = req.body;
    try {
      const user = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [String(req.user.id)]);
      const isAdminDb = user.rows[0]?.is_admin || req.user.is_admin;
      
      const userId = (is_global && isAdminDb) ? null : String(req.user.id);
      
      const result = await query(
        "INSERT INTO carousel_styles (user_id, name, image_url, analysis) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, name, image_url, analysis]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed to save style" });
    }
  });

  app.delete("/api/carousel/styles/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      const styleRes = await query("SELECT user_id FROM carousel_styles WHERE id = $1", [id]);
      if (styleRes.rows.length === 0) return res.status(404).json({ error: "Style not found" });
      
      const style = styleRes.rows[0];
      const userCheck = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [String(req.user.id)]);
      const isAdminDb = userCheck.rows[0]?.is_admin || req.user.is_admin;

      if (!isAdminDb && style.user_id !== String(req.user.id)) {
        return res.status(403).json({ error: "Not authorized to delete this style" });
      }

      await query("DELETE FROM carousel_styles WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete style" });
    }
  });

  // --- Carousel Generation ---
  app.post("/api/carousel/generate", authenticateToken, async (req: any, res) => {
    const { clipId, styleId, topic, targetAudience } = req.body;
    
    try {
      const clipRes = await query("SELECT transcript, title FROM clips WHERE id = $1", [clipId]);
      if (clipRes.rows.length === 0) return res.status(404).json({ error: "Clip not found" });
      const { transcript, title } = clipRes.rows[0];

      let analysis: any;
      if (['ios-notes', 'dark-luxury', 'cyber-brutalist'].includes(styleId)) {
        const templates: any = {
          'ios-notes': { prompt: "Aesthetic: iOS Notes app. Background: Light cream/off-white paper texture. Typography: Clean system sans-serif (Inter). MANDATORY: Every single slide (all 6 squares in the grid) must independently feature the iOS interface: a 'Done' button in the top right, and the bottom icon menu (checklist icon, etc.). Accents: Subtle yellow highlights. Layout: Minimalist, organized, curated digital note." },
          'dark-luxury': { prompt: "Aesthetic: Premium Dark Minimalist. Background: Pure black (#000000). Typography: High-contrast white. Mix of bold sans-serif and elegant italic serifs. Layout: Thin dividers, spacious, high-end fashion magazine feel." },
          'cyber-brutalist': { prompt: "Aesthetic: Modern Cyber Brutalist. Background: Dark charcoal. Typography: Bold sans-serif and Monospace. Accents: Neon green or electric blue. Layout: Thick borders, aggressive headings, technical and edgy." }
        };
        analysis = templates[styleId];
      } else {
        const styleRes = await query("SELECT analysis FROM carousel_styles WHERE id = $1", [styleId]);
        if (styleRes.rows.length === 0) return res.status(404).json({ error: "Style not found" });
        analysis = styleRes.rows[0].analysis;
      }

      const carouselRes = await query(
        "INSERT INTO carousels (clip_id, user_id, status) VALUES ($1, $2, 'generating') RETURNING id",
        [clipId, String(req.user.id)]
      );
      const carouselId = carouselRes.rows[0].id;

      // Background pipeline
      (async () => {
        try {
          // Detect language
          const detectedLang = await detectLanguage(transcript) || 'ru';
          console.log(`Detected language for carousel ${carouselId}: ${detectedLang}`);

          const script = await generateCarouselScript(transcript, topic || title, styleId, detectedLang, targetAudience);
          const gridUrl = await generateGridImage(script, analysis);
          
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'carousels');
          const slices = await sliceCarouselGrid(gridUrl, uploadsDir);
          
          await query(
            "UPDATE carousels SET script = $1, image_url = $2, slides = $3, status = 'ready' WHERE id = $4",
            [JSON.stringify(script), gridUrl, slices, carouselId]
          );

          // Notify user via Telegram
          const absoluteSlices = slices.map(s => path.join(process.cwd(), 'public', s));
          await sendCarouselToTelegram(String(req.user.id), absoluteSlices);
        } catch (err: any) {
          console.error(`Carousel ${carouselId} failed:`, err);
          await query("UPDATE carousels SET status = 'error', error_message = $1 WHERE id = $2", [err.message, carouselId]);
        }
      })();

      res.json({ carouselId, status: 'generating' });
    } catch (err) {
      console.error("Carousel generation start failed:", err);
      res.status(500).json({ error: "Failed to start generation" });
    }
  });

  app.get("/api/carousel/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      const result = await query("SELECT * FROM carousels WHERE id = $1", [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Carousel not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch carousel" });
    }
  });


  // SPA fallback (Redirect all non-API routes to index.html)
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
