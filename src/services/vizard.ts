import axios from 'axios';
import dotenv from 'dotenv';
import { query } from '../lib/db.js';
import { uploadToS3 } from '../lib/s3.js';

dotenv.config();

const VIZARD_API_KEY = process.env.VIZARD_API_KEY;
const VIZARD_URL_REFRESH_BUFFER_SECONDS = 300;

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const getProjectClips = (statusData: any): any[] => {
    if (!statusData) return [];
    if (Array.isArray(statusData.videos)) return statusData.videos;
    if (Array.isArray(statusData.data)) return statusData.data;
    if (Array.isArray(statusData.data?.videos)) return statusData.data.videos;
    if (Array.isArray(statusData.list)) return statusData.list;
    if (Array.isArray(statusData.clips)) return statusData.clips;
    return [];
};

const getClipUrlFromProjectClip = (clip: any): string | null => {
    return clip?.videoUrl || clip?.url || clip?.video_url || null;
};

export const isTemporaryVizardUrl = (url?: string | null) => {
    if (!url) return false;

    try {
        const parsed = new URL(url);
        return parsed.hostname.includes('vizard.ai') || parsed.hostname.includes('vizard');
    } catch {
        return false;
    }
};

export const isExpiredOrNearExpiryUrl = (url?: string | null, bufferSeconds = VIZARD_URL_REFRESH_BUFFER_SECONDS) => {
    if (!url) return false;

    try {
        const parsed = new URL(url);
        const expiresRaw = parsed.searchParams.get('Expires');
        if (!expiresRaw) return false;

        const expiresAt = Number(expiresRaw);
        if (!Number.isFinite(expiresAt)) return false;

        return expiresAt <= Math.floor(Date.now() / 1000) + bufferSeconds;
    } catch {
        return false;
    }
};

const findMatchingProjectClip = (
    currentClip: { title?: string | null; hook?: string | null; transcript?: string | null },
    projectClips: any[]
) => {
    if (projectClips.length === 0) return null;
    if (projectClips.length === 1) return projectClips[0];

    const targetTitle = normalizeText(currentClip.title);
    const targetHook = normalizeText(currentClip.hook);
    const targetTranscriptPrefix = normalizeText(currentClip.transcript).slice(0, 120);

    let bestCandidate: any = null;
    let bestScore = -1;

    for (const candidate of projectClips) {
        const candidateTitle = normalizeText(candidate?.title);
        const candidateHook = normalizeText(candidate?.hook || candidate?.headline);
        const candidateTranscriptPrefix = normalizeText(candidate?.transcript).slice(0, 120);

        let score = 0;

        if (targetTitle && candidateTitle) {
            if (targetTitle === candidateTitle) score += 6;
            else if (targetTitle.includes(candidateTitle) || candidateTitle.includes(targetTitle)) score += 3;
        }

        if (targetHook && candidateHook) {
            if (targetHook === candidateHook) score += 4;
            else if (targetHook.includes(candidateHook) || candidateHook.includes(targetHook)) score += 2;
        }

        if (targetTranscriptPrefix && candidateTranscriptPrefix) {
            if (targetTranscriptPrefix === candidateTranscriptPrefix) score += 5;
            else if (
                targetTranscriptPrefix.startsWith(candidateTranscriptPrefix.slice(0, 80)) ||
                candidateTranscriptPrefix.startsWith(targetTranscriptPrefix.slice(0, 80))
            ) {
                score += 2;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    }

    return bestScore > 0 ? bestCandidate : null;
};

const mirrorClipToS3 = async (sourceUrl: string, clipId: string, videoId: string) => {
    const response = await axios.get<ArrayBuffer>(sourceUrl, {
        responseType: 'arraybuffer'
    });

    const uploadResult = await uploadToS3(
        Buffer.from(response.data),
        `vizard-clips/${videoId}/${clipId}.mp4`,
        response.headers['content-type'] || 'video/mp4'
    );

    return uploadResult.Location || null;
};

export const refreshClipUrlFromVizard = async (clipId: string) => {
    const clipRes = await query(
        `SELECT c.id, c.video_id, c.title, c.hook, c.transcript, c.thumbnail, c.url, v.vizard_project_id
         FROM clips c
         JOIN videos v ON v.id = c.video_id
         WHERE c.id = $1`,
        [clipId]
    );
    const clip = clipRes.rows[0];

    if (!clip?.vizard_project_id) {
        return clip?.url || null;
    }

    const statusData = await getVizardProjectStatus(clip.vizard_project_id);
    const projectClips = getProjectClips(statusData);
    const matchedClip = findMatchingProjectClip(clip, projectClips);
    const refreshedUrl = getClipUrlFromProjectClip(matchedClip);
    const refreshedThumb = matchedClip?.thumbnail_url || matchedClip?.thumbnailUrl || matchedClip?.thumbnail || clip.thumbnail || null;

    if (!refreshedUrl) {
        return clip.url || null;
    }

    let finalUrl = refreshedUrl;

    try {
        const mirroredUrl = await mirrorClipToS3(refreshedUrl, clip.id, clip.video_id);
        if (mirroredUrl) {
            finalUrl = mirroredUrl;
        }
    } catch (mirrorErr: any) {
        console.warn(`[Vizard] Failed to mirror clip ${clipId} to S3, using fresh Vizard URL directly:`, mirrorErr.message);
    }

    await query(
        "UPDATE clips SET url = $1, thumbnail = COALESCE($2, thumbnail) WHERE id = $3",
        [finalUrl, refreshedThumb, clipId]
    );

    return finalUrl;
};

export const ensurePlayableClipUrl = async (clipId: string, currentUrl?: string | null) => {
    if (currentUrl && (!isTemporaryVizardUrl(currentUrl) || !isExpiredOrNearExpiryUrl(currentUrl))) {
        return currentUrl;
    }

    return refreshClipUrlFromVizard(clipId);
};

export const sendToVizard = async (
    videoUrl: string, 
    videoId: string, 
    options: {
        videoType?: number;
        ext?: string;
        preferLength?: number[];
        removeSilenceSwitch?: number;
        autoBrollSwitch?: number;
    } = {}
): Promise<string | null> => {
    const { 
        videoType = 2, 
        ext = 'mp4',
        preferLength = [2],
        removeSilenceSwitch = 0,
        autoBrollSwitch = 0
    } = options;

    if (!VIZARD_API_KEY) {
        console.error('VIZARD_API_KEY is not set');
        return null;
    }

    try {
        const payload = {
            videoUrl: videoUrl,
            videoType: videoType, 
            lang: 'auto', // Auto detection
            preferLength: preferLength,
            removeSilenceSwitch: removeSilenceSwitch,
            autoBrollSwitch: autoBrollSwitch,
            ratioOfClip: 1, // Vertical 9:16
            ext: ext, 
            subtitleSwitch: 0, // Disable subtitles
            headlineSwitch: 0, // Disable headlines
            projectName: `Youtube_${videoId}`,
            externalId: videoId,
            external_id: videoId
        };

        console.log(`Sending payload to Vizard:`, JSON.stringify(payload, null, 2));

        const response = await axios.post(
            'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create',
            payload,
            {
                headers: {
                    'VIZARDAI_API_KEY': VIZARD_API_KEY,
                    'Content-Type': 'application/json',
                },
                validateStatus: (status) => true // Handle all status codes
            }
        );

        console.log(`Vizard API Response:`, JSON.stringify(response.data, null, 2));

        const data = response.data;
        // Check for success codes or presence of project ID
        let vizardId = data.projectId || data.id || data.project_id || data.data?.project_id || data.data?.id;
        
        // Sometimes it might be in the 'projectName' if the API is weird, but usually it's an ID
        if (!vizardId && data.data?.projectId) vizardId = data.data.projectId;

        if (data.code === 0 || data.code === 2000 || data.success || vizardId) {
            return vizardId || "unknown_id";
        } else if (data.code === 4005 || (data.errMsg && data.errMsg.includes("exists"))) {
            // Project might already exist
            console.warn(`Vizard project might already exist: ${data.errMsg}`);
            return vizardId || "project_exists_but_no_id";
        } else {
            console.error(`Vizard returned error code ${data.code}: ${data.errMsg || data.message}`);
            return null;
        }
    } catch (error: any) {
        console.error('Error sending video to Vizard:', error.response?.data || error.message);
        return null;
    }
};

export const getVizardProjectStatus = async (projectId: string): Promise<any> => {
    if (!VIZARD_API_KEY) return null;
    try {
        const response = await axios.get(
            `https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/${projectId}`,
            {
                headers: {
                    'VIZARDAI_API_KEY': VIZARD_API_KEY,
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(`Error polling Vizard project ${projectId}:`, error.response?.data || error.message);
        return null;
    }
};

export const listVizardProjects = async (pageNo = 1, pageSize = 50): Promise<any[]> => {
    if (!VIZARD_API_KEY) return [];
    try {
        const response = await axios.get(
            `https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/list`,
            {
                params: { pageNo, pageSize },
                headers: {
                    'VIZARDAI_API_KEY': VIZARD_API_KEY,
                }
            }
        );
        return response.data?.list || response.data?.data?.list || [];
    } catch (error: any) {
        console.error('Error listing Vizard projects:', error.message);
        return [];
    }
};
