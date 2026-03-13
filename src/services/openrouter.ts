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

export const generateCarouselScript = async (transcript: string, topic: string, styleId?: string, lang: string = 'ru', targetAudience?: string): Promise<CarouselSlide[]> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const ta = targetAudience || "Entrepreneurs interested in AI and automation";
  let styleInstruction = "Corporate professional, minimalist, and authoritative. Avoid fluff.";
  if (styleId === 'ios-notes') {
    styleInstruction = "Aesthetic: Digital Sticky Note / iOS Notes app. Text should look like handwritten-but-clean notes or quick thoughts. Use bullet points (-) for the body. Use professional emojis sparingly (💡, ✅, 📌). Layout should feel spacious and informal but clear.";
  } else if (styleId === 'dark-luxury') {
    styleInstruction = "High-end, sophisticated, extremely minimalist. Punchy headers and high-value insights. Very professional.";
  } else if (styleId === 'cyber-brutalist') {
    styleInstruction = "Direct, edgy, tech-focused. Use technical jargon where appropriate. Bold and uncompromising.";
  }

  const prompt = `
    You are a Strategic Chief Content Officer for high-net-worth audiences. 
    Your mission is to create a hyper-cohesive 6-slide Instagram carousel script.
    
    Target Audience: "${ta}"
    Topic: "${topic}"
    Transcript Content: "${transcript}"
    Language: ${lang === 'ru' ? 'Russian' : 'English'}
    
    PHASE 1: CONTENT MINING (Internal Monologue)
    - Identify the single most provocative, counter-intuitive, or valuable "Diamond Insight" in the transcript for the ${ta}.
    
    PHASE 2: STRATEGIC TRIGGER SELECTION
    Select the most effective psychological trigger for Slide 1 based on the insight:
    - [The Industry Lie]: Challenging a status quo belief common in ${ta}'s field.
    - [The Expensive Mistake]: A common practice that is actually killing ROI.
    - [The Secret Framework]: A unique methodology or "Hidden Efficiency".
    - [The Impossible Result]: High achievement through a specific technical pivot.
    
    PHASE 3: NARRATIVE MAPPING (The Strategic Pivot)
    Plan the bridge between each slide:
    1. THE DISRUPTION: Use the selected trigger. Make it large and bold.
    2. THE STATUS QUO TRAP: Why the old way is dangerous.
    3. THE STRATEGIC PIVOT: The "Diamond Insight". The moment of clarity.
    4. THE MECHANICS: 2-3 technical/business steps to implement.
    5. THE COMPETITIVE ADVANTAGE: Specific ROI or systemic impact.
    6. THE VISIONARY CTA: A closing authoritative statement + professional nudge.
    
    PHASE 4: HUMANIZER SWEEP (Strictest Constraints)
    Mandatory Rules (Mental check before final script):
    - NO INLINE-HEADERS: Do NOT use the "Word: Explanation" or "Topic: Description" structure (Pattern 15). No colons inside list items.
    - BURSTINESS: Varied sentence lengths (Short. Semi-long. Short). No metronomic rhythm.
    - NO AI VOCABULARY: Block "delve, tapestry, landscape, showcase, embark, robust, meticulous, nestled, breathtaking".
    - NO COPULA AVOIDANCE: Use "is" and "has", not "boasts", "serves as", or "features".
    - REDUCE EMOJIS: Max 1 emoji per every 2 slides. Use only professional ones.
    
    CRITICAL RULES:
    - EXPERT TONE: Use sophisticated vocabulary for ${ta}. No fluff.
    - FORMAT: Use short, punchy paragraphs or simple bullet points (-).
    - NO CHEAP NAVIGATION: Never write "Next slide", "Swipe", or use ➡️ symbols.
    - LANGUAGE: Everything (except for JSON keys) must be in ${lang === 'ru' ? 'Russian' : 'English'}.
    - WORD LIMITS: Title: Max 6 words. Body: Max 25 words (aim for high density).
    
    OUTPUT FORMAT:
    Return ONLY a JSON object with "thinking" and "slides".
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
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.slides || [];
};

export const generateImagePrompt = async (script: CarouselSlide[], styleAnalysis: any): Promise<string> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `
    Create a professional Instagram carousel as a single, unified, continuous vertical artwork.
    The goal is to create a high-end 2x3 grid (2 columns wide, 3 rows tall) of 6 slides.
    
    CONTENT TO RENDER (STRICT HIERARCHY):
    ${script.map((s, i) => `Slide ${i + 1}: TITLE: "${s.title}" | BODY: "${s.body}"`).join('\n')}
    
    STYLE SPECIFICATIONS & DESIGN RULES:
    ${JSON.stringify(styleAnalysis, null, 2)}
    
    TYPOGRAPHY & LAYOUT GUIDELINES:
    1. MINIMALISM: Use ample white space. Do NOT crowd the slides.
    2. VISUAL HIERARCHY: Titles must be significantly LARGER and BOLDER than the body text.
    3. ALIGNMENT: Strict grid alignment. Place exactly one title+body pair on each of the 6 slides.
    4. NO BORDERS: Absolutely no grid lines, borders, or dividers between slides.
    5. SEAMLESS FLOW: The background design must flow fluidly and continuously across the entire 2x3 canvas.
    6. TEXT PLACEMENT: Ensure text is vertically and horizontally centered within each slide's zone. Do NOT split text between slides.
    
    Return ONLY the Midjourney-style prompt string in English.
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

export const analyzeStyle = async (imageBase64: string): Promise<any> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `Analyze this design reference image in extreme detail. 
    Extract the following design variables and return them in a structured JSON format:
    - fonts: { primary: string, secondary: string, styles: string[], typographyRules: string }
    - colors: { primary: string[], secondary: string[], background: string }
    - layout: { gridType: string, elementPositions: string, alignment: string, layering: string }
    - elements: { textures: string[], decorativeElements: string[], collageStyle: string, specificContentDetails: string }
    - styleDescription: string (detailed stylistic summary)
    
    Be very specific with font names and hex color codes. Pay close attention to how text is emphasized (bolding, sizing, different fonts for specific words).`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
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
    console.error("OpenRouter Style Analysis Error:", error);
    return null;
  }
};
