import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { createServer as createViteServer } from "vite";
import { query, initDb } from "./src/lib/db.js";
import { bot, startBot } from "./src/services/telegram.js";

// Routes
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/users.js";
import channelRoutes from "./src/routes/channels.js";
import videoRoutes from "./src/routes/videos.js";
import clipRoutes from "./src/routes/clips.js";
import assetsRoutes from "./src/routes/plaques.js"; // Plaques and Fonts
import carouselRoutes from "./src/routes/carousels.js";

// Workers
import { initMonitoringWorker } from "./src/workers/monitoring-worker.js";
import { initVizardWorker } from "./src/workers/vizard-worker.js";
import { initPublishWorker } from "./src/workers/publish-worker.js";

const PORT = Number(process.env.PORT) || 3001;

async function startServer() {
  // Initialize Database
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/channels", channelRoutes);
  app.use("/api/videos", videoRoutes);
  app.use("/api/clips", clipRoutes);
  app.use("/api", assetsRoutes); // Plaques and Fonts are under /api directly
  app.use("/api/carousel", carouselRoutes);

  app.get("/api/config", (req, res) => {
    res.json({
      bot_username: process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || "YOUR_BOT_USERNAME"
    });
  });

  // Init Workers
  initMonitoringWorker();
  initVizardWorker();
  initPublishWorker(bot);

  // Start Telegram Bot
  startBot();

  // Bot initialization log
  console.log(`🚀 Telegram Bot initialized with token: ${process.env.TELEGRAM_BOT_TOKEN?.substring(0, 5)}...`);

  // Vite/Static middleware
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
