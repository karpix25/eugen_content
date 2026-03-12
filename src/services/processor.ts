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
    return new Promise(async (resolve, reject) => {
        try {
            const outputDir = path.join(process.cwd(), 'temp', 'processed');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            console.error(`!!! [Processor] processClip started for ${clipId} !!!`);
            console.log(`Processing clip ${clipId} from ${videoUrl} (Target: ${targetLang || 'Original'})`);

            let currentVideoUrl = videoUrl;
            let tempDubbedFile = path.join(outputDir, `${clipId}_dubbed.mp4`);
            let tempOriginalFile = path.join(outputDir, `${clipId}_original.mp4`);
            let tempPlaqueFile = path.join(outputDir, `${clipId}_plaque.png`);

            // Robustness: if plaqueImageUrl is actually a stringified JSON (legacy bug), parse it
            let finalPlaqueUrl = plaqueImageUrl;
            if (plaqueImageUrl && plaqueImageUrl.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(plaqueImageUrl);
                    if (parsed.Location) {
                        finalPlaqueUrl = parsed.Location;
                        console.log(`Parsed legacy JSON plaque URL for ${clipId}: ${finalPlaqueUrl}`);
                    }
                } catch (e) {
                    console.error(`Failed to parse plaqueImageUrl as JSON for ${clipId}:`, e);
                }
            }

            if (finalPlaqueUrl) {
                try {
                    await downloadFile(finalPlaqueUrl, tempPlaqueFile);
                } catch (e) {
                    console.error(`Failed to download plaque for ${clipId}:`, e);
                    finalPlaqueUrl = null; // Disable if download fails
                }
            }


            console.log(`[Processor] Debug Dubbing: target='${targetLang}' (type: ${typeof targetLang}), source='${sourceLang}' (type: ${typeof sourceLang}), different: ${targetLang !== sourceLang}`);
            if (targetLang && sourceLang && targetLang !== sourceLang) {
                console.log(`[Processor] Starting ElevenLabs dubbing ${sourceLang} -> ${targetLang} for ${clipId}`);
                try {
                    // Always download source video first to ensure ElevenLabs gets the file (more robust)
                    if (!fs.existsSync(tempOriginalFile)) {
                        console.log(`[Processor] Downloading original video for dubbing: ${videoUrl}`);
                        await downloadFile(videoUrl, tempOriginalFile);
                    }
                    const videoBuffer = fs.readFileSync(tempOriginalFile);

                    const dubbingId = await startDubbing(
                        targetLang, 
                        sourceLang, 
                        { buffer: videoBuffer, name: `${clipId}.mp4` },
                        undefined, // No sourceUrl
                        clipId
                    );

                    if (dubbingId) {
                        console.log(`[Processor] ElevenLabs dubbing triggered: ${dubbingId}. Polling status...`);
                        if (await pollDubbingStatus(dubbingId)) {
                            const dubbedBuffer = await getDubbedFile(dubbingId, targetLang);
                            if (dubbedBuffer) {
                                fs.writeFileSync(tempDubbedFile, dubbedBuffer);
                                currentVideoUrl = tempDubbedFile;
                                console.log(`[Processor] Successfully dubbed ${clipId}. New video URL: ${currentVideoUrl}`);
                            } else {
                                console.error(`[Processor] Failed to download dubbed file for ${clipId}`);
                            }
                        } else {
                            console.error(`[Processor] Dubbing status polling failed for ${clipId}`);
                        }
                    } else {
                        console.warn(`[Processor] Dubbing skipped: failed to start (check ElevenLabs logs/Plan).`);
                    }
                } catch (err: any) {
                    console.error(`[Processor] Exception during dubbing process for ${clipId}:`, err.message);
                }
            } else {
                console.log(`[Processor] Dubbing NOT needed for ${clipId}: target=${targetLang}, source=${sourceLang}`);
            }

            const outputFileName = `${clipId}_branded.mp4`;
            const outputPath = path.join(outputDir, outputFileName);

            // Convert #RRGGBB to &HBBGGRR (ASS color format) for consistency
            const toAss = (hex: string) => {
                const clean = hex.replace('#', '');
                if (clean.length === 6) {
                    const r = clean.substring(0, 2);
                    const g = clean.substring(2, 4);
                    const b = clean.substring(4, 6);
                    return `&H00${b}${g}${r}&`;
                }
                return '&H00FFFFFF&';
            };
            const assColor = toAss(subtitleConfig?.font_color || '#FFFFFF');
            const highlightColor = toAss(subtitleConfig?.highlight_color || '#FFFF00');
            const outlineColor = toAss(subtitleConfig?.outline_color || '#000000');
            const highlightEnabled = subtitleConfig?.highlight_enabled !== false;
            const fontFamily = subtitleConfig?.font_family || 'Anton';
            const fontSize = subtitleConfig?.font_size || 48;

            const finalLang = targetLang || sourceLang || 'auto';
            let srtFilePath: string | null = null;
            let watermarkAssPath: string | null = null;
            if (subtitleConfig && subtitleConfig.enabled) {
                const srtRes = await query("SELECT srt_url FROM clips WHERE id = $1", [clipId]);
                let srtUrl = srtRes.rows[0]?.srt_url;

                // Ensure that the cached ASS file matches the current user configuration perfectly
                const styleName = subtitleConfig?.style || 'karaoke';
                const positionVal = subtitleConfig?.position || '80';
                const requiredHash = `v2_${styleName}_${assColor}_${highlightColor}_${outlineColor}_${highlightEnabled}_${fontFamily}_${fontSize}_${positionVal}`.replace(/[^a-zA-Z0-9_]/g, '');

                if (!srtUrl || !srtUrl.includes(requiredHash)) {
                    console.log(`Generating new subtitles due to missing cache or mismatched style hash (${requiredHash})`);
                    srtUrl = await generateAndCacheSRT(clipId, currentVideoUrl, {
                        language: finalLang,
                        style: styleName,
                        fontColor: assColor,
                        highlightColor: highlightColor,
                        outlineColor: outlineColor,
                        highlightEnabled: highlightEnabled,
                        fontFamily: fontFamily,
                        fontSize: fontSize,
                        position: positionVal
                    } as any);
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
                [outputPath, tempDubbedFile, tempOriginalFile, tempPlaqueFile].forEach(f => {
                    if (fs.existsSync(f)) fs.unlinkSync(f);
                });
                if (srtFilePath && fs.existsSync(srtFilePath)) fs.unlinkSync(srtFilePath);
                if (watermarkAssPath && fs.existsSync(watermarkAssPath)) fs.unlinkSync(watermarkAssPath);
            };

            const finalizeUpload = async (fileToUpload: string) => {
                let fileBuffer: Buffer;
                let downloadedTempFile: string | null = null;
                
                try {
                    if (fileToUpload.startsWith('http')) {
                        console.log(`Downloading raw video from URL before S3 upload: ${fileToUpload}`);
                        downloadedTempFile = path.join(outputDir, `${clipId}_raw_download.mp4`);
                        await downloadFile(fileToUpload, downloadedTempFile);
                        fileBuffer = fs.readFileSync(downloadedTempFile);
                    } else {
                        fileBuffer = fs.readFileSync(fileToUpload);
                    }
                    
                    if (skipS3Upload) {
                        const finalLocalPath = (downloadedTempFile && fs.existsSync(downloadedTempFile)) ? downloadedTempFile : fileToUpload;
                        await query('UPDATE clips SET status = \'processed\' WHERE id = $1', [clipId]);
                        console.log(`[Processor] S3 upload skipped. Resolved with local path: ${finalLocalPath}`);
                        resolve(finalLocalPath);
                        return;
                    }

                    const uploadResult = await uploadToS3(fileBuffer, `processed/${outputFileName}`, 'video/mp4');
                    const finalUrl = uploadResult.Location || "";
                    await query('UPDATE clips SET status = \'processed\', url = $1 WHERE id = $2', [finalUrl, clipId]);
                    resolve(finalUrl);
                } catch (e) {
                    console.error(`Failed during finalizeUpload for ${clipId}:`, e);
                    reject(e);
                } finally {
                    if (skipS3Upload) {
                        // DO NOT delete the file if we are resolving with its path!
                        console.log(`[Processor] Keeping local file for further steps: ${fileToUpload}`);
                    } else {
                        cleanupFiles();
                        if (downloadedTempFile && fs.existsSync(downloadedTempFile)) {
                            fs.unlinkSync(downloadedTempFile);
                        }
                    }
                }
            };

            if (finalPlaqueUrl || watermarkConfig || srtFilePath) {
                console.log(`Starting FFmpeg overlay for ${clipId} (Plaque: ${!!finalPlaqueUrl}, Watermark: ${watermarkConfig?.text || 'None'}, Subs: ${!!srtFilePath})`);

                let command = ffmpeg(currentVideoUrl);
                const filters: any[] = [];
                let lastOutput = '[0:v]';

                if (finalPlaqueUrl) {
                    const escapedPlaquePath = tempPlaqueFile.replace(/\\/g, '/');
                    command = command.input(escapedPlaquePath).inputOptions('-loop 1');

                    // 1. Get Video Metadata for precise scaling
                    const metadata = await new Promise<any>((res, rej) => {
                        ffmpeg.ffprobe(currentVideoUrl, (err, meta) => {
                            if (err) rej(err);
                            else res(meta);
                        });
                    }).catch(e => {
                        console.error('Failed to probe video dimensions', e);
                        return null;
                    });

                    const duration = metadata?.format?.duration || 0;

                    // 2. Configure Plaque
                    const pSize = plaqueConfig?.size || 40;
                    const pPosition = plaqueConfig?.position || 'top';
                    const pTimerange = plaqueConfig?.timerange || 0;

                    // 3. Process Plaque using scale2ref (proportional to background)
                    // We need to setsar=1 on plaque first to avoid distortion
                    filters.push({
                        filter: 'setsar',
                        options: '1',
                        inputs: '[1:v]',
                        outputs: '[plaque_in]'
                    });

                    // Advanced SAR Compensation:
                    // 1. Target Visual Width = main_w * percent
                    // 2. Storage Width (w) = Target Visual Width / main_sar
                    // 3. Target Visual Height = Target Visual Width / (iw/ih)
                    // 4. Storage Height (h) = Target Visual Height
                    filters.push({
                        filter: 'scale2ref',
                        options: `w=main_w*${pSize / 100}/main_sar:h=main_w*${pSize / 100}*ih/iw`,
                        inputs: ['[plaque_in]', lastOutput],
                        outputs: ['[plaque]', '[bg_ref]']
                    });
                    
                    lastOutput = '[bg_ref]';

                    // Position logic remains the same
                    let overlayY = 'H-h-50';
                    if (pPosition === 'top') {
                        overlayY = '30';
                    } else if (pPosition === 'center') {
                        overlayY = '(H-h)/2';
                    }
                    let enableFilter = '';
                    if (pTimerange > 0) {
                        try {
                            if (duration > 0) {
                                const maxStartTime = duration * (pTimerange / 100);
                                const startTime = Math.random() * maxStartTime;
                                enableFilter = `:enable='gte(t,${startTime})'`;
                                console.log(`Plaque will appear at ${startTime.toFixed(2)}s (max ${maxStartTime.toFixed(2)}s, total duration ${duration}s)`);
                            }
                        } catch (e) {
                            console.error('Failed to parse video duration for plaque timerange', e);
                        }
                    }

                    filters.push({
                        filter: 'overlay',
                        options: `(W-w)/2:${overlayY}${enableFilter}:shortest=1`,
                        inputs: [lastOutput, '[plaque]'],
                        outputs: '[with_plaque]'
                    });
                    lastOutput = '[with_plaque]';
                }

                if (srtFilePath) {
                    let posValue = 80;
                    const positionStr = subtitleConfig?.position;
                    if (positionStr === 'Bottom') posValue = 80;
                    else if (positionStr === 'Center') posValue = 50;
                    else if (positionStr === 'Top') posValue = 15;
                    else if (positionStr && !isNaN(Number(positionStr))) {
                        posValue = Number(positionStr);
                    }

                    // Clamp to prevent scrolling text completely off-screen
                    posValue = Math.max(2, Math.min(95, posValue));
                    const marginV = Math.floor((posValue / 100) * 1280);
                    const alignment = 8; // 8 = Top Center, so MarginV calculates from the Top edge downwards.

                    const fontSize = subtitleConfig?.font_size || 16;
                    // Use relative path to avoid issues with Cyrillic characters in absolute paths (e.g., /Users/.../Женя)
                    const relativeSrtPath = path.relative(process.cwd(), srtFilePath);
                    const escapedSrtPath = relativeSrtPath.replace(/\\/g, '/');

                    const isAss = srtFilePath.endsWith('.ass');
                    const styleName = subtitleConfig?.style || 'ali';

                    let style = '';
                    if (styleName === 'beast') {
                        // BEAST STYLE: Colored active/outline, black glow/bold background
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=6,Shadow=3,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName.includes('hormozi')) {
                        // HORMOZI STYLE: No background box, very thick shadow, Yellow/White colors text
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=4,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'celine') {
                        // CELINE STYLE: Standard subtitles, no box, outline
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=1,Bold=0,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'iman') {
                        // IMAN STYLE: Minimalist. No thick lines. White font (color ignored for base text). Light shadow. Minimalist bold transition handled by inline tags.
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=1,Shadow=2,Bold=0,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'devin') {
                        // DEVIN STYLE: Bouncy. Heavy rotating text inline. Massive stroke here. 
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=8,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'mrb') {
                        // MRB STYLE: Thick double black stroke, no shadow, heavily yellow active words.
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=10,Shadow=0,Bold=-1,Alignment=${alignment},MarginV=${marginV + 10}`;
                    } else if (styleName === 'karaoke') {
                        // KARAOKE STYLE: Smooth text. Medium borders. Like Celine but colors sweeping active word.
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'jordan') {
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00000000&,BorderStyle=1,Outline=3,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'luke') {
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H00FFFF00&,BorderStyle=1,Outline=2,Shadow=4,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'maya') {
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BackColour=&H0000A5FF&,BorderStyle=1,Outline=2,Shadow=5,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (styleName === 'sage') {
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H00FFFFFF&,BackColour=&H00FFFFFF&,BorderStyle=1,Outline=2,Shadow=3,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else if (isAss) {
                        // ALI STYLE: Box background (BorderStyle=3), Light Gray Box, No shadow
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H00F0F0F0&,BackColour=&H00F0F0F0&,BorderStyle=3,Outline=10,Shadow=0,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    } else {
                        // LEGACY STYLE
                        style = `FontName=${fontFamily},FontSize=${fontSize},PrimaryColour=${assColor},OutlineColour=&H80000000&,BorderStyle=1,Outline=3,Shadow=2,Bold=-1,Alignment=${alignment},MarginV=${marginV}`;
                    }

                    filters.push({
                        filter: 'subtitles',
                        options: `filename='${escapedSrtPath}':fontsdir='${process.env.NODE_ENV === 'production' ? '/app/fonts' : './fonts'}'`,
                        inputs: lastOutput,
                        outputs: '[with_subs]'
                    });
                    lastOutput = '[with_subs]';
                }

                if (watermarkConfig && watermarkConfig.text) {
                    const { text, opacity, position } = watermarkConfig;

                    watermarkAssPath = path.join(outputDir, `watermark_${clipId}.ass`);
                    const alphaValue = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase();

                    let alignment = 5;
                    let marginV = 0;
                    let marginL = 0;
                    let marginR = 0;
                    let rotate = 0;
                    let fontSize = 64;

                    if (position === 'top_left') {
                        alignment = 7; marginV = 40; marginL = 40;
                    } else if (position === 'top_right') {
                        alignment = 9; marginV = 40; marginR = 40;
                    } else if (position === 'bottom_left') {
                        alignment = 1; marginV = 40; marginL = 40;
                    } else if (position === 'bottom_right') {
                        alignment = 3; marginV = 40; marginR = 40;
                    } else if (position === 'tilted_center') {
                        alignment = 5; rotate = -30; fontSize = 84;
                    }

                    const watermarkAssContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H${alphaValue}FFFFFF,&H000000FF,&H${alphaValue}000000,&H${alphaValue}000000,-1,0,0,0,100,100,0,0,1,2,2,${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,99:59:59.99,Default,,0,0,0,,{\\frz${rotate}}${text}
`;
                    fs.writeFileSync(watermarkAssPath, watermarkAssContent);

                    const safeAssPath = watermarkAssPath.replace(/'/g, "'\\''");
                    const fontsPath = path.join(process.cwd(), 'fonts').replace(/'/g, "'\\''");

                    filters.push({
                        filter: 'subtitles',
                        options: `filename='${safeAssPath}':fontsdir='${fontsPath}'`,
                        inputs: lastOutput,
                        outputs: '[final]'
                    });
                    lastOutput = '[final]';
                }

                console.log(`FFmpeg starting for ${clipId} with filters:`, JSON.stringify(filters, null, 2));

                console.log(`[Processor] Final call to FFmpeg with currentVideoUrl: ${currentVideoUrl}`);
                command
                    .complexFilter(filters, lastOutput)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-map', '0:a?', // Map the audio from the first input if it exists
                        '-crf', '18',
                        '-preset', 'fast'
                    ])
                    .on('start', (cmd) => console.log('FFmpeg spawned with command:', cmd))
                    .on('progress', (progress) => console.log(`Processing ${clipId}: ${progress.percent}%`))
                    .on('end', () => {
                        console.log('FFmpeg process finished successfully.');
                        finalizeUpload(outputPath);
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error('FFmpeg error:', err.message);
                        console.error('FFmpeg stderr:', stderr);
                        cleanupFiles();
                        reject(err);
                    })
                    .save(outputPath);
            } else {
                console.log(`[Processor] No overlays needed. Finalizing with currentVideoUrl: ${currentVideoUrl}`);
                finalizeUpload(currentVideoUrl);
            }
        } catch (err) {
            console.error('Core process error:', err);
            reject(err);
        }
    });
};
