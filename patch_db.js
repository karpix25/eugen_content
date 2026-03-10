import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscribers BIGINT");
    await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS handle TEXT");
    await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS scrape_days INTEGER DEFAULT 7");
    await pool.query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10)");
    await pool.query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS target_language VARCHAR(10)");
    await pool.query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS language VARCHAR(10)");
    await pool.query("ALTER TABLE ad_plaques ADD COLUMN IF NOT EXISTS user_id BIGINT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_text TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_opacity NUMERIC DEFAULT 0.08");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'center'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_enabled BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_size NUMERIC DEFAULT 16");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_color TEXT DEFAULT '&H00FFFFFF'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_position TEXT DEFAULT 'Bottom'");
    await pool.query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS srt_url TEXT");
    console.log("SUCCESS!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
