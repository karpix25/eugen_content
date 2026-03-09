import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { query } from '../lib/db.js';
import { uploadToS3 } from '../lib/s3.js';
import { startDubbing, checkDubbingStatus, getDubbedFile } from './elevenlabs.js';

const downloadFile = async (url: string, outputPath: string) => {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
    });
};

const pollDubbingStatus = async (dubbingId: string): Promise<boolean> => {
    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const statusData = await checkDubbingStatus(dubbingId);

        if (statusData.status === 'dubbed') return true;
        if (statusData.status === 'failed') return false;
        console.log(`Dubbing ${dubbingId} still in progress...`);
    }
    return false;
};

export const processClip = async (clipId: string, videoUrl: string, plaqueImageUrl: string | null, targetLang?: string | null, sourceLang?: string | null): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const outputDir = path.join(process.cwd(), 'temp', 'processed');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            console.log(`Processing clip ${clipId} from ${videoUrl} (Target: ${targetLang || 'Original'})`);

            let currentVideoUrl = videoUrl;
            let tempDubbedFile = path.join(outputDir, `${clipId}_dubbed.mp4`);
            let tempOriginalFile = path.join(outputDir, `${clipId}_original.mp4`);

            if (targetLang && sourceLang && targetLang !== sourceLang) {
                console.log(`Starting ElevenLabs dubbing ${sourceLang} -> ${targetLang}`);
                await downloadFile(videoUrl, tempOriginalFile);
                const fileBuffer = fs.readFileSync(tempOriginalFile);

                const dubbingId = await startDubbing(fileBuffer, `${clipId}.mp4`, targetLang, sourceLang);

                if (dubbingId && await pollDubbingStatus(dubbingId)) {
                    const dubbedBuffer = await getDubbedFile(dubbingId, targetLang);
                    if (dubbedBuffer) {
                        fs.writeFileSync(tempDubbedFile, dubbedBuffer);
                        currentVideoUrl = tempDubbedFile;
                        console.log(`Successfully dubbed clip ${clipId}.`);
                    }
                } else {
                    console.warn(`Dubbing failed for ${clipId}. Falling back to original.`);
                }
            }

            const outputFileName = `${clipId}_branded.mp4`;
            const outputPath = path.join(outputDir, outputFileName);

            const cleanupFiles = () => {
                [outputPath, tempDubbedFile, tempOriginalFile].forEach(f => {
                    if (fs.existsSync(f)) fs.unlinkSync(f);
                });
            };

            const finalizeUpload = async (fileToUpload: string) => {
                const fileBuffer = fs.readFileSync(fileToUpload);
                const uploadResult = await uploadToS3(fileBuffer, `processed/${outputFileName}`, 'video/mp4');
                const finalUrl = uploadResult.Location || "";
                await query('UPDATE clips SET status = \'processed\', url = $1 WHERE id = $2', [finalUrl, clipId]);
                cleanupFiles();
                resolve(finalUrl);
            };

            if (plaqueImageUrl) {
                console.log(`Starting FFmpeg overlay for ${clipId}`);
                ffmpeg(currentVideoUrl)
                    .input(plaqueImageUrl)
                    .complexFilter([
                        '[1:v]scale=720:-1[plaque]',
                        '[0:v][plaque]overlay=0:H-h-50[v]'
                    ])
                    .map('[v]')
                    .videoCodec('libx264')
                    .on('end', () => finalizeUpload(outputPath))
                    .on('error', (err) => {
                        console.error('Error processing video:', err);
                        cleanupFiles();
                        reject(err);
                    })
                    .save(outputPath);
            } else {
                if (currentVideoUrl === tempDubbedFile) {
                    await finalizeUpload(tempDubbedFile);
                } else {
                    await query('UPDATE clips SET status = \'processed\' WHERE id = $1', [clipId]);
                    resolve(currentVideoUrl);
                }
            }
        } catch (e) {
            reject(e);
        }
    });
};
