import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_family TEXT DEFAULT 'Anton'");
    console.log("SUCCESS!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
