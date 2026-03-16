
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function listChannels() {
  try {
    const result = await pool.query("SELECT id, name, handle FROM channels");
    console.log("Channels in DB:");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("Error listing channels:", err);
  } finally {
    await pool.end();
  }
}

listChannels();
