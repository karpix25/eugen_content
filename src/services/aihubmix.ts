import axios from 'axios';
import dotenv from 'dotenv';
import { uploadToS3 } from '../lib/s3.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const AIHUBMIX_API_KEY = process.env.AIHUBMIX_API_KEY;

/**
 * Generates an image using AIHubMix (Gemini 3.1 Flash Image)
 */
export const generateImage = async (prompt: string, aspectRatio: string = "1:1", referImageUrl?: string): Promise<string> => {
  if (!AIHUBMIX_API_KEY) {
    throw new Error("AIHUBMIX_API_KEY is not set");
  }

  try {
    console.log(`Generating image via AIHubMix fallback for prompt: ${prompt.substring(0, 50)}...`);

    // Clean aspect ratio (e.g. "2:3" -> "2:3", "3/2" -> "3:2")
    const cleanedAspectRatio = aspectRatio.replace('/', ':');

    const contents: any[] = [
      {
        role: "user",
        parts: [
          {
            text: `Instruction: Generate an image based on the prompt below. ${referImageUrl ? "Use the provided image as a visual reference for character appearance and style." : ""} 
            
Prompt: ${prompt}`
          }
        ]
      }
    ];

    if (referImageUrl) {
      // Add reference image as a part
      contents[0].parts.unshift({
        fileData: {
          fileUri: referImageUrl,
          mimeType: "image/png" // Default to png, though url could be anything
        }
      });
    }

    const response = await axios.post(
      'https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image-preview:generateContent',
      {
        contents: contents,
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: cleanedAspectRatio,
            imageSize: "2k"
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': AIHUBMIX_API_KEY
        }
      }
    );

    // AIHubMix/Gemini response structure for image generation
    // Usually it's in candidates[0].content.parts[...].inlineData
    const candidate = response.data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    
    if (!parts || !Array.isArray(parts)) {
      throw new Error("Invalid response structure from AIHubMix");
    }

    const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
    
    if (!imagePart || !imagePart.inlineData?.data) {
      throw new Error("No image data found in AIHubMix response");
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileName = `aihubmix-${uuidv4()}.${mimeType.split('/')[1] || 'png'}`;
    
    console.log(`Uploading AIHubMix generated image to S3: ${fileName}...`);
    const uploadResult = await uploadToS3(buffer, fileName, mimeType);
    
    // Extract public URL
    let imageUrl = (uploadResult as any).Location;
    if (!imageUrl) {
      const endpoint = process.env.S3_ENDPOINT || '';
      const bucket = process.env.S3_BUCKET_NAME || '';
      const key = fileName;
      imageUrl = endpoint 
        ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}` 
        : `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    return imageUrl;
  } catch (error: any) {
    console.error("AIHubMix Error:", error.response?.data || error.message);
    throw new Error(`AIHubMix generation failed: ${error.message}`);
  }
};
