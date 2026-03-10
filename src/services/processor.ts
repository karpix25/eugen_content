import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { query } from '../lib/db.js';
import { uploadToS3 } from '../lib/s3.js';
import { startDubbing, checkDubbingStatus, getDubbedFile } from './elevenlabs.js';
import { generateAndCacheSRT } from './deepgram.js';

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

export const processClip = async (
    clipId: string,
    videoUrl: string,
    plaqueImageUrl: string | null,
    targetLang?: string | null,
    sourceLang?: string | null,
    skipS3Upload: boolean = false,
    watermarkConfig?: { text: string, opacity: number, position: string },
    subtitleConfig?: { enabled: boolean, font_size: number, font_color: string, position: string, style?: string }
): Promise<string> => {
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

            // Convert #RRGGBB to &H00BBGGRR (ASS color format) for deepgram
            let hexColor = subtitleConfig?.font_color || '#FFFFFF';
            hexColor = hexColor.replace('#', '');
            const r = hexColor.substring(0, 2);
            const g = hexColor.substring(2, 4);
            const b = hexColor.substring(4, 6);
            const assColor = `&H00${b}${g}${r}`;

            let srtFilePath: string | null = null;
            if (subtitleConfig && subtitleConfig.enabled) {
                const srtRes = await query("SELECT srt_url FROM clips WHERE id = $1", [clipId]);
                let srtUrl = srtRes.rows[0]?.srt_url;

                if (!srtUrl) {
                    srtUrl = await generateAndCacheSRT(clipId, currentVideoUrl, targetLang || sourceLang, subtitleConfig?.style || 'ali', assColor);
                    if (srtUrl) {
                        await query("UPDATE clips SET srt_url = $1 WHERE id = $2", [srtUrl, clipId]);
                    }
                }

                if (srtUrl) {
                    // Check if S3 returned an older .srt or the new .ass Submagic format
                    const isAss = srtUrl.endsWith('.ass');
                    const ext = isAss ? '.ass' : '.srt';
                    srtFilePath = path.join(outputDir, `${clipId}${ext}`);
                    await downloadFile(srtUrl, srtFilePath);
                }
            }

            const cleanupFiles = () => {
                [outputPath, tempDubbedFile, tempOriginalFile].forEach(f => {
                    if (fs.existsSync(f)) fs.unlinkSync(f);
                });
                if (srtFilePath && fs.existsSync(srtFilePath)) fs.unlinkSync(srtFilePath);
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

            if (plaqueImageUrl || watermarkConfig || srtFilePath) {
                console.log(`Starting FFmpeg overlay for ${clipId} (Plaque: ${!!plaqueImageUrl}, Watermark: ${watermarkConfig?.text || 'None'}, Subs: ${!!srtFilePath})`);

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

                if (srtFilePath) {
                    let alignment = 2; // Bottom Center
                    let marginV = 20;
                    if (subtitleConfig?.position === 'Top') {
                        alignment = 8; // Top Center
                        marginV = 80;
                    } else if (subtitleConfig?.position === 'Center') {
                        alignment = 5; // Middle Center
                    }

                    const fontSize = subtitleConfig?.font_size || 16;
                    const escapedSrtPath = srtFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');

                    const isAss = srtFilePath.endsWith('.ass');
                    const styleName = subtitleConfig?.style || 'ali';

                    let style = '';
                    if (isAss) {
                        if (styleName === 'beast') {
                            // BEAST STYLE: Colored active/outline, black glow/bold background
                            style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=6,Shadow=3,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                        } else if (styleName.includes('hormozi')) {
                            // HORMOZI STYLE: No background box, very thick shadow, Yellow/White colors text
                            style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=4,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                        } else if (styleName === 'celine') {
                            // CELINE STYLE: Standard subtitles, no box, outline
                            style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Bold=0,Alignment=${alignment},MarginV=${marginV}`;
                        } else {
                            // ALI STYLE: Box background (BorderStyle=3), Light Gray Box, No shadow
                            style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00F0F0F0,BackColour=&H00F0F0F0,BorderStyle=3,Outline=10,Shadow=0,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                        }
                    } else {
                        // LEGACY STYLE
                        style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H80000000,BorderStyle=1,Outline=3,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    }

                    filters.push({
                        filter: 'subtitles',
                        options: {
                            filename: escapedSrtPath,
                            force_style: style
                        },
                        inputs: lastOutput,
                        outputs: 'with_subs'
                    });
                    lastOutput = 'with_subs';
                }

                if (watermarkConfig && watermarkConfig.text) {
                    const { text, opacity, position } = watermarkConfig;

                    let x = '(W-tw)/2';
                    let y = '(H-th)/2';

                    if (position === 'top_left') {
                        x = 'W*0.05'; y = 'H*0.05';
                    } else if (position === 'top_right') {
                        x = 'W*0.95-tw'; y = 'H*0.05';
                    } else if (position === 'bottom_left') {
                        x = 'W*0.05'; y = 'H*0.95-th';
                    } else if (position === 'bottom_right') {
                        x = 'W*0.95-tw'; y = 'H*0.95-th';
                    }

                    const drawtextOptions: any = {
                        text: text.replace(/:/g, '\\:'), // escape colons for FFmpeg
                        fontcolor: `white@${opacity}`,
                        fontsize: position === 'tilted_center' ? 84 : 64, // slightly larger for tilted
                        x,
                        y,
                        shadowcolor: `black@${opacity * 0.6}`,
                        shadowx: 2,
                        shadowy: 2
                    };

                    // Note: text rotation via angle requires a build of FFmpeg with FreeType support and specific layout logic, 
                    // However, we can approximate tilted text by providing no tilt if angle fails or rely on frontend preview if backend cannot tilt easily. We will attempt tilt.
                    if (position === 'tilted_center') {
                        // In some ffmpeg versions drawtext doesn't support 'angle' parameter directly unless specifically compiled, but it generally supports expansion.
                        drawtextOptions.x = '(W-tw)/2';
                        // if tilt isn't natively supported by standard Ubuntu ffmpeg drawtext filter, we will just keep it larger and centered. We'll leave out angle to prevent filter graph crashes, as most basic ffmpegs require rotation filters before drawtext for true tilts.
                    }

                    filters.push({
                        filter: 'drawtext',
                        options: drawtextOptions,
                        inputs: lastOutput,
                        outputs: 'final'
                    });
                    lastOutput = 'final';
                }

                command
                    .complexFilter(filters, lastOutput)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions('-map 0:a?') // Map the audio from the first input if it exists
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
