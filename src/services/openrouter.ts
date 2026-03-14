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
    
    PHASE 1: DOMAIN DETECTION (Internal Monologue)
    - Detect the primary domain of the transcript: [Psychology/Relationships], [Technology/AI], or [Business/Strategy].
    - Map the content strategy to this domain. DO NOT force-apply ROI, Market Share, or Tech analogies to [Psychology/Relationships] content.
    
    PHASE 2: CONTENT MINING
    - Identify the single most provocative, counter-intuitive, or valuable "Diamond Insight" in the transcript for the ${ta}.
    
    PHASE 3: STRATEGIC TRIGGER SELECTION
    Select the most effective psychological trigger for Slide 1 BASED ON THE DOMAIN:
    - [Psychology/Relationships]: The Hidden Behavioral Pattern or The Emotional Blindspot.
    - [Technology/AI]: The Hidden Advantage or The Legacy Debt.
    - [Business/Strategy]: The Industry Lie or The Scalability Trap.
    
    PHASE 4: NARRATIVE MAPPING (The Human Connection)
    Plan the bridge between each slide, adapting to the domain:
    1. THE DISRUPTION: Use the trigger. Deeply relative to the transcript.
    2. THE CONSEQUENCE: Why this matters (Emotional, Personal, or Practical impact). Avoid "Price of Inaction" on sensitive topics.
    3. THE INSIGHT: The core "Diamond Insight". The turning point.
    4. THE PATH FORWARD: 2-3 specific, actionable steps or shifts.
    5. THE EVOLUTION: The positive transformation or long-term growth.
    6. THE CONCLUSION: A sophisticated final thought or invitation.
    
    PHASE 5: CLEAN DESIGN ENFORCEMENT
    Mandatory Rules:
    - NO DISTORTION: Avoid complex 3D objects, realistic hands, or busy backgrounds.
    - FLAT DESIGN: If the style is Graphic/Illustration, strictly forbid realistic shadows, gradients, or 3D renders.
    - SEAMLESS CONNECTORS: Priority #1 is the "Visual Path" (ribbons/lines) flowing between segments.
    - WHITE SPACE: Ensure text never touches or overlaps with decorative elements.
    
    STRICT SUBJECT FIDELITY:
    - NO BUSINESS LINGO: If topic is Psychology, never use "ROI", "Conversion", "Efficiency", or "Market". Use "Trust", "Growth", "Connection", "Clarity".
    - Tone: Sophisticated but deeply human.
    
    CRITICAL RULES:
    - EXPERT TONE: Use sophisticated vocabulary for ${ta}. No fluff.
    - FORMAT: Use short, punchy paragraphs or simple bullet points (-).
    - NO CHEAP NAVIGATION: Never write "Next slide", "Swipe", or use ➡️ symbols.
    - LANGUAGE: Everything (except for JSON keys) must be in ${lang === 'ru' ? 'Russian' : 'English'}.
    - WORD LIMITS: Title: Max 6 words. Body: Max 25 words.
    
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
    
    STYLE DESCRIPTION & DESIGN RULES:
    - ${styleAnalysis?.styleDescription || "Minimalist Professional Design"}
    - ART STYLE: ${styleAnalysis?.elements?.artStyle || "Flat Graphic"}.
    - COLORS: ${styleAnalysis?.colors?.primary?.join(", ") || "Corporate Blues"}.
    - LAYOUT RULES: ${styleAnalysis?.layout?.compositionRules || "Clean grid placement"}.
    
    CONTENT INSTRUCTIONS:
    If the style uses illustrations or background imagery, you MUST adapt the subject matter to the TITLE and BODY of each slide. 
    - MANDATORY: Keep the artwork strictly FLAT. No 3D, no realistic hands, no glossy textures unless explicitly requested.
    - VISUAL FLOW: Render the "${styleAnalysis?.layout?.visualConnectors || "wavy lines"}" so they physically bridge the slides across the 2x3 grid.
    - SEAMLESSNESS: The background must be one continuous, high-resolution piece. NO borders between slides.

    TYPOGRAPHY GUIDELINES:
    1. HIERARCHY: Titles must be Bold and significantly larger than the body text.
    2. PLACEMENT: Place exactly one title+body pair within each of the 6 slide zones of the 2x3 grid.
    3. ALIGNMENT: Strict vertical and horizontal centering within each slide's zone.
    
    Return ONLY the Midjourney-style prompt string in English.
    
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
    - layout: { gridType: string, elementPositions: string, alignment: string, layering: string, visualConnectors: string }
    - elements: { textures: string[], decorativeElements: string[], artStyle: "Flat Graphic" | "Minimalist Illustration" | "Realistic Photo", specificContentDetails: string }
    - thematicLogic: string (How does the background flow across the 2x3 grid? Does it use "ribbons", "waves", or "geometric paths" to connect the slides?)
    - reuseInstructions: string (Instructions for another AI on how to recreate this exact style. E.g., "Flat 2D vector style with blue wavy ribbons on a cream background")
    - styleDescription: string (detailed stylistic summary)
    
    Be specific about hex codes and font families. 
    CRITICAL: Identify the "Visual Connector" (e.g. "blue wavy ribbon") that flows across multiple slides. This is the most important element for consistency.
    ENFORCE FLATNESS: If the reference is graphic, explicitly state "No 3D, No Shadows, No Gloss".
`;

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
                  url: imageBase64.startsWith('http') ? imageBase64 : (imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`)
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

export const generatePlaquePrompt = async (topic: string): Promise<string> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = `
    You are an elite Graphic Designer and Prompt Engineer for high-conversion advertising.
    Your mission is to create a visual prompt for an "Ad Plaque" (advertising banner) that will be overlaid on video content.
    
    Topic/Text: "${topic}"
    Format: Rectangular (3:2 aspect ratio).
    
    DESIGN RULES:
    1. EXCLUSIVITY: The design must look expensive, premium, and sophisticated.
    2. LEGIBILITY: Any text specified in the topic must be CLEAR and VIBRANT. Use high-contrast typography.
    3. ART STYLE: Modern Digital Graphic / 3D Rendered Glassmorphism. 
    4. BACKGROUND: USE A SOLID, EDGE-TO-EDGE RECTANGULAR BACKGROUND. NO TRANSPARENCY, NO HOLES, NO IRREGULAR EDGES. The background must fill the entire 3:2 canvas completely.
    5. BRANDING: Include subtle premium accents like gold foil, neon glow, or frosted glass effects.
    6. NO PHOTOREALISM: Avoid realistic human faces or busy photographic backgrounds. Keep it clean and iconic.
    
    The output must be a single, detailed Midjourney-style prompt in English for an AI image generator (Nano Banana).
    Focus on lighting, materials, and "premium feel". Explicitly mention "solid rectangular shape, no transparent parts".
    
    Return ONLY the prompt string.
  `;

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
    console.error("OpenRouter Plaque Prompt Error:", error);
    throw new Error("Failed to generate plaque prompt");
  }
};
