import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "google/gemini-2.0-flash-001";

export interface CarouselSlide {
  title: string;
  body: string;
}

export const evaluateContent = async (title: string, transcript: string, targetAudience: string = "Предприниматели, интересующиеся ИИ и автоматизацией"): Promise<any> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `
    Оцени этот контент для YouTube Shorts/Reels. 
    Название: ${title}
    Транскрипт: ${transcript}
    Целевая аудитория: ${targetAudience}

    Ответь ТОЛЬКО в формате JSON:
    {
      "score": число от 1 до 100,
      "evaluation": "краткий разбор почему такая оценка",
      "detected_language": "ru" или "en"
    }
  `;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error("OpenRouter Evaluation Error:", error);
    return null;
  }
};

export const translateText = async (text: string, targetLang: string): Promise<string | null> => {
  if (!OPENROUTER_API_KEY) return null;
  const prompt = `Translate the following text to ${targetLang}. Return ONLY the translation: ${text}`;
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenRouter Translation Error:", error);
    return null;
  }
};

export const detectLanguage = async (text: string): Promise<string | null> => {
  if (!OPENROUTER_API_KEY) return null;
  const prompt = `Detect the language of the following text. Return ONLY the ISO code (e.g. "ru", "en"): ${text.substring(0, 500)}`;
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error("OpenRouter Detection Error:", error);
    return null;
  }
};

export const generateCarouselScript = async (transcript: string, topic: string): Promise<CarouselSlide[]> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `
    You are a world-class social media copywriter specializing in high-retention Instagram carousels.
    Base your writing on this topic: "${topic}" and this transcript: "${transcript}".
    
    RULES:
    1. STYLE: Corporate professional, minimalist, and authoritative. Avoid fluff.
    2. WORD LIMITS (STRICT): 
       - Title: Max 6 words (Punchy, bold).
       - Body: Max 15 words (Clear, high-value insight).
    3. NARRATIVE ARC:
       - Slide 1 (The Hook): High-level value proposition.
       - Slide 2 (The Context): The "Why" in business terms.
       - Slide 3 (The Insight): Data-driven or logical core point.
       - Slide 4 (The Strategy): Actionable corporate advice.
       - Slide 5 (The Transformation): Business impact/ROI.
       - Slide 6 (The CTA): Professional next step.
    
    OUTPUT FORMAT:
    Return ONLY a JSON array of 6 objects.
    Example: [{"title": "Headline", "body": "Supporting text"}, ... ]
  `;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    },
    {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;
  // Handle various potential JSON wrappers if needed, 
  // though Claude 3.5 Sonnet is usually precise with JSON mode.
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.slides || [];
};

export const generateImagePrompt = async (script: CarouselSlide[], styleAnalysis: any): Promise<string> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `
    Create a detailed midjourney-style visual prompt for an image generation AI.
    The goal is to create a professional 2x3 grid Instagram carousel (single unified canvas).
    
    CONTENT HIERARCHY:
    ${script.map((s, i) => `Slide ${i + 1}: ${s.title} | ${s.body}`).join('\n')}
    
    STYLE SPECIFICATIONS (FOLLOW CLOSELY):
    ${JSON.stringify(styleAnalysis, null, 2)}
    
    INSTRUCTIONS:
    1. Describe a clean, corporate, high-end minimalist design.
    2. Mention specific fonts and colors from the analysis.
    3. Specify "single unified vertical continuous artwork, 2x3 grid, totaling 6 slides".
    4. Emphasize "ample white space, professional layout, no borders between slides".
    5. The prompt should be in English.
    
    Return ONLY the prompt string.
  `;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
};
