import { query } from './src/lib/db.js';
import { redisConnection } from './src/lib/redis.js';

async function cleanup() {
  console.log('🧹 Starting cleanup...');

  try {
    // 1. Clear Database
    console.log('🗄️ Cleaning database tables...');
    await query('TRUNCATE carousels, publications, clips, videos, ad_plaques CASCADE');
    console.log('✅ Database tables truncated.');

    // 2. Clear Redis
    console.log('red Cleaning Redis keys...');
    await redisConnection.flushall();
    console.log('✅ Redis flushed.');

    console.log('✨ Cleanup complete! All requests and queues have been cleared.');
  } catch (err: any) {
    console.error('❌ Cleanup failed:', err.message);
  } finally {
    await redisConnection.quit();
    process.exit(0);
  }
}

cleanup();
