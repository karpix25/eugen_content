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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT,
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

    -- Migrations for existing tables
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS subscribers BIGINT;
  `);
};
