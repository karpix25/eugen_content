import { query } from '../lib/db.js';
import { mapWithConcurrency } from '../lib/concurrency.js';
import { generateThumbnail } from './processor.js';
import { getVizardProjectStatus, storeVizardClipInS3 } from './vizard.js';

const VIZARD_CLIP_IMPORT_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.VIZARD_CLIP_IMPORT_CONCURRENCY || '3', 10) || 3
);

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeLang = (lang?: string | null): string | null => {
  if (!lang) return null;
  const l = lang.toLowerCase().trim();
  if (l.includes('russian') || l === 'ru') return 'ru';
  if (l.includes('english') || l === 'en') return 'en';
  if (l.includes('spanish') || l === 'es') return 'es';
  return l;
};

const getProjectClips = (statusData: any): any[] => {
  if (!statusData) return [];
  if (Array.isArray(statusData.videos)) return statusData.videos;
  if (Array.isArray(statusData.data)) return statusData.data;
  if (Array.isArray(statusData.data?.videos)) return statusData.data.videos;
  if (Array.isArray(statusData.list)) return statusData.list;
  if (Array.isArray(statusData.data?.list)) return statusData.data.list;
  if (Array.isArray(statusData.clips)) return statusData.clips;
  return [];
};

const getClipUrlFromProjectClip = (clip: any): string | null => {
  return clip?.videoUrl || clip?.url || clip?.video_url || null;
};

const scoreClipMatch = (projectClip: any, dbClip: any) => {
  const projectTitle = normalizeText(projectClip?.title);
  const projectHook = normalizeText(projectClip?.hook || projectClip?.headline);
  const projectTranscriptPrefix = normalizeText(projectClip?.transcript).slice(0, 120);

  const dbTitle = normalizeText(dbClip?.title);
  const dbHook = normalizeText(dbClip?.hook);
  const dbTranscriptPrefix = normalizeText(dbClip?.transcript).slice(0, 120);

  let score = 0;

  if (projectTitle && dbTitle) {
    if (projectTitle === dbTitle) score += 6;
    else if (projectTitle.includes(dbTitle) || dbTitle.includes(projectTitle)) score += 3;
  }

  if (projectHook && dbHook) {
    if (projectHook === dbHook) score += 4;
    else if (projectHook.includes(dbHook) || dbHook.includes(projectHook)) score += 2;
  }

  if (projectTranscriptPrefix && dbTranscriptPrefix) {
    if (projectTranscriptPrefix === dbTranscriptPrefix) score += 5;
    else if (
      projectTranscriptPrefix.startsWith(dbTranscriptPrefix.slice(0, 80)) ||
      dbTranscriptPrefix.startsWith(projectTranscriptPrefix.slice(0, 80))
    ) {
      score += 2;
    }
  }

  return score;
};

const findMatchingDbClip = (projectClip: any, dbClips: any[], usedClipIds: Set<string>) => {
  let bestMatch: any = null;
  let bestScore = -1;

  for (const clip of dbClips) {
    if (usedClipIds.has(clip.id)) continue;

    const score = scoreClipMatch(projectClip, clip);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = clip;
    }
  }

  return bestScore > 0 ? bestMatch : null;
};

export const reimportVizardProjectToS3 = async (projectId: string) => {
  const projectData = await getVizardProjectStatus(projectId);
  if (!projectData) {
    throw new Error(`Не удалось получить проект ${projectId} из Vizard.`);
  }

  const actualData = projectData.data && !Array.isArray(projectData.data) ? projectData.data : projectData;
  const projectClips = getProjectClips(projectData);

  if (projectClips.length === 0) {
    throw new Error(`Проект ${projectId} не содержит доступных нарезок.`);
  }

  const externalVideoId =
    actualData?.external_id ||
    actualData?.externalId ||
    actualData?.projectName?.replace(/^Youtube_/, '') ||
    null;

  let videoRes = await query(
    "SELECT * FROM videos WHERE vizard_project_id = $1 OR id = $2 LIMIT 1",
    [projectId, externalVideoId]
  );
  let video = videoRes.rows[0];

  if (!video && !externalVideoId) {
    throw new Error(`Не удалось определить video_id для проекта ${projectId}.`);
  }

  if (!video) {
    await query(
      `INSERT INTO videos (id, title, status, vizard_project_id, published_at)
       VALUES ($1, $2, 'completed', $3, NOW())`,
      [externalVideoId, actualData?.projectName || `Imported Project ${projectId}`, projectId]
    );
    videoRes = await query("SELECT * FROM videos WHERE id = $1", [externalVideoId]);
    video = videoRes.rows[0];
  } else {
    await query(
      `UPDATE videos
       SET vizard_project_id = $1,
           title = COALESCE(NULLIF($2, ''), title),
           status = 'completed'
       WHERE id = $3`,
      [projectId, actualData?.projectName || '', video.id]
    );
    video = {
      ...video,
      vizard_project_id: projectId,
      title: actualData?.projectName || video.title,
      status: 'completed'
    };
  }

  const language = normalizeLang(video?.detected_language || video?.target_language);
  const existingClipsRes = await query(
    "SELECT id, title, hook, transcript, thumbnail FROM clips WHERE video_id = $1 ORDER BY created_at DESC",
    [video.id]
  );
  const existingClips = existingClipsRes.rows;
  const usedClipIds = new Set<string>();

  let created = 0;
  let updated = 0;
  let failed = 0;
  let primaryVideoThumbnail = normalizeText(video?.thumbnail) ? video.thumbnail : null;

  const plannedClips = projectClips.map((projectClip) => {
    const sourceUrl = getClipUrlFromProjectClip(projectClip);
    if (!sourceUrl) {
      return {
        sourceUrl: null,
        matchedClip: null,
        clipId: null,
        title: '',
        hook: '',
        transcript: ''
      };
    }

    const matchedClip = findMatchingDbClip(projectClip, existingClips, usedClipIds);
    const clipId = matchedClip?.id || Math.random().toString(36).slice(2, 11);
    const title = projectClip?.title || matchedClip?.title || 'Vizard Clip';
    const hook = projectClip?.hook || projectClip?.headline || matchedClip?.hook || '';
    const transcript = projectClip?.transcript || matchedClip?.transcript || '';

    if (matchedClip) {
      usedClipIds.add(clipId);
    }

    return {
      sourceUrl,
      matchedClip,
      clipId,
      title,
      hook,
      transcript
    };
  });

  const importResults = await mapWithConcurrency(
    plannedClips,
    VIZARD_CLIP_IMPORT_CONCURRENCY,
    async (plannedClip, index) => {
      const projectClip = projectClips[index];

      if (!plannedClip.sourceUrl || !plannedClip.clipId) {
        return { status: 'failed' as const, thumbnailUrl: null as string | null };
      }

      try {
        const storedClipUrl = await storeVizardClipInS3(plannedClip.sourceUrl, plannedClip.clipId, video.id);
        if (!storedClipUrl) {
          throw new Error('S3 upload returned empty URL');
        }

        let thumbnailUrl =
          projectClip?.thumbnail_url ||
          projectClip?.thumbnailUrl ||
          projectClip?.thumbnail ||
          plannedClip.matchedClip?.thumbnail ||
          '';
        try {
          const generatedThumb = await generateThumbnail(storedClipUrl, plannedClip.clipId);
          if (generatedThumb) thumbnailUrl = generatedThumb;
        } catch (thumbErr: any) {
          console.warn(`[Vizard Reimport] Thumbnail generation failed for ${plannedClip.clipId}:`, thumbErr.message);
        }

        if (plannedClip.matchedClip) {
          await query(
            `UPDATE clips
             SET url = $1,
                 source_url = $1,
                 title = $2,
                 hook = $3,
                 thumbnail = $4,
                 transcript = $5,
                 status = 'processed',
                 language = COALESCE($6, language)
             WHERE id = $7`,
            [storedClipUrl, plannedClip.title, plannedClip.hook, thumbnailUrl, plannedClip.transcript, language, plannedClip.clipId]
          );
          return { status: 'updated' as const, thumbnailUrl: thumbnailUrl || null };
        }

        await query(
          `INSERT INTO clips (id, video_id, url, source_url, title, hook, thumbnail, transcript, status, language)
           VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'processed', $8)`,
          [plannedClip.clipId, video.id, storedClipUrl, plannedClip.title, plannedClip.hook, thumbnailUrl, plannedClip.transcript, language]
        );
        return { status: 'created' as const, thumbnailUrl: thumbnailUrl || null };
      } catch (err: any) {
        console.error(`[Vizard Reimport] Failed for clip ${plannedClip.clipId} in project ${projectId}:`, err.message);
        return { status: 'failed' as const, thumbnailUrl: null as string | null };
      }
    }
  );

  for (const result of importResults) {
    if (result.status === 'created') {
      created += 1;
    } else if (result.status === 'updated') {
      updated += 1;
    } else {
      failed += 1;
    }

    if (!primaryVideoThumbnail && result.thumbnailUrl) {
      primaryVideoThumbnail = result.thumbnailUrl;
    }
  }

  if (primaryVideoThumbnail) {
    await query("UPDATE videos SET thumbnail = $1 WHERE id = $2", [primaryVideoThumbnail, video.id]);
  }

  console.log(
    `[Vizard Reimport] Project ${projectId}: processed ${projectClips.length} clips with concurrency ${VIZARD_CLIP_IMPORT_CONCURRENCY}. Created: ${created}, updated: ${updated}, failed: ${failed}.`
  );

  return {
    projectId,
    videoId: video.id,
    total: projectClips.length,
    created,
    updated,
    failed
  };
};
