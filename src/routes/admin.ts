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
    const publications = await query("SELECT count(*) as count FROM publications WHERE status = 'published'");
    const total_publications = await query("SELECT count(*) as count FROM publications");
    const users = await query("SELECT count(*) as count FROM users");
    const authorized_users = await query("SELECT count(*) as count FROM users WHERE is_authorized = TRUE");

    const today_publications = await query(
      "SELECT count(*) as count FROM publications WHERE created_at > NOW() - INTERVAL '24 hours'"
    );

    const week_publications = await query(
      "SELECT count(*) as count FROM publications WHERE created_at > NOW() - INTERVAL '7 days'"
    );

    const top_users = await query(`
      SELECT u.first_name, u.username, COUNT(p.id)::int as count
      FROM users u
      JOIN publications p ON u.telegram_id = p.user_id
      GROUP BY u.telegram_id, u.first_name, u.username
      ORDER BY count DESC
      LIMIT 5
    `);

    const top_clips = await query(`
      SELECT c.id, c.title, c.thumbnail, COUNT(p.id)::int as publish_count
      FROM clips c
      JOIN publications p ON c.id = p.clip_id
      GROUP BY c.id, c.title, c.thumbnail
      ORDER BY publish_count DESC
      LIMIT 10
    `);

    const daily_trend = await query(`
      SELECT 
        TO_CHAR(date_trunc('day', created_at), 'DD.MM') as date, 
        COUNT(*)::int as count 
      FROM publications 
      WHERE created_at > NOW() - INTERVAL '14 days' 
      GROUP BY date_trunc('day', created_at) 
      ORDER BY date_trunc('day', created_at)
    `);
    
    res.json({
      total: {
        channels: parseInt(channels.rows[0].count),
        videos: parseInt(videos.rows[0].count),
        clips: parseInt(clips.rows[0].count),
        publications: parseInt(total_publications.rows[0].count),
        users: parseInt(users.rows[0].count),
        authorized_users: parseInt(authorized_users.rows[0].count)
      },
      reporting_users: top_users.rowCount,
      total_published_videos: parseInt(publications.rows[0].count),
      recent: {
        today: parseInt(today_publications.rows[0].count),
        week: parseInt(week_publications.rows[0].count)
      },
      top_users: top_users.rows,
      top_clips: top_clips.rows,
      daily_trend: daily_trend.rows
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
