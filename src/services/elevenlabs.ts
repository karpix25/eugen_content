import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export interface DubbingStatus {
    status: 'dubbing' | 'dubbed' | 'failed';
    error?: string;
}

export const startDubbing = async (
    targetLanguage: string, 
    sourceLanguage?: string,
    file?: { buffer: Buffer, name: string },
    sourceUrl?: string,
    name?: string
): Promise<string | null> => {
    if (!ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set');
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('target_lang', targetLanguage);
        
        if (sourceLanguage) {
            formData.append('source_lang', sourceLanguage);
        }

        if (file) {
            formData.append('file', file.buffer, file.name);
        } else if (sourceUrl) {
            formData.append('source_url', sourceUrl);
        } else {
            throw new Error('Either file or sourceUrl must be provided');
        }

        if (name) {
            formData.append('name', name);
        }

        formData.append('num_speakers', '1');

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
            `https://api.elevenlabs.io/v1/dubbing/${dubbingId}/audio/${language}`,
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
