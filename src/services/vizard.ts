import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VIZARD_API_KEY = process.env.VIZARD_API_KEY;

export const sendToVizard = async (videoUrl: string, videoId: string, videoType: number = 2, ext: string = 'mp4'): Promise<string | null> => {
    if (!VIZARD_API_KEY) {
        console.error('VIZARD_API_KEY is not set');
        return null;
    }

    try {
        const payload = {
            videoUrl: videoUrl,
            videoType: videoType, 
            lang: 'auto', // Auto detection
            preferLength: [2], // 30-60s
            ratioOfClip: 1, // Vertical 9:16
            ext: ext, 
            subtitleSwitch: 0, // Disable subtitles
            headlineSwitch: 0, // Disable headlines
            projectName: `Youtube_${videoId}`
        };

        console.log(`Sending payload to Vizard:`, JSON.stringify(payload, null, 2));

        const response = await axios.post(
            'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create',
            payload,
            {
                headers: {
                    'VIZARDAI_API_KEY': VIZARD_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`Vizard API Response:`, JSON.stringify(response.data, null, 2));

        // Let's check the response structure carefully
        const data = response.data;
        if (data.code === 0 || data.code === 2000 || data.success || data.id || data.project_id || data.data?.project_id) {
            return data.projectId || data.id || data.project_id || data.data?.project_id || data.data?.id || "unknown_id";
        } else {
            console.error(`Vizard returned error code ${data.code}: ${data.errMsg || data.message}`);
            return null;
        }
    } catch (error: any) {
        console.error('Error sending video to Vizard:', error.response?.data || error.message);
        return null;
    }
};

export const getVizardProjectStatus = async (projectId: string): Promise<any> => {
    if (!VIZARD_API_KEY) return null;
    try {
        const response = await axios.get(
            `https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/${projectId}`,
            {
                headers: {
                    'VIZARDAI_API_KEY': VIZARD_API_KEY,
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(`Error polling Vizard project ${projectId}:`, error.response?.data || error.message);
        return null;
    }
};
