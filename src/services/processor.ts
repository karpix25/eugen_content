import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { query } from '../lib/db.js';
import { uploadToS3 } from '../lib/s3.js';

export const processClip = async (clipId: string, videoUrl: string, plaqueImageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(process.cwd(), 'temp', 'processed');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFileName = `${clipId}_branded.mp4`;
        const outputPath = path.join(outputDir, outputFileName);

        console.log(`Processing clip ${clipId} from ${videoUrl}`);

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
                console.log(`Processing finished locally: ${outputPath}`);

                try {
                    // Upload the file to S3
                    const fileBuffer = fs.readFileSync(outputPath);
                    const uploadResult = await uploadToS3(fileBuffer, `processed/${outputFileName}`, 'video/mp4');
                    
                    // Construct final URL (handling both path-style and virtual-hosted style if needed, 
                    // though uploadResult.Location usually contains the full URL)
                    const finalUrl = uploadResult.Location || "";

                    console.log(`Uploaded to S3: ${finalUrl}`);

                    await query(
                        'UPDATE clips SET status = \'processed\', url = $1 WHERE id = $2',
                        [finalUrl, clipId]
                    );

                    // Clean up local file
                    fs.unlinkSync(outputPath);

                    resolve(finalUrl);
                } catch (uploadError) {
                    console.error('Error uploading processed clip to S3:', uploadError);
                    reject(uploadError);
                }
            })
            .on('error', (err) => {
                console.error('Error processing video:', err);
                reject(err);
            })
            .save(outputPath);
    });
};
