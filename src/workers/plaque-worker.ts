import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/queues.js";
import { generatePlaqueImage } from "../services/gemini.js";
import { query } from "../lib/db.js";

interface PlaqueJobData {
  plaqueId: string;
  topic: string;
  name: string;
}

export const plaqueWorker = new Worker(
  "plaque",
  async (job: Job<PlaqueJobData>) => {
    const { plaqueId, topic, name } = job.data;
    console.log(`[Worker: Plaque] Generating plaque ${plaqueId} for topic: ${topic}`);
    
    try {
      const imageUrl = await generatePlaqueImage(topic);
      
      await query(
        "UPDATE ad_plaques SET image_url = $1, status = 'preview' WHERE id = $2",
        [imageUrl, plaqueId]
      );
      
      console.log(`[Worker: Plaque] Successfully generated ${plaqueId}`);
      return { success: true, imageUrl };
    } catch (err: any) {
      console.error(`[Worker: Plaque] Failed ${plaqueId}:`, err.message);
      
      await query(
        "UPDATE ad_plaques SET status = 'failed', error_message = $1 WHERE id = $2",
        [err.message, plaqueId]
      );
      
      throw err;
    }
  },
  { 
    connection: redisConnection as any, 
    concurrency: 1 // Image generation is heavy, limit concurrency
  }
);
