import dotenv from 'dotenv';
import { pool, query } from '../src/lib/db.js';
import { isExpiredOrNearExpiryUrl, isTemporaryVizardUrl, refreshClipUrlFromVizard } from '../src/services/vizard.js';
import { normalizeRemoteUrl } from '../src/lib/s3.js';

dotenv.config();

type ScriptOptions = {
  apply: boolean;
  limit: number;
  videoId?: string;
  clipId?: string;
};

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    apply: false,
    limit: 100,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number(args[i + 1] || '100') || 100;
      i += 1;
      continue;
    }

    if (arg === '--video') {
      options.videoId = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--clip') {
      options.clipId = args[i + 1];
      i += 1;
      continue;
    }
  }

  return options;
};

const isBrokenOrTemporaryUrl = (url?: string | null) => {
  if (!url) return true;

  const normalizedUrl = normalizeRemoteUrl(url);
  if (normalizedUrl !== url) return true;
  if (!/^https?:\/\//i.test(normalizedUrl)) return true;
  if (isTemporaryVizardUrl(normalizedUrl)) return true;
  if (isExpiredOrNearExpiryUrl(normalizedUrl)) return true;

  return false;
};

let poolClosed = false;

const closePool = async () => {
  if (poolClosed) return;
  poolClosed = true;
  await pool.end();
};

async function run() {
  const options = parseArgs();

  console.log(`[Backfill] Starting ${options.apply ? 'apply' : 'dry-run'} mode`);
  console.log(`[Backfill] Limit: ${options.limit}`);
  if (options.videoId) console.log(`[Backfill] Video filter: ${options.videoId}`);
  if (options.clipId) console.log(`[Backfill] Clip filter: ${options.clipId}`);

  try {
    const conditions = ["v.vizard_project_id IS NOT NULL"];
    const params: any[] = [];

    if (options.videoId) {
      params.push(options.videoId);
      conditions.push(`c.video_id = $${params.length}`);
    }

    if (options.clipId) {
      params.push(options.clipId);
      conditions.push(`c.id = $${params.length}`);
    }

    params.push(options.limit);

    const result = await query(
      `SELECT c.id, c.video_id, c.title, c.url, c.status, v.vizard_project_id
       FROM clips c
       JOIN videos v ON v.id = c.video_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const candidates = result.rows.filter((row) => isBrokenOrTemporaryUrl(row.url));

    console.log(`[Backfill] Found ${result.rows.length} clips, ${candidates.length} need migration/refresh.`);

    if (candidates.length === 0) {
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const clip of candidates) {
      console.log(`\n[Backfill] Clip ${clip.id} | video ${clip.video_id}`);
      console.log(`[Backfill] Title: ${clip.title}`);
      console.log(`[Backfill] Current URL: ${clip.url || '<empty>'}`);

      if (!options.apply) {
        skipped += 1;
        continue;
      }

      try {
        const refreshedUrl = await refreshClipUrlFromVizard(clip.id);

        if (!refreshedUrl) {
          failed += 1;
          console.error(`[Backfill] Failed: Vizard did not return a refreshed URL for clip ${clip.id}`);
          continue;
        }

        const normalizedRefreshedUrl = normalizeRemoteUrl(refreshedUrl);
        if (!/^https?:\/\//i.test(normalizedRefreshedUrl)) {
          failed += 1;
          console.error(`[Backfill] Failed: refreshed URL is still invalid for clip ${clip.id}: ${normalizedRefreshedUrl}`);
          continue;
        }

        migrated += 1;
        console.log(`[Backfill] Updated URL: ${normalizedRefreshedUrl}`);
      } catch (err: any) {
        failed += 1;
        console.error(`[Backfill] Error for clip ${clip.id}:`, err.message);
      }
    }

    console.log(`\n[Backfill] Done.`);
    console.log(`[Backfill] Migrated: ${migrated}`);
    console.log(`[Backfill] Dry-run items: ${skipped}`);
    console.log(`[Backfill] Failed: ${failed}`);
  } finally {
    await closePool();
  }
}

run().catch(async (err) => {
  if (err?.code === 'ENOTFOUND' && err?.hostname === 'db') {
    console.error('[Backfill] DATABASE_URL points to host "db". Run this script inside the app container or provide a host-accessible DATABASE_URL.');
  }
  console.error('[Backfill] Fatal error:', err);
  await closePool();
  process.exit(1);
});
