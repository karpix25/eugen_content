import { Router } from "express";
import { query } from "../lib/db.js";
import { authenticateToken, isAdmin, requireAdmin } from "../middleware/auth.js";
import { syncChannel } from "../workers/monitoring-worker.js";

import { getChannelInfo } from "../services/apify.js";

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
  const { id: inputUrl, scrape_days, monitoring_interval } = req.body;
  const userId = String(req.user.id);
  
  try {
    console.log(`Adding new channel. Input: ${inputUrl}`);
    const channelInfo = await getChannelInfo(inputUrl);
    
    if (!channelInfo) {
      return res.status(400).json({ error: "Failed to fetch channel info. Please check the URL/ID." });
    }

    const { id: channelId, name, handle, thumbnail, subscribers } = channelInfo;

    await query(`
      INSERT INTO channels (id, name, handle, scrape_days, monitoring_interval, user_id, thumbnail, subscribers)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        handle = EXCLUDED.handle,
        scrape_days = EXCLUDED.scrape_days,
        monitoring_interval = EXCLUDED.monitoring_interval,
        thumbnail = EXCLUDED.thumbnail,
        subscribers = EXCLUDED.subscribers
    `, [channelId, name, handle, scrape_days || 7, monitoring_interval || 'daily', userId, thumbnail, subscribers]);
    
    // Trigger initial sync
    syncChannel(channelId, name, monitoring_interval || 'daily', scrape_days || 7, handle).catch(console.error);
    
    res.json({ success: true, channelId });
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

router.post("/:id/sync", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const channelRes = await query("SELECT * FROM channels WHERE id = $1", [id]);
    const channel = channelRes.rows[0];
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    // Trigger sync
    syncChannel(channel.id, channel.name, channel.monitoring_interval, channel.scrape_days, channel.handle).catch(console.error);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Manual sync error:", err);
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

router.delete("/:id", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const userId = String(req.user.id);
  
  try {
    // Check if user is admin or owner
    const channelRes = await query("SELECT user_id FROM channels WHERE id = $1", [id]);
    const channel = channelRes.rows[0];
    
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    
    if (!isAdmin(userId) && String(channel.user_id) !== userId) {
      return res.status(403).json({ error: "Unauthorized to delete this channel" });
    }

    // Manual cascade deletion (though most have FK cascades, being explicit ensures cleanup)
    await query("DELETE FROM publications WHERE clip_id IN (SELECT id FROM clips WHERE video_id IN (SELECT id FROM videos WHERE channel_id = $1))", [id]);
    await query("DELETE FROM carousels WHERE clip_id IN (SELECT id FROM clips WHERE video_id IN (SELECT id FROM videos WHERE channel_id = $1))", [id]);
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
