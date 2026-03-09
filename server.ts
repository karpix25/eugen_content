import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

import { query, initDb } from "./src/lib/db.js";
import { s3Client, uploadToS3 } from "./src/lib/s3.js";
import { getTranscript, getChannelInfo, getLatestVideos } from "./src/services/apify.js";
import { evaluateContent, translateText } from "./src/services/openrouter.js";
import { sendToVizard, getVizardProjectStatus } from "./src/services/vizard.js";
import { startBot } from "./src/services/telegram.js";
import { processClip } from "./src/services/processor.js";
import cron from "node-cron";
import crypto from "crypto";
import jwt from "jsonwebtoken";

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
app.use(express.json());
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

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize DB and Bot (Gracefully skip if config is missing)
  try {
    await initDb();
    console.log("Database initialized successfully.");
  } catch (err) {
    console.warn("Database initialization failed. Server starting in limited mode (Frontend only). Check .env file.");
  }

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

        if (isSuccess) {
          console.log(`Vizard project ${v.vizard_project_id} completed. Saving clips... count: ${clips.length}`);

          await query("UPDATE videos SET status = 'completed' WHERE id = $1", [v.id]);

          // Get plaque to use for branding
          const plaqueResult = await query("SELECT * FROM ad_plaques LIMIT 1");
          const plaque = plaqueResult.rows[0];

          // Get final language logic
          const videoResult = await query("SELECT detected_language, target_language FROM videos WHERE id = $1", [v.id]);
          const video = videoResult.rows[0];
          const finalLanguage = video?.target_language || video?.detected_language || null;
          const needsTranslation = video?.target_language && video?.detected_language && video.target_language !== video.detected_language;


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
              processClip(
                dubbedClipId,
                c.videoUrl || c.url || c.video_url,
                null, // No automatic plaque
                finalLanguage,
                originalLanguage
              ).catch(console.error);
            }
          }
        } else if (statusData.status === 'failed' || statusData.state === 'failed' || statusData.code === -1) {
          console.log(`Vizard project ${v.vizard_project_id} failed.`);
          await query("UPDATE videos SET status = 'rejected' WHERE id = $1", [v.id]);
        } else {
          console.log(`Project ${v.vizard_project_id} still in progress or unknown response format. Code: ${statusData.code}`);
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
    if (String(telegramId) === 'dev') return true;
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim());
    return adminIds.includes(String(telegramId));
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

  // Tasks
  app.get("/api/tasks", async (req, res) => {
    const result = await query(`
      SELECT tasks.*, clips.url as clip_url, clips.thumbnail as clip_thumbnail, clips.title as clip_title 
      FROM tasks 
      JOIN clips ON tasks.clip_id = clips.id
      ORDER BY tasks.created_at DESC
    `);
    res.json(result.rows);
  });

  app.post("/api/tasks", async (req, res) => {
    const { clip_id, description } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    await query("INSERT INTO tasks (id, clip_id, description) VALUES ($1, $2, $3)", [id, clip_id, description]);
    res.json({ id });
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
          await query("DELETE FROM tasks WHERE clip_id = $1", [clip.id]);
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

  // Vizard Webhook
  app.post("/api/webhooks/vizard", async (req, res) => {
    const { external_id, clips } = req.body;
    const videoId = external_id;

    // Get plaque to use for branding (for now, take first available or allow selection in UI)
    const plaqueResult = await query("SELECT * FROM ad_plaques LIMIT 1");
    const plaque = plaqueResult.rows[0];

    // Get the video info to see if we need dubbing
    const videoResult = await query("SELECT detected_language, target_language FROM videos WHERE id = $1", [videoId]);
    const video = videoResult.rows[0];

    const finalLanguage = video?.target_language || video?.detected_language || null;

    for (const clip of clips) {
      const clipId = Math.random().toString(36).substr(2, 9);
      await query(`
        INSERT INTO clips (id, video_id, url, thumbnail, title, ad_plaque_id, language)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [clipId, videoId, clip.url, clip.thumbnail, clip.title, plaque?.id, finalLanguage]);

      // Start asynchronous processing (branding + dubbing + subs)
      if (plaque || (video?.detected_language && video?.target_language)) {
        processClip(clipId, clip.url, plaque?.image_url || null, video?.target_language, video?.detected_language).catch(console.error);
      } else {
        // No branding, just mark as processed/raw
        await query("UPDATE clips SET status = 'processed' WHERE id = $1", [clipId]);
      }
    }

    await query("UPDATE videos SET status = 'completed' WHERE id = $1", [videoId]);
    res.json({ received: true });
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

      // 3. Prepare watermark text
      const watermarkText = user.username ? `@${user.username}` : user.first_name;

      // Pass skipS3Upload = true and watermarkText
      const localFilePath = await processClip(id, clip.url, plaqueImageUrl, null, null, true, watermarkText);

      // Now send via Telegram directly
      const telegramId = user.telegram_id || user.id;
      if (telegramId !== 'dev') {
        const fs = await import('fs');
        // Send via Telegram
        const message = await bot.telegram.sendVideo(telegramId, {
          source: fs.createReadStream(localFilePath)
        }, {
          caption: `🎥 ${clip.title}`
        });

        // 4. Log the publication
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

  // Clips
  app.get("/api/clips", async (req, res) => {
    const result = await query("SELECT * FROM clips ORDER BY created_at DESC");
    res.json(result.rows);
  });

  // Ad Plaques
  app.get("/api/ad-plaques", async (req, res) => {
    const userId = req.query.user_id as string;
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
      const imageUrl = await uploadToS3(file.buffer, `ad-plaques/${file.originalname}`, file.mimetype);
      const id = Math.random().toString(36).substr(2, 9);
      await query("INSERT INTO ad_plaques (id, name, image_url, text, user_id) VALUES ($1, $2, $3, $4, $5)", [id, name, imageUrl, text, user_id || null]);
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
    await query("DELETE FROM ad_plaques WHERE id = $1", [id]);
    res.json({ success: true });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
