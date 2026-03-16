import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { processClip } from "../services/processor.js";
import { query } from "../lib/db.js";

interface RenderingJobData {
  clipId: string;
  videoUrl: string;
  plaqueImageUrl: string | null;
  targetLang?: string | null;
  sourceLang?: string | null;
  watermarkConfig?: any;
  plaqueConfig?: any;
  subtitleConfig?: any;
  videoFolderName?: string;
  telegramId?: string;
  user?: any;
}

export const renderingWorker = new Worker(
  "rendering",
  async (job: Job<RenderingJobData>) => {
    const { 
      clipId, videoUrl, plaqueImageUrl, targetLang, sourceLang, 
      watermarkConfig, plaqueConfig, subtitleConfig, videoFolderName,
      telegramId, user 
    } = job.data;
    
    console.log(`[Worker: Rendering] Processing clip ${clipId} (Job: ${job.id})`);
    
    try {
      await query("UPDATE clips SET status = 'processing' WHERE id = $1", [clipId]);
      
      const resultUrl = await processClip(
        clipId,
        videoUrl,
        plaqueImageUrl,
        targetLang,
        sourceLang,
        false, // skipS3Upload
        watermarkConfig,
        plaqueConfig,
        subtitleConfig,
        videoFolderName
      );
      
      console.log(`[Worker: Rendering] Successfully processed ${clipId}: ${resultUrl}`);

      if (telegramId && telegramId !== 'dev') {
        const { bot } = await import("../services/telegram.js");
        const { PreviewGenerator } = await import("../services/preview-generator.js");
        const fs = await import("fs");

        // We need the local file path if we want to send to Telegram directly, 
        // but processClip currently uploads to S3 and deletes local file if skipS3Upload is false.
        // Let's modify processClip or handle it here.
        // For now, let's assume we can send via URL if it's on S3.
        
        const clipRes = await query("SELECT title FROM clips WHERE id = $1", [clipId]);
        const clip = clipRes.rows[0];

        let videoThumb: any = undefined;
        try {
           const thumbBuffer = await PreviewGenerator.generateFontHook(clip.title);
           if (thumbBuffer) videoThumb = { source: thumbBuffer };
        } catch (e) {}

        const message = await bot.telegram.sendVideo(telegramId, resultUrl, { 
            caption: `⬜️ ${clip.title}`,
            thumbnail: videoThumb,
            width: 1080,
            height: 1920,
            supports_streaming: true,
            reply_markup: {
              inline_keyboard: [
                [{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_temp` }]
              ]
            }
        });

        const pubRes = await query(
            "INSERT INTO publications (clip_id, user_id, plaque_id, message_id, status) VALUES ($1, $2, $3, $4, 'sent') RETURNING id", 
            [clipId, String(telegramId), null, message.message_id]
        );
        const publicationId = pubRes.rows[0].id;

        await bot.telegram.editMessageReplyMarkup(telegramId, message.message_id, undefined, {
            inline_keyboard: [
              [{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_${publicationId}` }]
            ]
        });
      }

      return { success: true, url: resultUrl };
    } catch (err: any) {
      console.error(`[Worker: Rendering] Failed ${clipId}:`, err.message);
      await query("UPDATE clips SET status = 'failed' WHERE id = $1", [clipId]);
      throw err; // Allow BullMQ to handle retries
    }
  },
  {
    connection: redisConnection as any,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2"),
    limiter: {
        max: 5,
        duration: 1000
    }
  }
);

renderingWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed!`);
});

renderingWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
});
