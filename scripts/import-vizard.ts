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
    if (!projectData) {
      console.error(`Failed to fetch project ${projectId} from Vizard API.`);
      process.exit(1);
    }

    // Vizard API returns metadata either directly or under 'data' property
    const actualData = projectData.data || projectData;
    const { external_id, clips, list, videos, projectName, projectId: respProjectId } = actualData;
    const finalClips = videos || list || clips || [];
    const videoId = external_id || projectName?.replace('Youtube_', '') || `import_${respProjectId}`;

    if (!videoId) {
        console.error("Vizard project does not have an external_id or projectName. Cannot map to database.");
        console.error('Full response structure:', JSON.stringify(projectData, null, 2));
        process.exit(1);
    }

    if (!videoId) {
        console.error("Vizard project does not have an external_id or projectName. Cannot map to database.");
        process.exit(1);
    }

    console.log(`Found ${finalClips.length} clips in Vizard for video: ${videoId}`);

    // Force target language for this test
    const targetLang = 'en';
    const sourceLang = 'ru'; // Most likely Russian based on title

    // Ensure video exists in DB
    const videoCheck = await query("SELECT * FROM videos WHERE id = $1", [videoId]);
    if (videoCheck.rows.length === 0) {
        console.log(`Video ${videoId} not found in DB. Creating skeleton record...`);
        await query("INSERT INTO videos (id, title, status, target_language, detected_language) VALUES ($1, $2, $3, $4, $5)", 
            [videoId, projectName || `Imported Project ${projectId}`, 'sent_to_vizard', targetLang, sourceLang]);
    } else {
        await query("UPDATE videos SET target_language = $1, detected_language = $2 WHERE id = $3", [targetLang, sourceLang, videoId]);
    }
    const video = (await query("SELECT * FROM videos WHERE id = $1", [videoId])).rows[0];

    // Get plaque
    const plaqueResult = await query("SELECT * FROM ad_plaques LIMIT 1");
    const plaque = plaqueResult.rows[0];

    for (const vClip of finalClips) {
      const clipUrl = vClip.videoUrl || vClip.url;
      const thumbUrl = vClip.thumbnail || vClip.thumbnailUrl || '';

      // Find or create clip in DB
      const existingClip = await query("SELECT * FROM clips WHERE video_id = $1 AND url = $2", [videoId, clipUrl]);
      
      let clipId;
      if (existingClip.rows.length > 0) {
        clipId = existingClip.rows[0].id;
        console.log(`Clip already exists: ${clipId}`);
      } else {
        clipId = Math.random().toString(36).substr(2, 9);
        await query(`
          INSERT INTO clips (id, video_id, url, thumbnail, title, ad_plaque_id, language)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [clipId, videoId, clipUrl, thumbUrl, vClip.title, plaque?.id, video.target_language || video.detected_language]);
        console.log(`Created new clip record: ${clipId}`);
      }

      console.log(`\n--- Re-processing clip ${clipId} ---`);
      
      const localFilePath = await processClip(
        clipId,
        clipUrl,
        plaque?.image_url || null,
        video.target_language,
        video.detected_language,
        true, // Skip upload to S3 since credentials are placeholders
      );
      
      console.log(`Processed! Result: ${localFilePath}`);

      if (telegramId) {
        console.log(`Sending to Telegram user ${telegramId}...`);
        console.log(`Source for Telegram: ${localFilePath}`);
        try {
          await bot.telegram.sendVideo(telegramId, {
            source: fs.createReadStream(localFilePath)
          }, {
            caption: `🎥 ${vClip.title} (Imported from Vizard)`
          });
          console.log('Sent successfully.');
        } catch (botErr: any) {
          console.error(`Failed to send to Telegram: ${botErr.message}`);
          console.error('Bot Error details:', botErr);
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
