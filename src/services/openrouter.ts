import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export interface EvaluationResult {
    score: number;
    evaluation: string;
}

export const evaluateContent = async (
    title: string,
    transcript: string,
    targetAudience: string
): Promise<EvaluationResult | null> => {
    if (!OPENROUTER_API_KEY) {
        console.error('OPENROUTER_API_KEY is not set');
        return null;
    }

    try {
        const prompt = `
      Analyze the following YouTube video content for relevance to this target audience: "${targetAudience}".
      
      Video Title: ${title}
      Transcript: ${transcript.substring(0, 10000)}... (truncated if too long)
      
      Provide:
      1. A score from 0 to 100 representing how well it fits the target audience.
      2. A brief explanation of why it fits or doesn't fit (in Russian).
      3. Potential viral hooks for short clips (in Russian).
      
      Return the response in JSON format:
      {
        "score": number,
        "evaluation": "string"
      }
    `;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'openai/gpt-4o-mini', // Or any other suitable model
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/karlo-carousel', // Optional, for OpenRouter analytics
                    'Content-Type': 'application/json',
                },
            }
        );

        const content = response.data.choices[0].message.content;
        return JSON.parse(content) as EvaluationResult;
    } catch (error) {
        console.error('Error with OpenRouter evaluation:', error);
        return null;
    }
};
