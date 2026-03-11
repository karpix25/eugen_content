import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import { processClip } from '../src/services/processor.js';
import { getVizardProjectStatus } from '../src/services/vizard.js';
import { bot } from '../src/services/telegram.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = (text: string, params?: any[]) => pool.query(text, params);

async function run() {
  const args = process.argv.slice(2);
  const projectId = args[0];
  const telegramId = args[1]; // Optional

  if (!projectId) {
    console.error('Usage: tsx scripts/import-vizard.ts <vizard_project_id> [telegram_id]');
    process.exit(1);
  }

  console.log(`[Import] Fetching status for Vizard Project: ${projectId}`);

  try {
    const projectData = await getVizardProjectStatus(projectId);
    if (!projectData || !projectData.data) {
      console.error(`Failed to fetch project ${projectId} from Vizard API.`);
      process.exit(1);
    }

    const { external_id, clips, list } = projectData.data;
    const finalClips = clips || list || [];
    const videoId = external_id;

    if (!videoId) {
        console.error("Vizard project does not have an external_id (videoId). Cannot map to database.");
        process.exit(1);
    }

    console.log(`Found ${finalClips.length} clips in Vizard for video: ${videoId}`);

    // Ensure video exists in DB
    const videoCheck = await query("SELECT * FROM videos WHERE id = $1", [videoId]);
    if (videoCheck.rows.length === 0) {
        console.log(`Video ${videoId} not found in DB. Creating skeleton record...`);
        await query("INSERT INTO videos (id, title, status) VALUES ($1, $2, $3)", [videoId, `Imported Project ${projectId}`, 'sent_to_vizard']);
    }
    const video = (await query("SELECT * FROM videos WHERE id = $1", [videoId])).rows[0];

    // Get plaque
    const plaqueResult = await query("SELECT * FROM ad_plaques LIMIT 1");
    const plaque = plaqueResult.rows[0];

    for (const vClip of finalClips) {
      // Find or create clip in DB
      // Vizard doesn't give a stable unique ID for clips in the query response usually, 
      // so we use the URL or title as a heuristic.
      const existingClip = await query("SELECT * FROM clips WHERE video_id = $1 AND url = $2", [videoId, vClip.url]);
      
      let clipId;
      if (existingClip.rows.length > 0) {
        clipId = existingClip.rows[0].id;
        console.log(`Clip already exists: ${clipId}`);
      } else {
        clipId = Math.random().toString(36).substr(2, 9);
        await query(`
          INSERT INTO clips (id, video_id, url, thumbnail, title, ad_plaque_id, language)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [clipId, videoId, vClip.url, vClip.thumbnail, vClip.title, plaque?.id, video.target_language || video.detected_language]);
        console.log(`Created new clip record: ${clipId}`);
      }

      console.log(`\n--- Re-processing clip ${clipId} ---`);
      
      const localFilePath = await processClip(
        clipId,
        vClip.url,
        plaque?.image_url || null,
        video.target_language,
        video.detected_language,
        false, // Do upload to S3 if not specified otherwise
      );
      
      console.log(`Processed! Result: ${localFilePath}`);

      if (telegramId) {
        console.log(`Sending to Telegram user ${telegramId}...`);
        try {
          await bot.telegram.sendVideo(telegramId, {
            source: fs.createReadStream(localFilePath)
          }, {
            caption: `🎥 ${vClip.title} (Imported from Vizard)`
          });
          console.log('Sent successfully.');
        } catch (botErr: any) {
          console.error(`Failed to send to Telegram: ${botErr.message}`);
        }
      }
    }

    console.log('\nImport and processing complete.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during import:', err);
    process.exit(1);
  }
}

run();
