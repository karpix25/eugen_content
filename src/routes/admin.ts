import { Router } from "express";
import { query } from "../lib/db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Get all publications for admin view
router.get("/publications", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, c.name as channel_name, c.handle as channel_handle, v.title as video_title
      FROM publications p
      JOIN clips cl ON p.clip_id = cl.id
      JOIN videos v ON cl.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching admin publications:", err);
    res.status(500).json({ error: "Failed to fetch publications" });
  }
});

// Get system-wide stats
router.get("/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const channels = await query("SELECT count(*) as count FROM channels");
    const videos = await query("SELECT count(*) as count FROM videos");
    const clips = await query("SELECT count(*) as count FROM clips");
    const publications = await query("SELECT count(*) as count FROM publications");
    
    res.json({
      channels: parseInt(channels.rows[0].count),
      videos: parseInt(videos.rows[0].count),
      clips: parseInt(clips.rows[0].count),
      publications: parseInt(publications.rows[0].count)
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
