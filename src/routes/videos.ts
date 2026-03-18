import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { VideoManager } from "../services/video-manager.js";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user ? String(req.user.id) : undefined;
    const isAdmin = req.user?.is_admin || false;
    const videos = await VideoManager.getAllVideos(userId, isAdmin);
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

router.post("/manual", authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    const userId = String(req.user!.id);
    const result = await VideoManager.addManualVideo(url, userId);
    res.json(result);
  } catch (error) {
    console.error("Manual add error:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/evaluate", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAudience } = req.body;
    const evaluation = await VideoManager.evaluateVideo(id, String(req.user!.id), req.user?.is_admin || false, targetAudience);
    res.json(evaluation);
  } catch (error) {
    console.error("AI Evaluation error:", error);
    res.status(error.message === "Video not found" ? 404 : 500).json({ error: error.message });
  }
});

router.post("/:id/approve", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_language } = req.body;
    const vizardId = await VideoManager.approveVideo(id, String(req.user!.id), req.user?.is_admin || false, target_language);
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

router.post("/:id/toggle-public", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;
    await VideoManager.togglePublic(id, isPublic);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle video visibility" });
  }
});

router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await VideoManager.deleteVideo(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;
