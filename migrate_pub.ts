import { query } from './src/lib/db.js';

async function migrate() {
  try {
    console.log('Adding type column to publications...');
    await query("ALTER TABLE publications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'video';");
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
