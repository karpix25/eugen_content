import fs from 'fs';
import { uploadToS3 } from "../lib/s3";

export const generateAndCacheSRT = async (
    clipId: string,
    videoUrl: string,
    language: string = 'auto',
    styleCategory: string = 'karaoke',
    fontColor: string = '&H0000FFFF&',
    fontFamily: string = 'Anton',
    fontSize: number = 48
): Promise<string | null> => {
    try {
        console.log(`Starting Deepgram transcription for ${clipId} (Lang: ${language}, Style: ${styleCategory}, Font: ${fontFamily}, Size: ${fontSize})...`);

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
        if (result && result.results) {
            console.log(`Deepgram channels length:`, result.results.channels?.length);
        } else {
            console.log(`Deepgram results object is empty or missing! Full result:`, JSON.stringify(result).substring(0, 500));
        }

        const words = result?.results?.channels?.[0]?.alternatives?.[0]?.words;
        if (!words || words.length === 0) {
            console.error('Deepgram returned no words array or it is empty! Response structure:', JSON.stringify(result).substring(0, 500));
            return null;
        }

        const formatTime = (seconds: number) => {
            const date = new Date(seconds * 1000);
            const hh = date.getUTCHours().toString().padStart(1, '0');
            const mm = date.getUTCMinutes().toString().padStart(2, '0');
            const ss = date.getUTCSeconds().toString().padStart(2, '0');
            const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
            return `${hh}:${mm}:${ss}.${ms}`;
        };

        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        if (styleCategory === '1_word') {
            for (const word of words) {
                const wText = (word.punctuated_word || word.word).toUpperCase();
                const start = formatTime(word.start);
                const end = formatTime(word.end);
                assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\1c${fontColor}}${wText}\n`;
            }
        } else {
            const wordsPerChunk = 3;
            for (let i = 0; i < words.length; i += wordsPerChunk) {
                const currentChunk = words.slice(i, i + wordsPerChunk);
                if (currentChunk.length === 0) continue;

                if (styleCategory === '3_words') {
                    // Show 3 words at once
                    const start = formatTime(currentChunk[0].start);
                    const end = formatTime(currentChunk[currentChunk.length - 1].end);
                    const text = currentChunk.map((w: any) => (w.punctuated_word || w.word).toUpperCase()).join(' ');
                    assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\1c${fontColor}}${text}\n`;
                } else {
                    // Default to karaoke
                    for (let j = 0; j < currentChunk.length; j++) {
                        const wordStart = j === 0 ? currentChunk[0].start : currentChunk[j].start;
                        // Extend duration to next word to avoid flickering, or use actual end if it's the last word
                        const wordEnd = j < currentChunk.length - 1 ? currentChunk[j + 1].start : currentChunk[j].end;

                        const start = formatTime(wordStart);
                        const end = formatTime(wordEnd);

                        const textParts = currentChunk.map((w: any, k: number) => {
                            const wText = (w.punctuated_word || w.word).toUpperCase();
                            if (k === j) {
                                return `{\\r\\fscx110\\fscy110\\1c${fontColor}}${wText}`;
                            } else {
                                return `{\\r\\1c&H00FFFFFF&}${wText}`;
                            }
                        });
                        const textLine = textParts.join(' ').trim();
                        assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textLine}\n`;
                    }
                }
            }
        }

        const assBuffer = Buffer.from(assContent, 'utf-8');
        const hash = `${styleCategory}_${fontColor}_${fontFamily}_${fontSize}`.replace(/[^a-zA-Z0-9_]/g, '');
        const uploadResult = await uploadToS3(assBuffer, `subtitles/${clipId}_${hash}.ass`, 'text/plain');

        console.log(`Successfully generated and cached ASS for ${clipId} at ${uploadResult.Location}`);
        return uploadResult.Location || null;
    } catch (e) {
        console.error('Deepgram processing error:', e);
        return null;
    }
};
