import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { processClip } from "../services/processor.js";
import { query } from "../lib/db.js";
import { ensurePlayableClipUrl, isTemporaryVizardUrl } from "../services/vizard.js";

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
      const currentRes = await query("SELECT status, title, url FROM clips WHERE id = $1", [clipId]);
      const currentClip = currentRes.rows[0];
      const clipTitle = currentClip?.title || 'Видео';
      const reusableProcessedVideo = currentClip?.status === 'processed' && currentClip?.url && !isTemporaryVizardUrl(currentClip.url);

      if (reusableProcessedVideo) {
        console.log(`[Worker: Rendering] Clip ${clipId} is already processed. Reusing existing file.`);

        if (telegramId && telegramId !== 'dev') {
          const { sendClipToTelegram } = await import("../services/telegram.js");
          await sendClipToTelegram(String(telegramId), {
            id: clipId,
            title: clipTitle,
            url: currentClip.url
          });
        }

        return { success: true, url: currentClip.url };
      }

      const playableSourceUrl = await ensurePlayableClipUrl(clipId, currentClip?.url || videoUrl);
      if (!playableSourceUrl) {
        throw new Error(`No playable source URL found for clip ${clipId}`);
      }

      await query("UPDATE clips SET status = 'processing' WHERE id = $1", [clipId]);
      
      const resultUrl = await processClip(
        clipId,
        playableSourceUrl,
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
        const { sendClipToTelegram } = await import("../services/telegram.js");
        await sendClipToTelegram(String(telegramId), {
          id: clipId,
          title: clipTitle,
          url: resultUrl
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
    lockDuration: 600000, // 10 minutes
    stalledInterval: 300000, // Check for stalled jobs every 5 minutes
    maxStalledCount: 1,
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
