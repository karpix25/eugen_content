import { query } from "../src/lib/db.js";
import { generateThumbnail } from "../src/services/processor.js";

async function main() {
  console.log("Starting missing thumbnails generation...");
  try {
    const clips = await query("SELECT id, url FROM clips WHERE thumbnail IS NULL OR thumbnail = ''");
    console.log(`Found ${clips.rows.length} clips without thumbnails.`);

    for (const clip of clips.rows) {
      console.log(`Processing clip ${clip.id}...`);
      try {
        const thumbUrl = await generateThumbnail(clip.url, clip.id);
        if (thumbUrl) {
          await query("UPDATE clips SET thumbnail = $1 WHERE id = $2", [thumbUrl, clip.id]);
          console.log(`Successfully generated thumbnail for ${clip.id}: ${thumbUrl}`);
        } else {
          console.warn(`Failed to generate thumbnail for ${clip.id}`);
        }
      } catch (err) {
        console.error(`Error processing clip ${clip.id}:`, err);
      }
    }
    console.log("Finished generating thumbnails.");
  } catch (err) {
    console.error("Database error during thumbnail generation:", err);
  } finally {
    process.exit(0);
  }
}

main();
