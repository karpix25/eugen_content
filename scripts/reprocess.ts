import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import { processClip } from '../src/services/processor.js';
import { bot } from '../src/services/telegram.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = (text: string, params?: any[]) => pool.query(text, params);

async function run() {
  const args = process.argv.slice(2);
  const videoId = args[0];
  const telegramId = args[1]; // Optional

  if (!videoId) {
    console.error('Usage: tsx scripts/reprocess.ts <video_id> [telegram_id]');
    process.exit(1);
  }

  console.log(`[Reprocess] Starting re-processing for video: ${videoId}`);

  try {
    const videoRes = await query("SELECT * FROM videos WHERE id = $1", [videoId]);
    if (videoRes.rows.length === 0) {
      console.error(`Video ${videoId} not found in database.`);
      process.exit(1);
    }
    const video = videoRes.rows[0];

    const clipsRes = await query("SELECT * FROM clips WHERE video_id = $1", [videoId]);
    console.log(`Found ${clipsRes.rows.length} clips for video ${videoId}`);

    for (const clip of clipsRes.rows) {
      console.log(`\n--- Processing clip ${clip.id} (${clip.title}) ---`);
      
      const plaqueId = clip.ad_plaque_id;
      let plaqueImageUrl = null;
      if (plaqueId) {
        const pRes = await query("SELECT * FROM ad_plaques WHERE id = $1", [plaqueId]);
        if (pRes.rows.length > 0) {
          plaqueImageUrl = pRes.rows[0].image_url;
        }
      }

      // We set skipS3Upload=true for local testing if needed, but normally we want to re-process and potentially send.
      // processClip signature: (clipId, videoUrl, plaqueImageUrl, targetLang, sourceLang, skipS3Upload, watermark, plaque, subtitles)
      
      const localFilePath = await processClip(
        clip.id,
        clip.url,
        plaqueImageUrl,
        clip.language || video.target_language,
        video.detected_language,
        true // skipS3Upload to keep it local for re-sending
      );
      
      console.log(`Processed: ${localFilePath}`);

      if (telegramId) {
        console.log(`Sending to Telegram user ${telegramId}...`);
        try {
          await bot.telegram.sendVideo(telegramId, {
            source: fs.createReadStream(localFilePath)
          }, {
            caption: `🎥 ${clip.title} (Reprocessed)`
          });
          console.log('Sent successfully.');
        } catch (botErr: any) {
          console.error(`Failed to send to Telegram: ${botErr.message}`);
        }
      }
      
      // Optionally clean up local file if we want, but processClip uses temp/
    }

    console.log('\nAll clips finished.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during re-processing:', err);
    process.exit(1);
  }
}

run();
