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

    let { id: channelId, name, handle, thumbnail, subscribers } = channelInfo;

    // Safety check: ensure ID is not a full URL
    if (channelId && channelId.includes('youtube.com/')) {
      const idMatch = channelId.match(/channel\/([\w-]{24})/);
      if (idMatch) channelId = idMatch[1];
      else {
        const hMatch = channelId.match(/youtube\.com\/(@[\w.-]+)/);
        if (hMatch) channelId = hMatch[1];
      }
    }

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
    console.log(`Channel delete request. ID: "${id}" (length: ${id?.length}), request by User: ${userId}`);
    
    // Check if user is admin or owner
    const channelRes = await query("SELECT user_id, name, id FROM channels WHERE id = $1", [id]);
    console.log(`Query result rows: ${channelRes.rows.length}`);
    if (channelRes.rows.length > 0) {
      console.log(`Found channel in DB: "${channelRes.rows[0].id}" (matches: ${channelRes.rows[0].id === id})`);
    } else {
      console.log(`Channel not found in DB with ID: "${id}"`);
      // List all channel IDs to see if there's a mismatch
      const allChannels = await query("SELECT id FROM channels");
      console.log("Existing channel IDs in DB:", allChannels.rows.map(r => `"${r.id}"`).join(', '));
    }
    
    const channel = channelRes.rows[0];
    
    if (!channel) {
      console.warn(`[DELETE CHANNEL] Channel not found in DB. ID: ${id}, User: ${userId}`);
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const isUserAdmin = isAdmin(userId);
    const isOwner = channel.user_id ? String(channel.user_id) === userId : false;

    console.log(`[DELETE CHANNEL] Request details - Channel: "${channel.name}", ID: ${id}, Owner: ${channel.user_id}, Requester: ${userId}, IsAdmin: ${isUserAdmin}, IsOwner: ${isOwner}`);

    if (!isUserAdmin && !isOwner) {
      console.error(`[DELETE CHANNEL] Unauthorized attempt for ID ${id} by user ${userId}`);
      return res.status(403).json({ error: "Unauthorized to delete this channel" });
    }

    console.log(`[DELETE CHANNEL] Proceeding with full deletion for: "${channel.name}" (${id})`);

    // Manual cascade deletion to ensure cleanup across all related tables
    try {
      // 0. Identify videos to be deleted (pending or processing)
      const videosToDeleteRes = await query(`
        SELECT id FROM videos 
        WHERE channel_id = $1 AND (status = 'pending' OR status = 'processing' OR status IS NULL)
      `, [id]);
      const videoIdsToDelete = videosToDeleteRes.rows.map(r => r.id);

      if (videoIdsToDelete.length > 0) {
        // 1. Tasks related to clips of videos to be deleted
        await query(`
          DELETE FROM tasks 
          WHERE clip_id IN (
            SELECT id FROM clips 
            WHERE video_id = ANY($1)
          )
        `, [videoIdsToDelete]);

        // 2. Publications and Carousels for videos to be deleted
        await query(`
          DELETE FROM publications 
          WHERE clip_id IN (
            SELECT id FROM clips 
            WHERE video_id = ANY($1)
          )
        `, [videoIdsToDelete]);
        
        await query(`
          DELETE FROM carousels 
          WHERE clip_id IN (
            SELECT id FROM clips 
            WHERE video_id = ANY($1)
          )
        `, [videoIdsToDelete]);

        // 3. Clips for videos to be deleted
        await query("DELETE FROM clips WHERE video_id = ANY($1)", [videoIdsToDelete]);

        // 4. Videos themselves (only pending/processing)
        const videoDel = await query("DELETE FROM videos WHERE id = ANY($1)", [videoIdsToDelete]);
        console.log(`[DELETE CHANNEL] Deleted ${videoDel.rowCount} pending/processing videos`);
      }

      // 5. For REMAINING videos (approved, completed, etc.), just unbind them from the channel
      const videoUpdate = await query(`
        UPDATE videos 
        SET channel_id = NULL 
        WHERE channel_id = $1
      `, [id]);
      console.log(`[DELETE CHANNEL] Preserved ${videoUpdate.rowCount} processed videos by setting channel_id to NULL`);

      // 6. Channel itself
      await query("DELETE FROM channels WHERE id = $1", [id]);
      
      console.log(`[DELETE CHANNEL] Success: Deleted channel ${id} and all its data.`);
      res.json({ success: true });
    } catch (dbErr: any) {
      console.error(`[DELETE CHANNEL] Database error during deletion:`, dbErr);
      res.status(500).json({ error: "Failed to delete channel data due to internal error." });
    }
  } catch (err) {
    console.error("Error deleting channel:", err);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

export default router;
