import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { syncChannel } from "./monitoring-worker.js";
import { autoSendToVizard, pollVizardStatus } from "./vizard-worker.js";

export const videoProcessingWorker = new Worker(
  "video-processing",
  async (job: Job) => {
    const { type, data } = job.data;
    
    console.log(`[Worker: VideoProcessing] Task: ${type} (Job: ${job.id})`);
    
    switch (type) {
      case 'sync-channel':
        await syncChannel(data.channelId, data.name, data.interval, data.scrapeDays, data.handle);
        break;
      case 'auto-vizard':
        await autoSendToVizard();
        break;
      case 'poll-vizard':
        await pollVizardStatus();
        break;
      default:
        console.warn(`Unknown job type: ${type}`);
    }
  },
  {
    connection: redisConnection as any,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2") * 2,
  }
);
