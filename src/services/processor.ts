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

export const processClip = async (clipId: string, videoUrl: string, plaqueImageUrl: string | null, targetLang?: string | null, sourceLang?: string | null, skipS3Upload: boolean = false, watermarkText?: string): Promise<string> => {
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
                if (skipS3Upload) {
                    await query('UPDATE clips SET status = \'processed\' WHERE id = $1', [clipId]);
                    resolve(fileToUpload); // Resolve with the absolute local system path to the mp4
                    return;
                }

                const fileBuffer = fs.readFileSync(fileToUpload);
                const uploadResult = await uploadToS3(fileBuffer, `processed/${outputFileName}`, 'video/mp4');
                const finalUrl = uploadResult.Location || "";
                await query('UPDATE clips SET status = \'processed\', url = $1 WHERE id = $2', [finalUrl, clipId]);
                cleanupFiles();
                resolve(finalUrl);
            };

            if (plaqueImageUrl || watermarkText) {
                console.log(`Starting FFmpeg overlay for ${clipId} (Plaque: ${!!plaqueImageUrl}, Watermark: ${watermarkText || 'None'})`);

                let command = ffmpeg(currentVideoUrl);
                const filters: any[] = [];
                let lastOutput = '[0:v]';

                if (plaqueImageUrl) {
                    command = command.input(plaqueImageUrl);
                    filters.push({
                        filter: 'scale',
                        options: '720:-1',
                        inputs: '[1:v]',
                        outputs: 'plaque'
                    });
                    filters.push({
                        filter: 'overlay',
                        options: '0:H-h-50',
                        inputs: [lastOutput, 'plaque'],
                        outputs: 'with_plaque'
                    });
                    lastOutput = 'with_plaque';
                }

                if (watermarkText) {
                    filters.push({
                        filter: 'drawtext',
                        options: {
                            text: watermarkText,
                            fontcolor: 'white@0.6',
                            fontsize: 36,
                            x: 'W-tw-40',
                            y: '40',
                            shadowcolor: 'black',
                            shadowx: 2,
                            shadowy: 2
                        },
                        inputs: lastOutput,
                        outputs: 'final'
                    });
                    lastOutput = 'final';
                }

                command
                    .complexFilter(filters, lastOutput)
                    .videoCodec('libx264')
                    .on('end', () => finalizeUpload(outputPath))
                    .on('error', (err) => {
                        console.error('Error processing video:', err);
                        cleanupFiles();
                        reject(err);
                    })
                    .save(outputPath);
            } else {
                finalizeUpload(currentVideoUrl);
            }
        } catch (err) {
            console.error('Core process error:', err);
            reject(err);
        }
    });
};
