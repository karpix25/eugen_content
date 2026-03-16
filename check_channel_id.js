
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

async function checkChannel() {
  const testId = "UCTHXtr2FZibOytQV7Yt7FqA";
  try {
    const result = await pool.query("SELECT id, name FROM channels WHERE id = $1", [testId]);
    console.log(`Query for ID "${testId}":`);
    console.log(JSON.stringify(result.rows, null, 2));

    const allResult = await pool.query("SELECT id FROM channels");
    console.log("All IDs in DB:");
    for (const row of allResult.rows) {
        console.log(`- "${row.id}" (length: ${row.id.length})`);
        // Check for non-printable characters
        for (let i = 0; i < row.id.length; i++) {
            const charCode = row.id.charCodeAt(i);
            if (charCode < 32 || charCode > 126) {
                console.log(`  Found special char at index ${i}: charCode ${charCode}`);
            }
        }
    }
  } catch (err) {
    console.error("Error checking channel:", err);
  } finally {
    await pool.end();
  }
}

checkChannel();
