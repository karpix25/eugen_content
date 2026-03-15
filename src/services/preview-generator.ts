import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';

export class PreviewGenerator {
    private static FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');
    
    // Heuristic rules for choosing hook words
    private static TRANSITION_WORDS = ['это', 'как', 'для', 'в', 'на', 'с', 'и', 'или', 'но'];

    /**
     * Extracts a frame from the video and overlays the title.
     * Returns a Buffer (JPEG) optimized for Telegram thumbnails.
     */
    static async generateVideoThumbnail(videoUrl: string, title: string): Promise<Buffer> {
        const tempId = uuidv4();
        const tempFramePath = path.join('/tmp', `frame_${tempId}.jpg`);

        console.log(`[PreviewGenerator] Requesting thumbnail for: ${videoUrl}`);

        return new Promise((resolve, reject) => {
            ffmpeg(videoUrl)
                .screenshots({
                    timestamps: [0.1], 
                    filename: `frame_${tempId}.jpg`,
                    folder: '/tmp',
                    size: '1080x1920'
                })
                .on('end', async () => {
                    try {
                        if (!fs.existsSync(tempFramePath)) {
                            throw new Error(`FFmpeg finished but frame not found at ${tempFramePath}`);
                        }

                        console.log(`[PreviewGenerator] Frame extracted successfully.`);
                        const frameBuffer = fs.readFileSync(tempFramePath);
                        fs.unlinkSync(tempFramePath);

                        // Escape XML special characters in title
                        const escapedTitle = title
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&apos;');

                        // Overlay logic: 360x640 for Telegram (max 320x320 suggested but vertical 640 usually works)
                        const overlaySvg = `
                            <svg width="360" height="640" viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <style>
                                        .rect { fill: rgba(0, 0, 0, 0.7); }
                                        .text { 
                                            fill: #FFFFFF; 
                                            font-family: sans-serif; 
                                            font-size: 24px; 
                                            font-weight: bold; 
                                        }
                                    </style>
                                </defs>
                                <rect x="20" y="270" width="320" height="100" rx="10" class="rect" />
                                <text x="180" y="315" text-anchor="middle" class="text">
                                    ${this.wrapText(escapedTitle, 20).map((line, k) => `<tspan x="180" dy="${k === 0 ? 0 : 30}">${line}</tspan>`).join('')}
                                </text>
                            </svg>
                        `;

                        const finalBuffer = await sharp(frameBuffer)
                            .resize(360, 640, { fit: 'cover' })
                            .composite([{
                                input: Buffer.from(overlaySvg),
                                top: 0,
                                left: 0
                            }])
                            .jpeg({ quality: 85 })
                            .toBuffer();

                        console.log(`[PreviewGenerator] Thumbnail generated, size: ${finalBuffer.length} bytes`);
                        resolve(finalBuffer);
                    } catch (err) {
                        console.error('[PreviewGenerator] Processing Error:', err);
                        reject(err);
                    }
                })
                .on('error', (err) => {
                    console.error('[PreviewGenerator] FFMPEG Error:', err);
                    reject(err);
                });
        });
    }

    private static wrapText(text: string, maxCharsPerLine: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length > maxCharsPerLine) {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });
        lines.push(currentLine.trim());
        return lines.slice(0, 3); // Max 3 lines
    }

    /**
     * Generates a "Font Hook" preview image (PNG)
     * 1080x1920 (Vertical for TikTok/Reels/Shorts feel in Telegram)
     */
    static async generateFontHook(title: string): Promise<Buffer> {
        // ... (existing generateFontHook code)
        const words = title.split(/\s+/);
        
        // Split into two parts
        // Line 1: usually longer
        // Line 2: usually shorter, contains the hook
        let line1: string[] = [];
        let line2: string[] = [];

        if (words.length <= 3) {
            line1 = [words[0]];
            line2 = words.slice(1);
        } else {
            const splitIndex = Math.ceil(words.length * 0.6);
            line1 = words.slice(0, splitIndex);
            line2 = words.slice(splitIndex);
        }

        // Apply style to the last word(s) of line 2
        const hookText = line2[line2.length - 1] || '';
        const normalTextLine2 = line2.slice(0, -1).join(' ');

        // SVG Template
        // We use a safe font stack and system fonts if ours aren't detected
        // Note: For production use with custom fonts, they must be registered in Fontconfig
        const svg = `
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    @font-face {
                        font-family: 'Instrument';
                        src: url('file://${path.join(this.FONTS_DIR, 'InstrumentSerif-Italic.ttf')}');
                    }
                    .bg { fill: #000000; }
                    .text-line1 { 
                        fill: #FFFFFF; 
                        font-family: 'Helvetica', 'Arial', sans-serif; 
                        font-size: 80px; 
                        font-weight: 900; 
                        text-transform: uppercase;
                        letter-spacing: -2px;
                    }
                    .text-line2-normal { 
                        fill: #FFFFFF; 
                        font-family: 'Helvetica', 'Arial', sans-serif; 
                        font-size: 80px; 
                        font-weight: 900; 
                        text-transform: uppercase;
                        letter-spacing: -2px;
                    }
                    .text-line2-hook { 
                        fill: #FFFFFF; 
                        font-family: 'Instrument', 'PT Serif', 'Times New Roman', serif; 
                        font-size: 110px; 
                        font-style: italic;
                    }
                </style>
            </defs>
            
            <rect width="100%" height="100%" class="bg" />
            
            <g transform="translate(100, 850)">
                <text x="0" y="0" class="text-line1">${line1.join(' ')}</text>
                <text x="0" y="110" class="text-line2-normal">
                    ${normalTextLine2}
                    <tspan class="text-line2-hook" dx="20">${hookText}</tspan>
                </text>
            </g>
        </svg>
        `;

        try {
            return await sharp(Buffer.from(svg))
                .png()
                .toBuffer();
        } catch (err) {
            console.error('Failed to generate font hook SVG:', err);
            // Fallback: simple black image with text using sharp's built-in text rendering
            return await sharp({
                create: {
                    width: 1080,
                    height: 1920,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 1 }
                }
            })
            .composite([{
                input: {
                    text: {
                        text: `${line1.join(' ')}\n${line2.join(' ')}`,
                        font: 'sans-serif',
                        width: 900,
                        align: 'center',
                        rgba: true
                    }
                }
            }])
            .png()
            .toBuffer();
        }
    }
}
