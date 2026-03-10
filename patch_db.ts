import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const res1 = await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscribers BIGINT");
    const res2 = await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS handle TEXT");
    const res3 = await pool.query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS scrape_days INTEGER DEFAULT 7");
    const res4 = await pool.query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10)");
    const res5 = await pool.query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS target_language VARCHAR(10)");
    const res6 = await pool.query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS language VARCHAR(10)");
    const res7 = await pool.query("ALTER TABLE ad_plaques ADD COLUMN IF NOT EXISTS user_id BIGINT");
    const res8 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_text TEXT");
    const res9 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_opacity NUMERIC DEFAULT 0.08");
    const res10 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'center'");
    const res11 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_enabled BOOLEAN DEFAULT true");
    const res12 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_size NUMERIC DEFAULT 16");
    const res13 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_color TEXT DEFAULT '&H00FFFFFF'");
    const res14 = await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_position TEXT DEFAULT 'Bottom'");
    const res15 = await pool.query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS srt_url TEXT");
    console.log("MIGRATIONS APPLIED SUCCESSFULLY!");
  } catch(e) {
    console.error("ERROR", e);
  } finally {
    pool.end();
  }
}
run();
