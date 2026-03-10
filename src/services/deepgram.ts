import { DeepgramClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import { uploadToS3 } from '../lib/s3.js';

dotenv.config();

const deepgram = process.env.DEEPGRAM_API_KEY ? new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY }) : null;

function formatTimeASS(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export const generateAndCacheSRT = async (clipId: string, videoFilePath: string, language?: string | null): Promise<string | null> => {
    if (!deepgram) {
        console.warn('DEEPGRAM_API_KEY is not set. Skipping transcription.');
        return null;
    }

    try {
        console.log(`Starting Deepgram transcription for ${clipId} (Lang: ${language || 'auto'})...`);

        const options: any = {
            model: 'nova-3',
            smart_format: true
        };

        if (language && language !== 'auto') {
            options.language = language;
        } else {
            options.detect_language = true;
        }

        let response: any;

        if (videoFilePath.startsWith('http://') || videoFilePath.startsWith('https://')) {
            response = await deepgram.listen.v1.media.transcribeUrl({
                url: videoFilePath,
                ...options
            });
        } else {
            const videoBuffer = fs.readFileSync(videoFilePath);
            response = await deepgram.listen.v1.media.transcribeFile(
                videoBuffer,
                options
            );
        }

        const words = response?.result?.results?.channels?.[0]?.alternatives?.[0]?.words || response?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
        if (words.length === 0) {
            console.log(`No words recognized for ${clipId}.`);
            return null;
        }

        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        let currentChunk: any[] = [];
        const MAX_WORDS_PER_CHUNK = 4;

        for (let i = 0; i < words.length; i++) {
            currentChunk.push(words[i]);

            let shouldBreak = false;
            if (currentChunk.length >= MAX_WORDS_PER_CHUNK) shouldBreak = true;
            if (i < words.length - 1 && words[i + 1].start - words[i].end > 0.4) shouldBreak = true;

            const wordText = words[i].punctuated_word || words[i].word;
            if (/[.!?]$/.test(wordText)) shouldBreak = true;

            if (shouldBreak || i === words.length - 1) {
                for (let j = 0; j < currentChunk.length; j++) {
                    const activeWord = currentChunk[j];
                    const nextWord = currentChunk[j + 1];
                    const chunkEnd = currentChunk[currentChunk.length - 1].end;

                    const start = formatTimeASS(activeWord.start);
                    const end = formatTimeASS(nextWord ? nextWord.start : chunkEnd);

                    let textParts = [];
                    for (let k = 0; k < currentChunk.length; k++) {
                        const w = currentChunk[k];
                        // Capitalize if it's the first word in the sentence
                        let wText = w.punctuated_word || w.word;
                        if (k === 0 && !/[A-Z]/.test(wText[0])) {
                            wText = wText.charAt(0).toUpperCase() + wText.slice(1);
                        }

                        // \r resets the style, \fscx/\fscy pop out the word, \1c sets color
                        if (k === j) {
                            textParts.push(`{\\r\\fscx115\\fscy115}${wText}`);
                        } else {
                            textParts.push(`{\\r\\1c&H808080&}${wText}`);
                        }
                    }
                    const textLine = textParts.join(' ').trim();
                    assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textLine}\n`;
                }

                currentChunk = [];
            }
        }

        const assBuffer = Buffer.from(assContent, 'utf-8');
        const uploadResult = await uploadToS3(assBuffer, `subtitles/${clipId}.ass`, 'text/plain');

        console.log(`Successfully generated and cached ASS for ${clipId} at ${uploadResult.Location}`);
        return uploadResult.Location || null;
    } catch (e) {
        console.error('Deepgram processing error:', e);
        return null;
    }
};
