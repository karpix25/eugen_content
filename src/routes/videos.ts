import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { VideoManager } from "../services/video-manager.js";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const videos = await VideoManager.getAllVideos();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.post("/monitor", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const newVideos = await VideoManager.monitorChannels();
    res.json({ newVideos });
  } catch (error) {
    console.error("Monitor error:", error);
    res.status(500).json({ error: "Monitoring failed" });
  }
});

router.post("/:id/evaluate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAudience } = req.body;
    const evaluation = await VideoManager.evaluateVideo(id, targetAudience);
    res.json(evaluation);
  } catch (error) {
    console.error("AI Evaluation error:", error);
    res.status(error.message === "Video not found" ? 404 : 500).json({ error: error.message });
  }
});

router.post("/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_language } = req.body;
    const vizardId = await VideoManager.approveVideo(id, target_language);
    res.json({ success: true, vizardId });
  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/complete", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await VideoManager.markCompleted(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark video as completed" });
  }
});

export default router;
