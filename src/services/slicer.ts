import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export const sliceCarouselGrid = async (imageBufferOrUrl: Buffer | string, outDir: string): Promise<string[]> => {
  let buffer: Buffer;

  if (typeof imageBufferOrUrl === 'string') {
    const response = await fetch(imageBufferOrUrl);
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    buffer = imageBufferOrUrl;
  }

  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Invalid image metadata");

  const slideWidth = Math.floor(metadata.width / 2);
  const slideHeight = Math.floor(metadata.height / 3);

  const slideUrls: string[] = [];
  const sessionId = uuidv4();

  // Ensure output directory exists
  await fs.mkdir(outDir, { recursive: true });

  // Grid is 2x3 (2 columns, 3 rows)
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 2; x++) {
      const index = y * 2 + x;
      const fileName = `slide_${sessionId}_${index}.png`;
      const filePath = path.join(outDir, fileName);

      await sharp(buffer)
        .extract({
          left: x * slideWidth,
          top: y * slideHeight,
          width: slideWidth,
          height: slideHeight
        })
        .toFile(filePath);

      // In a real app, you'd upload these to S3. 
      // For now, let's return the local paths or URLs if served.
      slideUrls.push(`/uploads/carousels/${fileName}`);
    }
  }

  return slideUrls;
};
