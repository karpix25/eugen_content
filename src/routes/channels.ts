import { Router } from "express";
import { query } from "../lib/db.js";
import { authenticateToken, isAdmin, requireAdmin } from "../middleware/auth.js";
import { syncChannel } from "../workers/monitoring-worker.js";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const result = await query("SELECT * FROM channels ORDER BY name ASC");
  res.json(result.rows);
});

router.post("/", authenticateToken, requireAdmin, async (req: any, res) => {
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  const { id, name, handle, scrape_days, monitoring_interval } = req.body;
  
  try {
    await query(`
      INSERT INTO channels (id, name, handle, scrape_days, monitoring_interval)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        handle = EXCLUDED.handle,
        scrape_days = EXCLUDED.scrape_days,
        monitoring_interval = EXCLUDED.monitoring_interval
    `, [id, name, handle, scrape_days || 7, monitoring_interval || 'daily']);
    
    // Trigger initial sync
    syncChannel(id, name, monitoring_interval || 'daily', scrape_days || 7, handle).catch(console.error);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Channel add error:", err);
    res.status(500).json({ error: "Failed to add channel" });
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
