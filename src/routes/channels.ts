import { Router } from "express";
import { query } from "../lib/db.js";
import { authenticateToken, isAdmin, requireAdmin } from "../middleware/auth.js";
import { syncChannel } from "../workers/monitoring-worker.js";

const router = Router();

router.get("/", authenticateToken, async (req: any, res) => {
  const userId = String(req.user.id);
  const isUserAdmin = isAdmin(userId);
  
  try {
    const result = isUserAdmin 
      ? await query("SELECT * FROM channels ORDER BY name ASC")
      : await query("SELECT * FROM channels WHERE user_id = $1 OR is_public = true ORDER BY name ASC", [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Channels fetch error:", err);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.post("/", authenticateToken, async (req: any, res) => {
  const { id, name, handle, scrape_days, monitoring_interval } = req.body;
  const userId = String(req.user.id);
  
  try {
    await query(`
      INSERT INTO channels (id, name, handle, scrape_days, monitoring_interval, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        handle = EXCLUDED.handle,
        scrape_days = EXCLUDED.scrape_days,
        monitoring_interval = EXCLUDED.monitoring_interval
    `, [id, name, handle, scrape_days || 7, monitoring_interval || 'daily', userId]);
    
    // Trigger initial sync
    syncChannel(id, name, monitoring_interval || 'daily', scrape_days || 7, handle).catch(console.error);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Channel add error:", err);
    res.status(500).json({ error: "Failed to add channel" });
  }
});

router.post("/:id/toggle-public", authenticateToken, requireAdmin, async (req: any, res) => {
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  const { id } = req.params;
  const { is_public } = req.body;
  
  try {
    await query("UPDATE channels SET is_public = $1 WHERE id = $2", [is_public, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error toggling channel visibility:", err);
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

router.delete("/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  const { id } = req.params;
  try {
    await query("DELETE FROM publications WHERE clip_id IN (SELECT id FROM clips WHERE video_id IN (SELECT id FROM videos WHERE channel_id = $1))", [id]);
    await query("DELETE FROM clips WHERE video_id IN (SELECT id FROM videos WHERE channel_id = $1)", [id]);
    await query("DELETE FROM videos WHERE channel_id = $1", [id]);
    await query("DELETE FROM channels WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting channel:", err);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

export default router;
