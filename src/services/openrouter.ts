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
    
    PHASE 4: NARRATIVE MAPPING (The Strategic Pivot)
    Plan the bridge between each slide, adapting to the domain:
    1. THE DISRUPTION: Use the trigger. Deeply relative to the transcript.
    2. THE HIDDEN COST: Why ignoring this specific insight is dangerous (Social, Mental, or Financial cost).
    3. THE STRATEGIC PIVOT: The "Diamond Insight". The moment of clarity.
    4. THE MECHANICS: 2-3 specific steps to implement (Mental shifts for psychology, technical steps for tech, tactical for business).
    5. THE SYSTEMIC IMPACT: Long-term benefit (Fulfillment, Efficiency, or Profit).
    6. THE VISIONARY CTA: Closing authoritative statement + professional nudge.
    
    PHASE 5: HUMANIZER SWEEP (Strictest Constraints)
    Mandatory Rules (Mental check before final script):
    - NO INLINE-HEADERS: Do NOT use "Word: Explanation". No colons inside list items.
    - BURSTINESS: Varied sentence lengths (Short. Semi-long. Short).
    - NO AI VOCABULARY: Block "delve, tapestry, landscape, showcase, embark, robust, meticulous, nestled, breathtaking".
    - REDUCE EMOJIS: Max 1 emoji per every 2 slides. Professional only.
    
    STRICT SUBJECT FIDELITY:
    - If the topic is "Relationships" (психология/отношения), speak about the psychology of people, NOT the ROI of a company.
    - If the topic is "AI", focus on the architecture and application, NOT just business profit.
    - Keep the "Strategic Officer" high-quality TONE, but respect the transcript SUBJECT.
    
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
    
    STYLE SPECIFICATIONS & DESIGN RULES:
    ${JSON.stringify(styleAnalysis, null, 2)}
    
    THEMATIC ADAPTATION & ART STYLE:
    - MANDATORY ART STYLE: ${styleAnalysis?.elements?.artStyle || "Graphic Design"}. 
    - VISUAL CONNECTORS: ${styleAnalysis?.layout?.visualConnectors || "None"}.
    - COMPOSITION: ${styleAnalysis?.layout?.compositionRules || "Centered hierarchy"}.
    - EFFECTS: ${JSON.stringify(styleAnalysis?.effects || {})}.
    - TYPOGRAPHY: ${JSON.stringify(styleAnalysis?.fonts?.nuances || {})}.
    
    If the style uses collages, illustrations, or background imagery, you MUST adapt the subject matter of that imagery to the specific TITLE and BODY of each slide. 
    - The background must still feel like one continuous artwork. 
    - CRITICAL: Render the Visual Connectors (ribbons, lines, or geometric paths) with the exact color and thickness described in the STYLE RULES. They must physically bridge the slides.
    - FIDELITY: Maintain the ${styleAnalysis?.elements?.artStyle} aesthetic throughout. If grain or textures are mentioned, apply them consistently across the entire 2x3 grid.

    TYPOGRAPHY & LAYOUT GUIDELINES:
    1. VISUAL HIERARCHY: Titles must use the requested casing (${styleAnalysis?.fonts?.nuances?.casing}) and be significantly larger.
    2. ALIGNMENT: Strict grid alignment within the 2x3 frame. 
    3. SEAMLESS FLOW: The artwork must be one single, continuous image. NO borders or gaps between the 6 segments.
    
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
    - fonts: { primary: string, secondary: string, styles: string[], typographyRules: string, nuances: { kerning: string, lineHeight: string, casing: "uppercase" | "lowercase" | "mixed" } }
    - colors: { primary: string[], secondary: string[], background: string, paletteLogic: "Monochromatic" | "Complementary" | "Analogous" | "High Contrast" }
    - layout: { gridType: string, elementPositions: string, alignment: string, layering: string, visualConnectors: string, compositionRules: string }
    - effects: { shadows: string, glows: string, blurs: string, opacityLogic: string }
    - elements: { textures: string[], decorativeElements: string[], artStyle: "Flat Illustration" | "3D Render" | "Realistic Photo" | "Minimalist Graphic" | "Sketch" | "Retro/Vintage", specificContentDetails: string }
    - thematicLogic: string (Visual metaphor used. Does it use background collages? Does it use "ribbons", "waves", or "geometric paths" to connect slides? How are images masked/clipped?)
    - reuseInstructions: string (Instructions for another AI on how to recreate this exact style. E.g., "Minimalist 2D vector art with grainy paper texture, 12px drop shadows, all-caps bold headers in Montserrat Font")
    - styleDescription: string (detailed stylistic summary)
    
    Be extremely specific. For fonts, estimate weight (e.g., Bold 700). For colors, provide hex codes. 
    Analyze the "Visual Path": How does the eye travel? 
    Analyze the "Fidelity": Is it clean/vector or gritty/textured?
    CRITICAL: If there is a 'visual connector' (wavy line, ribbon, arrow) flowing across 2 or more slides, describe its color, thickness, and curve style in detail.
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
