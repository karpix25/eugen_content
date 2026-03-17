import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/queues.js";
import { CarouselService } from "../services/CarouselService.js";

interface CarouselJobData {
  carouselId: string;
  clipId: string;
  userId: string;
  styleId: string;
  topic?: string;
  targetAudience?: string;
}

export const carouselWorker = new Worker(
  "carousel",
  async (job: Job<CarouselJobData>) => {
    const { carouselId, clipId, userId, styleId, topic, targetAudience } = job.data;
    console.log(`[Worker: Carousel] Generating carousel ${carouselId} for clip ${clipId}`);
    
    try {
      await CarouselService.generateCarousel({
        carouselId,
        clipId,
        userId,
        styleId,
        topic,
        targetAudience
      });
      console.log(`[Worker: Carousel] Successfully generated ${carouselId}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[Worker: Carousel] Failed ${carouselId}:`, err.message);
      throw err;
    }
  },
  { 
    connection: redisConnection as any, 
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2"),
    lockDuration: 600000, // 10 minutes
    stalledInterval: 300000, // Check for stalled jobs every 5 minutes
    maxStalledCount: 1,
  }
);
