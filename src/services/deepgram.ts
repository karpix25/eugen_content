import { DeepgramClient, createClient } from "@deepgram/sdk";
import fs from 'fs';
import { uploadToS3 } from "../lib/s3";
import crypto from 'crypto';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || "");

export const generateAndCacheSRT = async (
    clipId: string,
    videoUrl: string,
    language: string = 'auto',
    styleCategory: string = 'ali',
    fontColor: string = '&H00FFFFFF&',
    fontFamily: string = 'Anton'
): Promise<string | null> => {
    try {
        console.log(`Starting Deepgram transcription for ${clipId} (Lang: ${language}, Style: ${styleCategory}, Font: ${fontFamily})...`);

        const response = await deepgram.listen.prerecorded.transcribeUrl(
            { url: videoUrl },
            {
                smart_format: true,
                model: 'nova-2',
                language: language === 'auto' ? undefined : language,
                detect_language: language === 'auto',
                utterances: true,
                punctuate: true,
            }
        );

        const words = response.result?.results.channels[0].alternatives[0].words;
        if (!words) return null;

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
Style: Default,${fontFamily},48,&H00FFFFFF&,&H000000FF&,&H00000000&,&H00000000&,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        const wordsPerChunk = 3;
        for (let i = 0; i < words.length; i += wordsPerChunk) {
            const currentChunk = words.slice(i, i + wordsPerChunk);
            if (currentChunk.length > 0) {
                // Generate a line for each word being active within this chunk
                for (let j = 0; j < currentChunk.length; j++) {
                    const textParts: string[] = [];
                    const start = formatTime(currentChunk[j].start);
                    const end = formatTime(currentChunk[j].end);

                    for (let k = 0; k < currentChunk.length; k++) {
                        let wText = currentChunk[k].punctuated_word || currentChunk[k].word;

                        if (styleCategory === 'jordan') {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx120\\fscy120\\1c&H0000FFFF&}{\\p1\\fscx50\\fscy50\\1c&H0000FFFF&}m 0 0 l 20 0 20 20 0 20{\\p0} ${wText.toUpperCase()}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText.toUpperCase()}`);
                            }
                        } else if (styleCategory === 'luke') {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx125\\fscy125\\1c&H00FFFFFF&\\3c&H00FFFF00&}${wText.toUpperCase()}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText.toUpperCase()}`);
                            }
                        } else if (styleCategory === 'maya') {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx125\\fscy125\\1c&H00FFFFFF&\\3c&H0000A5FF&}${wText.toUpperCase()}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText.toUpperCase()}`);
                            }
                        } else if (styleCategory === 'sage') {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx125\\fscy125\\1c&H00FFFFFF&\\3c&H00FFFFFF&}${wText.toUpperCase()}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText.toUpperCase()}`);
                            }
                        } else if (styleCategory === 'beast' || styleCategory.includes('hormozi')) {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx120\\fscy120\\1c${fontColor}}${wText.toUpperCase()}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText.toUpperCase()}`);
                            }
                        } else if (styleCategory === 'celine') {
                            if (k === j) {
                                textParts.push(`{\\r\\fscx100\\fscy100\\1c${fontColor}}${wText}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00FFFFFF&}${wText}`);
                            }
                        } else {
                            // Default: Ali Style (Case capitalization for first word or active)
                            let processedWord = wText;
                            if (k === 0 && !/[A-Z]/.test(processedWord[0])) {
                                processedWord = processedWord.charAt(0).toUpperCase() + processedWord.slice(1);
                            }
                            if (k === j) {
                                textParts.push(`{\\r\\fscx115\\fscy115\\1c${fontColor}}${processedWord}`);
                            } else {
                                textParts.push(`{\\r\\1c&H00808080&}${processedWord}`);
                            }
                        }
                    }

                    const textLine = textParts.join(' ').trim();
                    assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textLine}\n`;
                }
            }
        }

        const assBuffer = Buffer.from(assContent, 'utf-8');
        const hash = `${styleCategory}_${fontColor}_${fontFamily}`.replace(/[^a-zA-Z0-9_]/g, '');
        const uploadResult = await uploadToS3(assBuffer, `subtitles/${clipId}_${hash}.ass`, 'text/plain');

        console.log(`Successfully generated and cached ASS for ${clipId} at ${uploadResult.Location}`);
        return uploadResult.Location || null;
    } catch (e) {
        console.error('Deepgram processing error:', e);
        return null;
    }
};
