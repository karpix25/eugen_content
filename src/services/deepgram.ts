import { query } from "../lib/db.js";
import { uploadToS3 } from "../lib/s3";

export interface SubtitleConfig {
    language?: string;
    style?: string;
    fontColor?: string;
    highlightColor?: string;
    outlineColor?: string;
    highlightEnabled?: boolean;
    fontFamily?: string;
    fontSize?: number;
    position?: string;
}

type DeepgramWord = {
    word?: string;
    punctuated_word?: string;
    start: number;
    end: number;
};

const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(1, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
};

const buildAssFromWords = (words: DeepgramWord[], config: Required<SubtitleConfig>) => {
    const {
        style: styleCategory,
        fontColor,
        highlightColor,
        outlineColor,
        highlightEnabled,
        fontFamily,
        fontSize,
        position
    } = config;

    const posValue = isNaN(Number(position)) ? 80 : Math.max(2, Math.min(95, Number(position)));
    const marginV = Math.floor((posValue / 100) * 1280);

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${fontColor},&H000000FF,${outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,3,2,8,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    if (styleCategory === '1_word') {
        for (const word of words) {
            const wText = (word.punctuated_word || word.word || '').toUpperCase();
            const start = formatTime(word.start);
            const end = formatTime(word.end);
            assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${wText}\n`;
        }
        return assContent;
    }

    const wordsPerChunk = 3;
    for (let i = 0; i < words.length; i += wordsPerChunk) {
        const currentChunk = words.slice(i, i + wordsPerChunk);
        if (currentChunk.length === 0) continue;

        if (styleCategory === '3_words') {
            const start = formatTime(currentChunk[0].start);
            const end = formatTime(currentChunk[currentChunk.length - 1].end);
            const text = currentChunk.map((w) => (w.punctuated_word || w.word || '').toUpperCase()).join(' ');
            assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\1c${fontColor}}${text}\n`;
            continue;
        }

        for (let j = 0; j < currentChunk.length; j++) {
            const wordStart = j === 0 ? currentChunk[0].start : currentChunk[j].start;
            const wordEnd = j < currentChunk.length - 1 ? currentChunk[j + 1].start : currentChunk[j].end;
            const start = formatTime(wordStart);
            const end = formatTime(wordEnd);

            const textParts = currentChunk.map((w, k) => {
                const wText = (w.punctuated_word || w.word || '').toUpperCase();
                if (k === j && highlightEnabled) {
                    return `{\\fscx110\\fscy110\\1c${highlightColor}}${wText}{\\fscx100\\fscy100\\1c${fontColor}}`;
                }

                return `{\\1c${fontColor}}${wText}`;
            });

            assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textParts.join(' ').trim()}\n`;
        }
    }

    return assContent;
};

const fetchAndCacheDeepgramWords = async (
    clipId: string,
    videoUrl: string,
    language: string
): Promise<{ words: DeepgramWord[]; detectedLanguage: string | null; transcript: string | null } | null> => {
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&utterances=true${language !== 'auto' ? `&language=${language}` : '&detect_language=true'}`;

    const response = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: videoUrl })
    });

    if (!response.ok) {
        console.error('Deepgram API returned an error:', response.status, await response.text());
        return null;
    }

    const result = await response.json();
    console.log(`Deepgram transcription result object keys for ${clipId}:`, Object.keys(result || {}));

    const channel = result?.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];
    const words = alternative?.words;

    if (!words || words.length === 0) {
        console.error('Deepgram returned no words array or it is empty! Response structure:', JSON.stringify(result).substring(0, 500));
        return null;
    }

    const transcript = alternative?.transcript || null;
    const detectedLanguage = channel?.detected_language || channel?.language || (language !== 'auto' ? language : null);

    await query(
        `UPDATE clips
         SET deepgram_words = $1,
             deepgram_language = COALESCE($2, deepgram_language),
             transcript = COALESCE(NULLIF($3, ''), transcript)
         WHERE id = $4`,
        [JSON.stringify(words), detectedLanguage, transcript || '', clipId]
    );

    return { words, detectedLanguage, transcript };
};

const ensureDeepgramWords = async (clipId: string, videoUrl: string, language: string) => {
    const clipRes = await query(
        "SELECT deepgram_words, deepgram_language FROM clips WHERE id = $1",
        [clipId]
    );
    const cached = clipRes.rows[0];
    const cachedWords = cached?.deepgram_words;

    if (Array.isArray(cachedWords) && cachedWords.length > 0) {
        return {
            words: cachedWords as DeepgramWord[],
            detectedLanguage: cached?.deepgram_language || null
        };
    }

    if (typeof cachedWords === 'string') {
        try {
            const parsedWords = JSON.parse(cachedWords);
            if (Array.isArray(parsedWords) && parsedWords.length > 0) {
                return {
                    words: parsedWords as DeepgramWord[],
                    detectedLanguage: cached?.deepgram_language || null
                };
            }
        } catch {
            // ignore malformed legacy payload and fetch again
        }
    }

    console.log(`Starting Deepgram transcription for ${clipId} (Lang: ${language})...`);
    return fetchAndCacheDeepgramWords(clipId, videoUrl, language);
};

export const generateAndCacheSRT = async (
    clipId: string,
    videoUrl: string,
    config: SubtitleConfig
): Promise<string | null> => {
    try {
        const {
            language = 'auto',
            style: styleCategory = 'karaoke',
            fontColor = '&H00FFFFFF&',
            highlightColor = '&H0000FFFF&',
            outlineColor = '&H00000000&',
            highlightEnabled = true,
            fontFamily = 'Anton',
            fontSize = 48,
            position = '80'
        } = config;

        console.log(`Preparing subtitles for ${clipId} (Lang: ${language}, Style: ${styleCategory}, Font: ${fontFamily}, Size: ${fontSize}, Pos: ${position})...`);

        const deepgramData = await ensureDeepgramWords(clipId, videoUrl, language);
        if (!deepgramData?.words || deepgramData.words.length === 0) {
            return null;
        }

        const assContent = buildAssFromWords(deepgramData.words, {
            language,
            style: styleCategory,
            fontColor,
            highlightColor,
            outlineColor,
            highlightEnabled,
            fontFamily,
            fontSize,
            position
        });

        const assBuffer = Buffer.from(assContent, 'utf-8');
        const hash = `v2_${styleCategory}_${fontColor}_${highlightColor}_${outlineColor}_${highlightEnabled}_${fontFamily}_${fontSize}_${position}`.replace(/[^a-zA-Z0-9_]/g, '');
        const uploadResult = await uploadToS3(assBuffer, `subtitles/${clipId}_${hash}.ass`, 'text/plain');

        console.log(`Successfully generated and cached ASS for ${clipId} at ${uploadResult.Location}`);
        return uploadResult.Location || null;
    } catch (e) {
        console.error('Deepgram processing error:', e);
        return null;
    }
};
