import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export interface DubbingStatus {
    status: 'dubbing' | 'dubbed' | 'failed';
    error?: string;
}

export const startDubbing = async (fileBuffer: Buffer, fileName: string, targetLanguage: string, sourceLanguage?: string): Promise<string | null> => {
    if (!ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set');
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('file', fileBuffer, fileName);
        formData.append('target_lang', targetLanguage);

        if (sourceLanguage) {
            formData.append('source_lang', sourceLanguage);
        }

        formData.append('num_speakers', '1');
        // 'watermark' false requires Creator+ plan min. Standard/Free will crash. So we just skip setting it or explicitly allow watermarks
        // formData.append('watermark', ''); 

        const response = await axios.post(
            'https://api.elevenlabs.io/v1/dubbing',
            formData,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    ...formData.getHeaders(),
                },
            }
        );

        return response.data.dubbing_id;
    } catch (error: any) {
        console.error('Error starting ElevenLabs dubbing:', error?.response?.data || error.message);
        return null;
    }
};

export const checkDubbingStatus = async (dubbingId: string): Promise<DubbingStatus> => {
    if (!ELEVENLABS_API_KEY) return { status: 'failed', error: 'No API key' };

    try {
        const response = await axios.get(
            `https://api.elevenlabs.io/v1/dubbing/${dubbingId}`,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
            }
        );

        return { status: response.data.status };
    } catch (error: any) {
        console.error('Error checking ElevenLabs dubbing status:', error?.response?.data || error.message);
        return { status: 'failed', error: error.message };
    }
};

export const getDubbedFile = async (dubbingId: string, language: string): Promise<Buffer | null> => {
    if (!ELEVENLABS_API_KEY) return null;

    try {
        console.log(`[ElevenLabs] Downloading dubbed video for ${dubbingId} in ${language}...`);
        const response = await axios.get(
            `https://api.elevenlabs.io/v1/dubbing/${dubbingId}/video/${language}`,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
                responseType: 'arraybuffer'
            }
        );

        console.log(`[ElevenLabs] Download headers for ${dubbingId}:`, {
            contentType: response.headers['content-type'],
            contentLength: response.headers['content-length']
        });

        return Buffer.from(response.data);
    } catch (error: any) {
        console.error('Error downloading dubbed file:', error?.response?.data || error.message);
        return null;
    }
};
