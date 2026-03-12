import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { query } from '../lib/db.js';
import { uploadToS3 } from '../lib/s3.js';
import { startDubbing, checkDubbingStatus, getDubbedFile } from './elevenlabs.js';
import { generateAndCacheSRT } from './deepgram.js';

// --- Utility Functions ---

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

const toAssColor = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
        const r = clean.substring(0, 2);
        const g = clean.substring(2, 4);
        const b = clean.substring(4, 6);
        return `&H00${b}${g}${r}&`;
    }
    return '&H00FFFFFF&';
};

const getSubtitleStyle = (config: any, assColor: string, highlightColor: string, outlineColor: string, alignment: number, marginV: number) => {
    const { font_family: fontFamily = 'Anton', font_size: fontSize = 48, style: styleName = 'karaoke' } = config;

    if (styleName === 'beast') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=6,Shadow=3,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName.includes('hormozi')) {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=4,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'celine') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=1,Bold=0,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'iman') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=1,Shadow=2,Bold=0,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'devin') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=8,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'mrb') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=10,Shadow=0,Bold=-1,Alignment=${alignment},MarginV=${marginV + 10}`;
    } else if (styleName === 'karaoke') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'jordan') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=3,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'luke') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H0000FFFF&,BorderStyle=1,Outline=2,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'maya') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H0000A5FF&,BorderStyle=1,Outline=2,Shadow=5,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    } else if (styleName === 'sage') {
        return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00FFFFFF&,BackColour=&H00FFFFFF&,BorderStyle=1,Outline=2,Shadow=3,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
    }

    // Default Style (Clean Outline, No Box)
    return `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=${outlineColor},BackColour=&H00000000&,BorderStyle=1,Outline=3,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV},MarginL=10,MarginR=10`;
};

// --- Main Processor ---

export const processClip = async (
    clipId: string,
    videoUrl: string,
    plaqueImageUrl: string | null,
    targetLang?: string | null,
    sourceLang?: string | null,
    skipS3Upload: boolean = false,
    watermarkConfig?: { text: string, opacity: number, position: string },
    plaqueConfig?: { position: string, size: number, timerange?: number },
    subtitleConfig?: {
        enabled: boolean,
        font_size: number,
        font_color: string,
        position: string,
        style?: string,
        font_family?: string,
        highlight_color?: string,
        highlight_enabled?: boolean,
        outline_color?: string
    }
): Promise<string> => {
    const outputDir = path.join(process.cwd(), 'temp', 'processed');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const tempOriginalFile = path.join(outputDir, `${clipId}_original.mp4`);
    const tempDubbedFile = path.join(outputDir, `${clipId}_dubbed.mp4`);
    const tempPlaqueFile = path.join(outputDir, `${clipId}_plaque.png`);
    const outputFileName = `${clipId}_branded.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    let currentVideoUrl = videoUrl;
    let srtFilePath: string | null = null;
    let watermarkAssPath: string | null = null;

    const cleanupFiles = () => {
        [tempOriginalFile, tempDubbedFile, tempPlaqueFile, outputPath].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        if (srtFilePath && fs.existsSync(srtFilePath)) fs.unlinkSync(srtFilePath);
        if (watermarkAssPath && fs.existsSync(watermarkAssPath)) fs.unlinkSync(watermarkAssPath);
    };

    try {
        console.error(`!!! [Processor] processClip started for ${clipId} !!!`);

        // 1. Asset Preparation
        let finalPlaqueUrl = plaqueImageUrl;
        if (plaqueImageUrl?.trim().startsWith('{')) {
            try {
                finalPlaqueUrl = JSON.parse(plaqueImageUrl).Location;
            } catch (e) {
                console.error(`Legacy Plaque JSON error for ${clipId}`);
            }
        }

        if (finalPlaqueUrl) {
            await downloadFile(finalPlaqueUrl, tempPlaqueFile).catch(() => {
                console.error(`Plaque download failed for ${clipId}`);
                finalPlaqueUrl = null;
            });
        }

        // 2. Dubbing Flow
        if (targetLang && sourceLang && targetLang !== sourceLang) {
            try {
                if (!fs.existsSync(tempOriginalFile)) await downloadFile(videoUrl, tempOriginalFile);
                const dubbingId = await startDubbing(targetLang, sourceLang, { buffer: fs.readFileSync(tempOriginalFile), name: `${clipId}.mp4` }, undefined, clipId);
                if (dubbingId && await pollDubbingStatus(dubbingId)) {
                    const dubbedBuffer = await getDubbedFile(dubbingId, targetLang);
                    if (dubbedBuffer) {
                        fs.writeFileSync(tempDubbedFile, dubbedBuffer);
                        currentVideoUrl = tempDubbedFile;
                    }
                }
            } catch (err) {
                console.error(`Dubbing error for ${clipId}:`, err);
            }
        }

        // 3. Subtitles Preparation
        if (subtitleConfig?.enabled) {
            const fontColor = toAssColor(subtitleConfig.font_color || '#FFFFFF');
            const highlightColor = toAssColor(subtitleConfig.highlight_color || '#FFFF00');
            const outlineColor = toAssColor(subtitleConfig.outline_color || '#000000');
            const styleName = subtitleConfig.style || 'karaoke';
            const fontFamily = subtitleConfig.font_family || 'Anton';
            const fontSize = subtitleConfig.font_size || 48;
            const positionVal = subtitleConfig.position || '80';

            const hash = `v2_${styleName}_${fontColor}_${highlightColor}_${outlineColor}_${subtitleConfig.highlight_enabled !== false}_${fontFamily}_${fontSize}_${positionVal}`.replace(/[^a-zA-Z0-9_]/g, '');

            const srtRes = await query("SELECT srt_url FROM clips WHERE id = $1", [clipId]);
            let srtUrl = srtRes.rows[0]?.srt_url;

            if (!srtUrl || !srtUrl.includes(hash)) {
                srtUrl = await generateAndCacheSRT(clipId, currentVideoUrl, {
                    language: targetLang || sourceLang || 'auto',
                    style: styleName, fontColor, highlightColor, outlineColor,
                    highlightEnabled: subtitleConfig.highlight_enabled !== false,
                    fontFamily, fontSize, position: positionVal
                } as any);
                if (srtUrl) await query("UPDATE clips SET srt_url = $1 WHERE id = $2", [srtUrl, clipId]);
            }

            if (srtUrl) {
                srtFilePath = path.join(outputDir, `${clipId}${srtUrl.endsWith('.ass') ? '.ass' : '.srt'}`);
                await downloadFile(srtUrl, srtFilePath);
            }
        }

        // 4. FFmpeg Processing
        if (finalPlaqueUrl || watermarkConfig || srtFilePath) {
            const filters: any[] = [];
            let lastOutput = '[0:v]';
            const command = ffmpeg(currentVideoUrl);

            // 4a. Probe video to get real dimensions (handling rotation)
            const metadata = await new Promise<any>((res) => ffmpeg.ffprobe(currentVideoUrl, (err, meta) => res(meta)));
            const videoStream = metadata?.streams.find((s: any) => s.codec_type === 'video');
            const rotation = videoStream?.side_data_list?.find((sd: any) => sd.side_data_type === 'Display Matrix')?.rotation || 0;
            
            let originalW = parseInt(videoStream?.width || '1080');
            let originalH = parseInt(videoStream?.height || '1920');
            
            // If rotated 90 or 270, width and height are swapped for display
            const isRotated = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
            const effectiveW = isRotated ? originalH : originalW;
            const effectiveH = isRotated ? originalW : originalH;

            console.log(`[Processor] Video dimensions: ${originalW}x${originalH}, rotation: ${rotation}, effective: ${effectiveW}x${effectiveH}`);

            // 4b. Normalize ONLY if needed
            if (effectiveW !== 1080 || effectiveH !== 1920) {
                console.log(`[Processor] Normalizing video to 1080x1920...`);
                filters.push({ 
                    filter: 'scale', 
                    options: 'w=1080:h=1920:force_original_aspect_ratio=decrease:force_divisible_by=2', 
                    inputs: '[0:v]', 
                    outputs: '[scaled_v]' 
                });
                filters.push({ 
                    filter: 'pad', 
                    options: '1080:1920:(1080-iw)/2:(1920-ih)/2:color=black', 
                    inputs: '[scaled_v]', 
                    outputs: '[normalized_v]' 
                });
                lastOutput = '[normalized_v]';
            }

            // Ensure consistent pixel format and square pixels (SAR 1:1)
            // This is critical for Telegram to display the correct aspect ratio.
            filters.push({
                filter: 'setsar',
                options: '1',
                inputs: [lastOutput],
                outputs: '[sar_reset_v]'
            });
            filters.push({
                filter: 'format',
                options: 'yuv420p',
                inputs: ['[sar_reset_v]'],
                outputs: '[formatted_v]'
            });
            lastOutput = '[formatted_v]';

            // 4c. Plaque
            if (finalPlaqueUrl) {
                command.input(tempPlaqueFile.replace(/\\/g, '/')).inputOptions('-loop 1');
                
                // Scale plaque relative to the final video width (1080 after normalization or already 1080)
                const targetBaseW = 1080; 
                const plaqueWidth = Math.floor(targetBaseW * (plaqueConfig?.size || 40) / 100);
                
                filters.push({ 
                    filter: 'scale', 
                    options: `w=${plaqueWidth}:h=-1`, 
                    inputs: '[1:v]', 
                    outputs: '[plaque_scaled]' 
                });

                let y = plaqueConfig?.position === 'top' ? 'H*0.1' : plaqueConfig?.position === 'center' ? '(H-h)/2' : 'H-h-H*0.1';
                let enable = '';
                if (plaqueConfig?.timerange && metadata?.format?.duration) {
                    enable = `:enable='gte(t,${Math.random() * metadata.format.duration * (plaqueConfig.timerange / 100)})'`;
                }
                filters.push({
                    filter: 'overlay',
                    options: `x=(W-w)/2:y=${y}:shortest=1${enable}`,
                    inputs: [lastOutput, '[plaque_scaled]'],
                    outputs: '[with_plaque]'
                });
                lastOutput = '[with_plaque]';
            }

            // Subtitles
            if (srtFilePath) {
                let pos = Math.max(2, Math.min(95, Number(subtitleConfig?.position) || 80));
                if (subtitleConfig?.position === 'Bottom') pos = 80;
                else if (subtitleConfig?.position === 'Center') pos = 50;
                else if (subtitleConfig?.position === 'Top') pos = 15;

                const style = getSubtitleStyle(subtitleConfig, toAssColor(subtitleConfig?.font_color || '#FFF'), toAssColor(subtitleConfig?.highlight_color || '#FF0'), toAssColor(subtitleConfig?.outline_color || '#000'), 2, Math.floor((1 - pos / 100) * 1920));

                filters.push({
                    filter: 'subtitles',
                    options: `filename='${path.relative(process.cwd(), srtFilePath).replace(/\\/g, '/')}':fontsdir='${process.env.NODE_ENV === 'production' ? '/app/fonts' : './fonts'}':force_style='${style}'`,
                    inputs: lastOutput,
                    outputs: '[with_subs]'
                });
                lastOutput = '[with_subs]';
            }

            // Watermark
            if (watermarkConfig?.text) {
                const alpha = Math.round((1 - watermarkConfig.opacity) * 255).toString(16).padStart(2, '0').toUpperCase();
                let align = 5, rot = 0, fsz = 64, v = 0, l = 0, r = 0;
                if (watermarkConfig.position === 'top_left') { align = 7; v = 40; l = 40; }
                else if (watermarkConfig.position === 'top_right') { align = 9; v = 40; r = 40; }
                else if (watermarkConfig.position === 'bottom_left') { align = 1; v = 40; l = 40; }
                else if (watermarkConfig.position === 'bottom_right') { align = 3; v = 40; r = 40; }
                else if (watermarkConfig.position === 'tilted_center') { align = 5; rot = -30; fsz = 84; }

                watermarkAssPath = path.join(outputDir, `watermark_${clipId}.ass`);
                fs.writeFileSync(watermarkAssPath, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,${fsz},&H${alpha}FFFFFF,&H000000FF,&H${alpha}000000,&H${alpha}000000,-1,0,0,0,100,100,0,0,1,2,2,${align},${l},${r},${v},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,99:59:59.99,Default,,0,0,0,,{\\frz${rot}}${watermarkConfig.text}\n`);

                filters.push({ filter: 'subtitles', options: `filename='${watermarkAssPath.replace(/'/g, "'\\''").replace(/\\/g, '/')}':fontsdir='${path.join(process.cwd(), 'fonts')}'`, inputs: lastOutput, outputs: '[final]' });
                lastOutput = '[final]';
            }

            return new Promise((resolve, reject) => {
                command.complexFilter(filters, lastOutput)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-map', '0:a?', 
                        '-crf', '18', 
                        '-preset', 'fast', 
                        '-aspect', '9:16', 
                        '-movflags', '+faststart',
                        '-metadata:s:v', 'rotate=0'
                    ])
                    .on('start', cmd => console.log('FFmpeg command:', cmd))
                    .on('progress', p => console.log(`Processing ${clipId}: ${p.percent}%`))
                    .on('end', async () => {
                        console.log('FFmpeg finished.');
                        try {
                            if (!fs.existsSync(outputPath)) {
                                throw new Error(`Output file not found at: ${outputPath}`);
                            }
                            if (skipS3Upload) {
                                await query("UPDATE clips SET status = 'processed' WHERE id = $1", [clipId]);
                                resolve(outputPath);
                            } else {
                                const fileBuffer = fs.readFileSync(outputPath);
                                const res = await uploadToS3(fileBuffer, `processed/${outputFileName}`, 'video/mp4');
                                await query("UPDATE clips SET status = 'processed', url = $1 WHERE id = $2", [res.Location, clipId]);
                                cleanupFiles();
                                resolve(res.Location || "");
                            }
                        } catch (err) {
                            console.error('Post-processing error:', err);
                            cleanupFiles();
                            reject(err);
                        }
                    })
                    .on('error', (err) => { console.error('FFmpeg error:', err); cleanupFiles(); reject(err); })
                    .save(outputPath);
            });
        } else {
            console.log(`No overlays for ${clipId}.`);
            if (skipS3Upload) {
                await query("UPDATE clips SET status = 'processed' WHERE id = $1", [clipId]);
                return currentVideoUrl;
            }
            const res = await uploadToS3(fs.readFileSync(currentVideoUrl.startsWith('http') ? await (async () => {
                const p = path.join(outputDir, `${clipId}_raw.mp4`);
                await downloadFile(currentVideoUrl, p);
                return p;
            })() : currentVideoUrl), `processed/${outputFileName}`, 'video/mp4');
            await query("UPDATE clips SET status = 'processed', url = $1 WHERE id = $2", [res.Location, clipId]);
            cleanupFiles();
            return res.Location || "";
        }
    } catch (err) {
        console.error('Process error:', err);
        cleanupFiles();
        throw err;
    }
};

