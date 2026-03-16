import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'streamers~youtube-scraper';

const apifyRequest = async (method: 'get' | 'post', url: string, data?: any, retries: number = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
        try {
            if (method === 'get') return await axios.get(url);
            return await axios.post(url, data);
        } catch (e: any) {
            const status = e.response?.status;
            if (i < retries - 1 && (status === 502 || status === 503 || status === 504 || !status)) {
                console.warn(`Apify transient error (${status || 'network'}). Retrying ${i + 1}/${retries}...`);
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                continue;
            }
            throw e;
        }
    }
};

const waitForRun = async (runId: string, timeoutMs: number = 300000): Promise<string | null> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const statusRes = await apifyRequest('get', `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
            const status = statusRes.data.data.status;
            const datasetId = statusRes.data.data.defaultDatasetId;
            console.log(`Apify Run ${runId} Status: ${status}`);
            
            if (status === 'SUCCEEDED') return datasetId;
            if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return null;
            
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.warn(`Error polling run ${runId}, retrying...`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    return null;
};

export const getDatasetItems = async (datasetId: string): Promise<any[]> => {
    try {
        const res = await apifyRequest('get', `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        return res.data;
    } catch (e) {
        console.error(`Error fetching dataset ${datasetId}:`, e);
        return [];
    }
};

export const getChannelInfo = async (channelUrl: string): Promise<{ id: string, name: string, handle?: string, thumbnail: string, subscribers: number } | null> => {
    if (!APIFY_TOKEN) return null;
    try {
        let normalizedUrl = channelUrl.trim();
        // If it looks like a handle or ID but not a URL
        if (!normalizedUrl.startsWith('http')) {
            if (normalizedUrl.startsWith('@') || !normalizedUrl.includes('/')) {
                const handle = normalizedUrl.startsWith('@') ? normalizedUrl : '@' + normalizedUrl;
                normalizedUrl = `https://www.youtube.com/${handle}`;
            } else if (normalizedUrl.length === 24 && normalizedUrl.startsWith('UC')) {
                normalizedUrl = `https://www.youtube.com/channel/${normalizedUrl}`;
            }
        }

        console.log(`Fetching channel info via Apify for: ${normalizedUrl}`);
        const runResponse = await apifyRequest('post', `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
            startUrls: [{ url: normalizedUrl }],
            maxResultDeserializationLimit: 1
        });
        const runId = runResponse.data.data.id;
        console.log(`Apify Channel Info Run ID: ${runId}`);

        const datasetId = await waitForRun(runId);
        if (!datasetId) return null;

        const items = await getDatasetItems(datasetId);
        console.log(`Apify Dataset Items Count: ${items.length}`);
        const item = items[0];
        if (item) {
            let handle = item.channelUsername || item.handle;
            // Extract from URL if still missing
            if (!handle && item.channelUrl) {
                const handleMatch = item.channelUrl.match(/youtube\.com\/(@[\w.-]+)/);
                if (handleMatch) handle = handleMatch[1];
            }

            return {
                id: item.channelId || item.id,
                name: item.channelName || item.title,
                handle: handle,
                thumbnail: item.channelAvatarUrl || item.channelThumbnail || item.thumbnailUrl,
                subscribers: item.numberOfSubscribers || 0
            };
        }
    } catch (e) {
        console.error("Apify channel info error:", e);
    }
    return null;
};

export const getLatestVideos = async (channelUrl: string, limit: number = 20, scrapeDays: number | string = 7): Promise<any[]> => {
    if (!APIFY_TOKEN) return [];
    try {
        console.log(`Fetching latest videos and transcripts via Apify for: ${channelUrl} (filter: ${scrapeDays})`);

        let oldestPostDate: string;
        let dateFilter: string = 'week';

        if (typeof scrapeDays === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scrapeDays)) {
            // It's a date string (YYYY-MM-DD)
            oldestPostDate = scrapeDays;
            // Approximate dateFilter based on how far back the date is (default to year if we can't tell easily)
            dateFilter = 'year'; 
        } else {
            // It's a number of days
            const days = typeof scrapeDays === 'number' ? scrapeDays : parseInt(scrapeDays) || 7;
            oldestPostDate = `${days} days`;
            dateFilter = days <= 1 ? 'today' : (days <= 7 ? 'week' : (days <= 31 ? 'month' : 'year'));
        }

        const payload: any = {
            startUrls: [{ url: channelUrl }],
            maxResults: limit,
            dateFilter,
            oldestPostDate,
            sortVideosBy: "NEWEST",
            sortingOrder: "relevance",
            downloadSubtitles: true,
            subtitlesFormat: "plaintext",
            subtitlesLanguage: "any",
            videoType: "video",
            hasCC: false,
            hasLocation: false,
            hasSubtitles: false,
            is360: false,
            is3D: false,
            is4K: false,
            isBought: false,
            isHD: false,
            isHDR: false,
            isLive: false,
            isVR180: false,
            preferAutoGeneratedSubtitles: false,
            saveSubsToKVS: false,
            maxResultsShorts: 0,
            maxResultStreams: 0
        };

        const runResponse = await apifyRequest('post', `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, payload);
        const runId = runResponse.data.data.id;

        const datasetId = await waitForRun(runId);
        if (!datasetId) return [];

        const items = await getDatasetItems(datasetId);
        if (items.length === 1 && items[0].error === 'NO_RESULTS') {
            console.log(`Apify: No results found for ${channelUrl} with current filters.`);
            return [];
        }

        return items
          .filter((v: any) => !v.error) // Skip any error items
          .map((v: any, index: number) => {
            let transcript = null;
            if (v.subtitles && Array.isArray(v.subtitles) && v.subtitles.length > 0) {
                transcript = v.subtitles[0].plaintext || v.subtitles[0].text;
            } else if (typeof v.subtitles === 'string') {
                transcript = v.subtitles;
            }

            // Extract ID from URL if missing
            let videoId = v.id || v.videoId || v.video_id;
            if (!videoId && v.url) {
                const match = v.url.match(/(?:v=|shorts\/|be\/)([\w-]{11})/);
                if (match) videoId = match[1];
            }

            if (!videoId) {
                console.warn(`Apify mapping: Undefined ID for item ${index}. Raw item keys: ${Object.keys(v).join(', ')}`);
                if (index === 0) console.log("First item sample:", JSON.stringify(v).substring(0, 500));
            }

            return {
                id: videoId,
                title: v.title || v.text || v.name,
                description: v.description || v.text || '',
                publishedAt: v.date || v.publishedAt || v.publishedAtISO || v.createdAt,
                thumbnail: v.thumbnailUrl || v.thumbnail || v.coverUrl,
                transcript: transcript
            };
        });
    } catch (e) {
        console.error("Apify latest videos error:", e);
    }
    return [];
};

export const getTranscript = async (videoUrl: string): Promise<string | null> => {
    if (!APIFY_TOKEN) return null;
    try {
        console.log(`Starting Apify YouTube Scraper for: ${videoUrl}`);

        const runResponse = await apifyRequest('post', 
            `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
            {
                startUrls: [{ url: videoUrl }],
                downloadSubtitles: true,
                subtitleLanguage: 'Any',
                subtitleFormat: 'plaintext',
                preferAutoGeneratedSubtitles: false,
                maxResultDeserializationLimit: 1
            }
        );

        const runId = runResponse.data.data.id;
        console.log(`Apify transcript run started: ${runId}. Waiting for completion...`);

        const datasetId = await waitForRun(runId);
        if (!datasetId) return null;

        const items = await getDatasetItems(datasetId);
        if (items && items.length > 0) {
            const videoData = items[0];
            if (videoData.subtitles && Array.isArray(videoData.subtitles)) {
                if (typeof videoData.subtitles[0] === 'string') {
                    return videoData.subtitles.join('\n');
                } else if (videoData.subtitles[0].text) {
                    return videoData.subtitles.map((s: any) => s.text).join('\n');
                } else {
                    return JSON.stringify(videoData.subtitles);
                }
            } else if (typeof videoData.subtitles === 'string') {
                return videoData.subtitles;
            }
            return videoData.description || videoData.title || null;
        }
        return null;
    } catch (error) {
        console.error('Error fetching transcript from Apify:', error);
        return null;
    }
};
