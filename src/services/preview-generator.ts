import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export class PreviewGenerator {
    private static FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');
    
    // Heuristic rules for choosing hook words
    private static TRANSITION_WORDS = ['это', 'как', 'для', 'в', 'на', 'с', 'и', 'или', 'но'];

    /**
     * Generates a "Font Hook" preview image (PNG)
     * 1080x1920 (Vertical for TikTok/Reels/Shorts feel in Telegram)
     */
    static async generateFontHook(title: string): Promise<Buffer> {
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
