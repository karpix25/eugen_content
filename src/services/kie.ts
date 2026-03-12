import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const KIE_API_KEY = process.env.KIE_API_KEY;

export const generateGridImage = async (prompt: string, aspectRatio: string = "2:3"): Promise<string> => {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY is not set");

  try {
    // 1. Create Generation Task
    const createResponse = await axios.post(
      "https://api.kie.ai/api/v1/jobs/createTask",
      {
        model: "nano-banana-pro",
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatio,
          resolution: "1K", // Default resolution as per docs
          output_format: "png"
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (createResponse.data.code !== 200) {
      throw new Error(`Failed to create kie.ai task: ${createResponse.data.msg}`);
    }

    const taskId = createResponse.data.data.taskId;
    console.log(`Kie.ai task created: ${taskId}`);

    // 2. Poll for Status
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10s intervals
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
      
      const statusResponse = await axios.get(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
        {
          headers: {
            "Authorization": `Bearer ${KIE_API_KEY}`
          }
        }
      );

      const statusData = statusResponse.data;
      if (statusData.code !== 200) {
        throw new Error(`Failed to query kie.ai task status: ${statusData.msg}`);
      }

      const state = statusData.data.state;
      console.log(`Kie.ai task ${taskId} state: ${state}`);

      if (state === 'success') {
        const resultJson = JSON.parse(statusData.data.resultJson);
        const resultUrl = resultJson.resultUrls?.[0];
        if (!resultUrl) throw new Error("Kie.ai success but no result URL found");
        return resultUrl;
      }

      if (state === 'fail') {
        throw new Error(`Kie.ai task failed: ${statusData.data.failMsg || 'Unknown error'}`);
      }

      attempts++;
    }

    throw new Error("Kie.ai generation timed out");
  } catch (error: any) {
    console.error("Kie.ai Error:", error.response?.data || error.message);
    throw new Error(`Kie.ai generation failed: ${error.message}`);
  }
};
