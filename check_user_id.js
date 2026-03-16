
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkChannel() {
  try {
    const result = await pool.query("SELECT id, user_id FROM channels");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("Error checking channel:", err);
  } finally {
    await pool.end();
  }
}

checkChannel();
