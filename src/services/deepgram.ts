import { DeepgramClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import { uploadToS3 } from '../lib/s3.js';

dotenv.config();

const deepgram = process.env.DEEPGRAM_API_KEY ? new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY }) : null;

function formatTime(seconds: number): string {
    const d = new Date(seconds * 1000);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    const ms = String(d.getUTCMilliseconds()).padStart(3, '0').substring(0, 3);
    return `${h}:${m}:${s},${ms}`;
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

        let srtContent = '';
        let subtitleIndex = 1;

        let currentChunk: any[] = [];
        const MAX_WORDS_PER_CHUNK = 3;

        for (let i = 0; i < words.length; i++) {
            currentChunk.push(words[i]);

            let shouldBreak = false;
            // Break by chunk size limit
            if (currentChunk.length >= MAX_WORDS_PER_CHUNK) shouldBreak = true;

            // Break by long pause in speech
            if (i < words.length - 1 && words[i + 1].start - words[i].end > 0.4) shouldBreak = true;

            // Break by punctuation
            const wordText = words[i].punctuated_word || words[i].word;
            if (/[.!?]$/.test(wordText)) shouldBreak = true;

            if (shouldBreak || i === words.length - 1) {
                const start = formatTime(currentChunk[0].start);
                const end = formatTime(currentChunk[currentChunk.length - 1].end);

                // Capitalize the first letter of the chunk if it's the start of a sentence
                let text = currentChunk.map(w => w.punctuated_word || w.word).join(' ').trim();

                srtContent += `${subtitleIndex}\n${start} --> ${end}\n${text}\n\n`;
                subtitleIndex++;
                currentChunk = [];
            }
        }

        const srtBuffer = Buffer.from(srtContent, 'utf-8');
        const uploadResult = await uploadToS3(srtBuffer, `subtitles/${clipId}.srt`, 'text/plain');

        console.log(`Successfully generated and cached SRT for ${clipId} at ${uploadResult.Location}`);
        return uploadResult.Location || null;
    } catch (e) {
        console.error('Deepgram processing error:', e);
        return null;
    }
};
