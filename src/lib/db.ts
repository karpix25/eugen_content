import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const initDb = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      is_authorized BOOLEAN DEFAULT FALSE,
      watermark_text TEXT,
      watermark_opacity NUMERIC DEFAULT 0.08,
      watermark_position TEXT DEFAULT 'center',
      subtitle_enabled BOOLEAN DEFAULT true,
      subtitle_font_size NUMERIC DEFAULT 16,
      subtitle_font_color TEXT DEFAULT '&H00FFFFFF',
      subtitle_position TEXT DEFAULT 'Bottom',
      subtitle_style TEXT DEFAULT 'ali',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT,
      handle TEXT,
      thumbnail TEXT,
      subscribers BIGINT,
      last_checked TIMESTAMP,
      monitoring_interval TEXT DEFAULT 'daily', -- manual, daily, weekly
      next_check TIMESTAMP,
      scrape_days INTEGER DEFAULT 7
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      channel_id TEXT REFERENCES channels(id),
      title TEXT,
      description TEXT,
      published_at TIMESTAMP,
      thumbnail TEXT,
      transcript TEXT,
      ai_score INTEGER,
      ai_evaluation TEXT,
      status TEXT DEFAULT 'pending', -- pending, approved, rejected, sent_to_vizard, completed
      vizard_project_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      video_id TEXT REFERENCES videos(id),
      url TEXT,
      thumbnail TEXT,
      title TEXT,
      status TEXT DEFAULT 'raw', -- raw, processed
      is_available BOOLEAN DEFAULT TRUE,
      downloaded_by BIGINT REFERENCES users(telegram_id),
      downloaded_at TIMESTAMP,
      ad_plaque_id TEXT,
      transcript TEXT,
      srt_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ad_plaques (
      id TEXT PRIMARY KEY,
      name TEXT,
      image_url TEXT,
      text TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      clip_id TEXT REFERENCES clips(id),
      description TEXT,
      status TEXT DEFAULT 'pending', -- pending, completed
      published_link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      status TEXT DEFAULT 'pending', -- pending, authorized
      telegram_id BIGINT,
      username TEXT,
      first_name TEXT,
      jwt TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS publications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id TEXT REFERENCES clips(id),
      user_id BIGINT REFERENCES users(telegram_id),
      plaque_id TEXT REFERENCES ad_plaques(id),
      message_id BIGINT, -- The Telegram message ID of the sent video
      social_links TEXT[] DEFAULT '{}',
      status TEXT DEFAULT 'sent', -- sent, published
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );


    -- Migrations handled separately below
  `);

  try {
    await query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscribers BIGINT");
    await query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS handle TEXT");
    await query("ALTER TABLE channels ADD COLUMN IF NOT EXISTS scrape_days INTEGER DEFAULT 7");
    await query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10)");
    await query("ALTER TABLE videos ADD COLUMN IF NOT EXISTS target_language VARCHAR(10)");
    await query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS language VARCHAR(10)");
    await query("ALTER TABLE ad_plaques ADD COLUMN IF NOT EXISTS user_id BIGINT");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_text TEXT");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_opacity NUMERIC DEFAULT 0.08");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'center'");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_enabled BOOLEAN DEFAULT true");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_size NUMERIC DEFAULT 16");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_color TEXT DEFAULT '&H00FFFFFF'");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_position TEXT DEFAULT 'Bottom'");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_style TEXT DEFAULT 'ali'");
    await query("ALTER TABLE clips ADD COLUMN IF NOT EXISTS srt_url TEXT");
    console.log("Database migrations applied successfully.");
  } catch (err) {
    console.error("Migration error:", err);
  }
};
