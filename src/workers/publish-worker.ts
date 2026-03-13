import cron from "node-cron";
import { query } from "../lib/db.js";
import { Telegraf } from "telegraf";
import { processClip } from "../services/processor.js";
import { sanitizeFolderName } from "../lib/sanitize.js";
import fs from "fs";

export const autoPublish = async (bot: Bot<any>) => {
  console.log("Checking for videos for auto-publication...");
  try {
    const users = await query("SELECT * FROM users WHERE auto_mode_enabled = true");
    for (const user of users.rows) {
      console.log(`Checking auto-publish for user ${user.username} (${user.telegram_id})...`);
      
      const alreadySentCountRes = await query(`
        SELECT COUNT(*) FROM publications 
        WHERE user_id = $1 AND created_at >= CURRENT_DATE
      `, [user.telegram_id]);
      const alreadySentCount = parseInt(alreadySentCountRes.rows[0].count);

      if (alreadySentCount >= user.auto_mode_videos_per_day) {
        console.log(`User ${user.username} already reached limit of ${user.auto_mode_videos_per_day} for today.`);
        continue;
      }

      const videosNeeded = user.auto_mode_videos_per_day - alreadySentCount;
      const clipsToPublish = await query(`
        SELECT c.*, v.title as video_title 
        FROM clips c
        JOIN videos v ON c.video_id = v.id
        WHERE NOT EXISTS (
          SELECT 1 FROM publications p WHERE p.clip_id = c.id AND p.user_id = $1
        )
        AND c.status = 'processed'
        LIMIT $2
      `, [user.telegram_id, videosNeeded]);

      for (const clip of clipsToPublish.rows) {
        console.log(`[Auto] Publishing clip ${clip.id} for user ${user.username}...`);
        
        const plaqueRes = await query("SELECT image_url FROM ad_plaques WHERE id = $1", [user.default_plaque_id]);
        const plaqueImageUrl = plaqueRes.rows[0]?.image_url || null;

        const defaultText = user.username ? `@${user.username}` : user.first_name;
        const watermarkConfig = user.watermark_text ? {
          text: user.watermark_text,
          opacity: parseFloat(user.watermark_opacity) || 0.08,
          position: user.watermark_position || 'center'
        } : (defaultText ? { text: defaultText, opacity: 0.08, position: 'center' } : null);

        const subtitleConfig = {
          enabled: user.subtitle_enabled !== false,
          font_size: user.subtitle_font_size ? parseFloat(user.subtitle_font_size) : 16,
          font_color: user.subtitle_font_color || '#FFFFFF',
          position: user.subtitle_position || '80',
          style: user.subtitle_style || 'karaoke',
          font_family: user.subtitle_font_family || 'Anton',
          highlight_color: user.subtitle_highlight_color || '#FFFF00',
          highlight_enabled: user.subtitle_highlight_enabled !== false,
          outline_color: user.subtitle_outline_color || '#000000'
        };

        const plaqueConfig = {
          position: user.plaque_position || 'top',
          size: user.plaque_size ? Number(user.plaque_size) : 80,
          timerange: user.plaque_timerange ? Number(user.plaque_timerange) : 0
        };

        const folderName = sanitizeFolderName(clip.video_title);
        const localFilePath = await processClip(
          clip.id, clip.url, plaqueImageUrl, clip.language, null, true, 
          watermarkConfig as any, plaqueConfig, subtitleConfig, folderName
        );

        if (fs.existsSync(localFilePath)) {
          const message = await bot.telegram.sendVideo(user.telegram_id, {
            source: fs.createReadStream(localFilePath)
          }, {
            caption: `🤖 [Auto] ${clip.title}`
          });

          await query(`
            INSERT INTO publications (clip_id, user_id, plaque_id, message_id, status)
            VALUES ($1, $2, $3, $4, 'sent')
          `, [clip.id, user.telegram_id, user.default_plaque_id, message.message_id]);

          fs.unlinkSync(localFilePath);
        }
      }
    }
  } catch (err) {
    console.error("Auto-Publish Worker Error:", err);
  }
};

export function initPublishWorker(bot: Bot<any>) {
  // Check every hour
  cron.schedule('30 * * * *', () => autoPublish(bot));
}
