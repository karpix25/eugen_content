
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function check() {
    try {
        console.log("--- Counts ---");
        const usersCount = await pool.query("SELECT COUNT(*) FROM users");
        const channelsCount = await pool.query("SELECT COUNT(*) FROM channels");
        const clipsCount = await pool.query("SELECT COUNT(*) FROM clips");
        const videosCount = await pool.query("SELECT COUNT(*) FROM videos");
        
        console.log(`Users: ${usersCount.rows[0].count}`);
        console.log(`Channels: ${channelsCount.rows[0].count}`);
        console.log(`Clips: ${clipsCount.rows[0].count}`);
        console.log(`Videos: ${videosCount.rows[0].count}`);

        console.log("\n--- Checking specific User ID 7749219976 ---");
        const user = await pool.query("SELECT * FROM users WHERE telegram_id = $1", ['7749219976']);
        if (user.rows.length > 0) {
            console.log("User found:", user.rows[0]);
        } else {
            console.log("User NOT FOUND");
        }

        console.log("\n--- Channels Samples ---");
        const channels = await pool.query("SELECT * FROM channels LIMIT 5");
        console.table(channels.rows);

        console.log("\n--- Clips Samples (last 5) ---");
        const clips = await pool.query("SELECT * FROM clips ORDER BY id DESC LIMIT 5");
        console.table(clips.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
