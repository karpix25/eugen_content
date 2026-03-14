import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export const sliceCarouselGrid = async (imageBufferOrUrl: Buffer | string, outDir: string, logoUrl?: string | null): Promise<string[]> => {
  let buffer: Buffer;

  if (typeof imageBufferOrUrl === 'string') {
    let imageUrl = imageBufferOrUrl;
    if (!imageUrl.startsWith('http')) {
      console.warn(`[Slicer] URL missing protocol: ${imageUrl}. Prepending https://`);
      imageUrl = `https://${imageUrl}`;
    }
    console.log(`[Slicer] Fetching image from URL: ${imageUrl}`);
    try {
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 // 30s timeout
      });
      buffer = Buffer.from(response.data);
      console.log(`[Slicer] Image fetched successfully, size: ${buffer.length} bytes`);
    } catch (err: any) {
      console.error(`[Slicer] Failed to fetch image: ${err.message}`);
      throw new Error(`Slicer image fetch failed: ${err.message}`);
    }
  } else {
    buffer = imageBufferOrUrl;
    console.log(`[Slicer] Using provided buffer, size: ${buffer.length} bytes`);
  }

  const metadata = await sharp(buffer).metadata();
  console.log(`[Slicer] Metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
  if (!metadata.width || !metadata.height) throw new Error("Invalid image metadata");

  const slideWidth = Math.floor(metadata.width / 2);
  const slideHeight = Math.floor(metadata.height / 3);
  console.log(`[Slicer] Slide dims: ${slideWidth}x${slideHeight}`);

  // Fetch logo if provided
  let logoBuffer: Buffer | null = null;
  if (logoUrl) {
    try {
        console.log(`[Slicer] Fetching logo from: ${logoUrl}`);
        const logoRes = await axios.get(logoUrl, { responseType: 'arraybuffer' });
        logoBuffer = Buffer.from(logoRes.data);
        // Resize logo to be ~15% of slide width
        logoBuffer = await sharp(logoBuffer)
            .resize({ width: Math.floor(slideWidth * 0.15) })
            .toBuffer();
    } catch (e) {
        console.warn(`[Slicer] Failed to fetch or process logo:`, e);
    }
  }

  const slideUrls: string[] = [];
  const sessionId = uuidv4();

  // Ensure output directory exists
  console.log(`[Slicer] Ensuring outDir: ${outDir}`);
  await fs.mkdir(outDir, { recursive: true });

  // Grid is 2x3 (2 columns, 3 rows)
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 2; x++) {
      const index = y * 2 + x;
      const fileName = `slide_${sessionId}_${index}.png`;
      const filePath = path.join(outDir, fileName);

      console.log(`[Slicer] Extracting slide ${index} to ${filePath}...`);
      const slide = sharp(buffer)
        .extract({
          left: x * slideWidth,
          top: y * slideHeight,
          width: slideWidth,
          height: slideHeight
        });

      if (logoBuffer) {
        await slide
            .composite([{ 
                input: logoBuffer, 
                top: Math.floor(slideHeight * 0.05), 
                left: Math.floor(slideWidth * 0.05) 
            }])
            .toFile(filePath);
      } else {
        await slide.toFile(filePath);
      }

      slideUrls.push(`/uploads/carousels/${fileName}`);
    }
  }

  console.log(`[Slicer] Successfully sliced into ${slideUrls.length} slides`);
  return slideUrls;
};
