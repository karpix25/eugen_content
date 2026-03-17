import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export { redisConnection };

// Common configuration for all queues
const defaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: 1000,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  // Increase lock duration to 15 minutes to prevent Stall detection for heavy jobs
  lockDuration: 900000, 
  stalledInterval: 600000,
};

export const videoProcessingQueue = new Queue("video-processing", {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const renderingQueue = new Queue("rendering", {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const scheduledJobsQueue = new Queue("scheduled-jobs", {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const publishingQueue = new Queue("publishing", {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const carouselQueue = new Queue("carousel", {
  connection: redisConnection as any,
  defaultJobOptions,
});

export const plaqueQueue = new Queue("plaque", {
  connection: redisConnection as any,
  defaultJobOptions,
});

console.log("🚀 BullMQ Queues initialized");
