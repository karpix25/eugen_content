import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);
const YT_DLP_PATH = '/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp';

export const downloadYouTubeVideo = async (url: string): Promise<{ filePath: string, fileName: string } | null> => {
    try {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const fileName = `${uuidv4()}.mp4`;
        const filePath = path.join(tempDir, fileName);

        console.log(`[yt-dlp] Downloading video: ${url} to ${filePath}`);
        
        // --f mp4 to ensure we get a single mp4 file if possible
        const command = `"${YT_DLP_PATH}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${filePath}" "${url}"`;
        
        await execAsync(command);

        if (fs.existsSync(filePath)) {
            console.log(`[yt-dlp] Download complete: ${filePath}`);
            return { filePath, fileName };
        } else {
            console.error(`[yt-dlp] File not found after download: ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`[yt-dlp] Error downloading video:`, error);
        return null;
    }
};
