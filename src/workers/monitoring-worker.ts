import cron from "node-cron";
import { query } from "../lib/db.js";
import { getTranscript, getLatestVideos, getChannelInfo } from "../services/apify.js";
import { evaluateContent } from "../services/gemini.js";
import { videoProcessingQueue } from "../lib/queues.js";

export function calculateNextCheck(interval: string): Date {
  const now = new Date();
  if (interval === 'weekly') {
    now.setDate(now.getDate() + 7);
  } else if (interval === 'daily') {
    now.setDate(now.getDate() + 1);
  } else {
    now.setFullYear(now.getFullYear() + 10);
  }
  return now;
}

export const syncChannel = async (channelId: string, name: string, monitoringInterval: string, scrapeDays: number = 7, handle?: string) => {
  console.log(`Syncing channel: ${name} (${channelId}) - Handle: ${handle || 'N/A'}`);
  try {
    await query("UPDATE channels SET sync_status = 'syncing', sync_error = NULL WHERE id = $1", [channelId]);
    
    // Refresh channel metadata (name, thumbnail, subscribers)
    const searchUrl = handle ? `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}` : `https://www.youtube.com/channel/${channelId}`;
    try {
      const channelInfo = await getChannelInfo(searchUrl);
      if (channelInfo) {
        await query(`
          UPDATE channels SET 
            name = $1, 
            thumbnail = $2, 
            subscribers = $3,
            handle = $4
          WHERE id = $5
        `, [channelInfo.name, channelInfo.thumbnail, channelInfo.subscribers, channelInfo.handle || handle, channelId]);
      }
    } catch (metaErr) {
      console.warn(`Failed to refresh metadata for ${channelId}:`, metaErr);
    }

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
    await query("UPDATE channels SET last_checked = CURRENT_TIMESTAMP, next_check = $1, sync_status = 'idle' WHERE id = $2", [nextCheck, channelId]);
  } catch (err: any) {
    console.error(`Sync error for ${channelId}:`, err);
    await query("UPDATE channels SET sync_status = 'error', sync_error = $1 WHERE id = $2", [err.message, channelId]);
  }
};

export const monitorChannels = async () => {
  console.log("Running scheduled monitoring check...");
  const channels = await query("SELECT * FROM channels WHERE next_check <= CURRENT_TIMESTAMP OR next_check IS NULL");

  for (const channel of channels.rows) {
    if (channel.monitoring_interval === 'manual') continue;
    await videoProcessingQueue.add(`sync-${channel.id}`, {
      type: 'sync-channel',
      data: {
        channelId: channel.id,
        name: channel.name,
        interval: channel.monitoring_interval,
        scrapeDays: channel.scrape_days,
        handle: channel.handle
      }
    });
  }
};

export function initMonitoringWorker() {
  // Run every hour
  cron.schedule('0 * * * *', monitorChannels);
}
