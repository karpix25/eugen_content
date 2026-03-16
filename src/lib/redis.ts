import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Critical for BullMQ
});

redisConnection.on("error", (err) => {
  console.error("Redis Connection Error:", err);
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected");
});
