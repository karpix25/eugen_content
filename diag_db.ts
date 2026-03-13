import { query } from './src/lib/db';

async function diag() {
  try {
    const clips = await query('SELECT id, title, is_available, created_at FROM clips LIMIT 10');
    console.log('CLIPS IN DB:', clips.rows);
    
    const users = await query('SELECT telegram_id, username, is_admin FROM users');
    console.log('USERS IN DB:', users.rows);
  } catch (err) {
    console.error('DIAG ERROR:', err);
  } finally {
    process.exit();
  }
}

diag();
