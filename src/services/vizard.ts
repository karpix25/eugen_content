import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VIZARD_API_KEY = process.env.VIZARD_API_KEY;

export const sendToVizard = async (
    videoUrl: string, 
    videoId: string, 
    options: {
        videoType?: number;
        ext?: string;
        preferLength?: number[];
        removeSilenceSwitch?: number;
        autoBrollSwitch?: number;
    } = {}
): Promise<string | null> => {
    const { 
        videoType = 2, 
        ext = 'mp4',
        preferLength = [2],
        removeSilenceSwitch = 0,
        autoBrollSwitch = 0
    } = options;

    if (!VIZARD_API_KEY) {
        console.error('VIZARD_API_KEY is not set');
        return null;
    }

    try {
        const payload = {
            videoUrl: videoUrl,
            videoType: videoType, 
            lang: 'auto', // Auto detection
            preferLength: preferLength,
            removeSilenceSwitch: removeSilenceSwitch,
            autoBrollSwitch: autoBrollSwitch,
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
                validateStatus: (status) => true // Handle all status codes
            }
        );

        console.log(`Vizard API Response:`, JSON.stringify(response.data, null, 2));

        const data = response.data;
        // Check for success codes or presence of project ID
        const vizardId = data.projectId || data.id || data.project_id || data.data?.project_id || data.data?.id;
        
        if (data.code === 0 || data.code === 2000 || data.success || vizardId) {
            return vizardId || "unknown_id";
        } else if (data.code === 4005 || (data.errMsg && data.errMsg.includes("exists"))) {
            // Project might already exist, try to return ID if present or log it
            console.warn(`Vizard project might already exist: ${data.errMsg}`);
            return vizardId || null;
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
