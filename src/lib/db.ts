import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const initDb = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id TEXT PRIMARY KEY,
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
        subtitle_outline_color TEXT DEFAULT '#000000',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT,
        handle TEXT,
        thumbnail TEXT,
        subscribers BIGINT,
        last_checked TIMESTAMP,
        monitoring_interval TEXT DEFAULT 'daily',
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
        status TEXT DEFAULT 'pending',
        vizard_project_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        video_id TEXT REFERENCES videos(id),
        url TEXT,
        thumbnail TEXT,
        title TEXT,
        hook TEXT,
        status TEXT DEFAULT 'raw',
        is_available BOOLEAN DEFAULT TRUE,
        downloaded_by TEXT,
        downloaded_at TIMESTAMP,
        ad_plaque_id TEXT,
        transcript TEXT,
        srt_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ad_plaques (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        image_url TEXT,
        text TEXT
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        telegram_id TEXT,
        username TEXT,
        first_name TEXT,
        jwt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clip_id TEXT REFERENCES clips(id),
        user_id TEXT,
        plaque_id TEXT REFERENCES ad_plaques(id),
        message_id BIGINT,
        social_links TEXT[] DEFAULT '{}',
        status TEXT DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS carousel_styles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(telegram_id),
        name TEXT,
        image_url TEXT,
        analysis JSONB,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS carousels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clip_id TEXT REFERENCES clips(id),
        user_id TEXT REFERENCES users(telegram_id),
        script JSONB, -- Array of 6 slides {title, body}
        image_url TEXT, -- URL of the full 2x3 grid
        slides TEXT[], -- Array of URLs for indexed slides
        status TEXT DEFAULT 'pending', -- pending, generating, ready, error
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Robust migration handling for telegram_id / user_id type changes
      ALTER TABLE clips DROP CONSTRAINT IF EXISTS clips_downloaded_by_fkey;
      ALTER TABLE publications DROP CONSTRAINT IF EXISTS publications_user_id_fkey;

      ALTER TABLE users ALTER COLUMN telegram_id TYPE TEXT USING telegram_id::TEXT;
      ALTER TABLE auth_sessions ALTER COLUMN telegram_id TYPE TEXT USING telegram_id::TEXT;
      ALTER TABLE publications ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
      ALTER TABLE clips ALTER COLUMN downloaded_by TYPE TEXT USING downloaded_by::TEXT;
      ALTER TABLE ad_plaques ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

      ALTER TABLE clips ADD CONSTRAINT clips_downloaded_by_fkey FOREIGN KEY (downloaded_by) REFERENCES users(telegram_id);
      ALTER TABLE publications ADD CONSTRAINT publications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(telegram_id);
    `);

    // Other Migrations
    await query(`
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscribers BIGINT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS handle TEXT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS scrape_days INTEGER DEFAULT 7;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS detected_language TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS target_language TEXT;
      ALTER TABLE clips ADD COLUMN IF NOT EXISTS language TEXT;
      ALTER TABLE clips ADD COLUMN IF NOT EXISTS hook TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_text TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_opacity NUMERIC DEFAULT 0.08;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'center';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_enabled BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_size NUMERIC DEFAULT 48;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_color TEXT DEFAULT '&H00FFFFFF';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_position TEXT DEFAULT 'Bottom';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_style TEXT DEFAULT 'karaoke';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_font_family TEXT DEFAULT 'Anton';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_highlight_color TEXT DEFAULT '#FFFF00';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_highlight_enabled BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subtitle_outline_color TEXT DEFAULT '#000000';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_plaque_id TEXT REFERENCES ad_plaques(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plaque_position TEXT;
      ALTER TABLE clips ADD COLUMN IF NOT EXISTS srt_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plaque_size NUMERIC DEFAULT 80;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plaque_timerange NUMERIC DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_mode_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_mode_videos_per_day NUMERIC DEFAULT 3;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_post TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS error_message TEXT;
    `);
    console.log("Database migrations applied successfully.");
  } catch (err) {
    console.error("Migration error:", err);
  }
};

