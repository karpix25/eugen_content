import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { query } from '../lib/db.js';

export const processClip = async (clipId: string, videoUrl: string, plaqueImageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(process.cwd(), 'temp', 'processed');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFileName = `processed_${clipId}.mp4`;
        const outputPath = path.join(outputDir, outputFileName);

        console.log(`Processing clip ${clipId} from ${videoUrl}`);

        // This is a simplified example of FFmpeg overlay
        // Adjust filters for actual positioning and subtitle styling
        ffmpeg(videoUrl)
            .input(plaqueImageUrl)
            .complexFilter([
                // Resize plaque and overlay at the bottom
                '[1:v]scale=720:-1[plaque]',
                '[0:v][plaque]overlay=0:H-h-50[v]'
            ])
            .map('[v]')
            .videoCodec('libx264')
            .on('end', async () => {
                console.log(`Processing finished: ${outputPath}`);

                // In a real app, you would upload this to S3 and get a public URL
                // For now, we'll return the local path or simulate a URL
                const simulatedUrl = `https://your-storage.com/${outputFileName}`;

                await query(
                    'UPDATE clips SET status = \'processed\', url = $1 WHERE id = $2',
                    [simulatedUrl, clipId]
                );

                resolve(simulatedUrl);
            })
            .on('error', (err) => {
                console.error('Error processing video:', err);
                reject(err);
            })
            .save(outputPath);
    });
};
