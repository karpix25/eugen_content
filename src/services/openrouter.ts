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

export const generateImagePrompt = async (script: CarouselSlide[], styleAnalysis: any, hasFaceRef: boolean = false): Promise<string> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const faceInstruction = hasFaceRef ? `
    - CHARACTER INTEGRATION: The main character/subject in the scenes MUST be a person matching the provided reference image (e.g., an expert, speaker, or entrepreneur).
    - Consistency: Integrate this character naturally into the thematic logic of EACH slide's illustration.
  ` : "";

  const prompt = `
    Create a professional Instagram carousel as a single, unified, continuous vertical artwork.
    The goal is to create a high-end 2x3 grid (2 columns wide, 3 rows tall) of 6 slides.
    
    CONTENT TO RENDER (STRICT HIERARCHY):
    ${script.map((s, i) => `Slide ${i + 1}: TITLE: "${s.title}" | BODY: "${s.body}"`).join('\n')}
    
    LANGUAGE PRESERVATION RULE:
    - MANDATORY: DO NOT translate the TITLE or BODY text into English. 
    - Keep them EXACTLY in their original language (Russian or English) as provided above when describing what to render in the image.
    
    STYLE DESCRIPTION & DESIGN RULES:
    - ${styleAnalysis?.styleDescription || "Minimalist Professional Design"}
    - BRAIN ANALYSIS: ${styleAnalysis?.design_dna?.vibe || "Business Luxury"}
    - ART STYLE: ${styleAnalysis?.visual_elements?.art_style || "Flat Graphic"}.
    - COLORS: ${styleAnalysis?.color_system?.primary_hex?.join(", ") || "Corporate Blues"}.
    - ACCENT: ${styleAnalysis?.color_system?.accent_hex || "None"}.
    - LAYOUT RULES: ${styleAnalysis?.layout_logic?.grid_math || "Clean grid placement"}.
    - WHITE SPACE: ${styleAnalysis?.layout_logic?.whitespace_usage || "Balanced"}.
    - PHOTO LAYOUT: ${styleAnalysis?.photographic_style?.layout_type || "Single focal point"}.
    - PHOTO TREATMENT: ${styleAnalysis?.photographic_style?.photo_treatment || "Natural"}.
    - MASKING/EDGES: ${styleAnalysis?.photographic_style?.masking_logic || "Clean cuts"}.
    ${faceInstruction}
    
    CONTENT INSTRUCTIONS:
    If the style uses illustrations or background imagery, you MUST adapt the subject matter to the TITLE and BODY of each slide. 
    - MANDATORY: Keep the artwork strictly FLAT. No 3D, no realistic hands, no glossy textures unless explicitly requested.
    - VISUAL FLOW: Render the "${styleAnalysis?.layout_logic?.visual_connectors || "wavy lines"}" so they physically bridge the slides across the 2x3 grid.
    - SEAMLESSNESS: The background must be one continuous, high-resolution piece. NO borders between slides.

    TYPOGRAPHY SYSTEM:
    - FONT FAMILIES: ${styleAnalysis?.typography?.primary_family}, ${styleAnalysis?.typography?.secondary_family}.
    - HIERARCHY: ${styleAnalysis?.typography?.hierarchy_rules || "Titles significantly larger than body"}.
    - LETTER SPACING: ${styleAnalysis?.typography?.letter_spacing || "Normal"}.
    
    PLACEMENT GUIDELINES:
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

export const analyzeStyle = async (images: string | string[]): Promise<any> => {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");

  const imageList = Array.isArray(images) ? images : [images];
  
  const prompt = `You are an elite Creative Director and Brand Architect. 
    Analyze the provided design references to extract a comprehensive, corporate-level Design System.
    Synthesize the patterns across ALL provided images into a single cohesive stylistic DNA.
    
    Extract the following segments and return them in a STACKED JSON format:
    - design_dna: {
        vibe: string (Psychological impact: e.g., "High-trust professional", "Cyberpunk Brutalist", "Minimalist Luxury"),
        core_principles: string[] (e.g., "Deep contrast", "Geometric rigor", "Organic flow"),
        target_vibe: string
      },
    - typography: { 
        primary_family: string, 
        secondary_family: string, 
        hierarchy_rules: string (sizing ratios, line heights),
        letter_spacing: string,
        weight_pairings: string 
      },
    - color_system: { 
        primary_hex: string[], 
        secondary_hex: string[], 
        accent_hex: string,
        gradient_logic: string,
        background_vibe: string 
      },
    - layout_logic: { 
        grid_math: string (e.g., "8pt grid system", "Asymmetric modules"), 
        whitespace_usage: string (e.g., "Expansive macro-whitespace"),
        layering_depth: string (Z-index logic, shadow depth, blur usage),
        visual_connectors: string (EXACT description of how slides link: e.g., "Metallic liquid ribbons", "Continuous grain texture")
      },
    - visual_elements: { 
        corner_radii: string (e.g., "Strict 0px", "Extra rounded 32px"),
        stroke_weights: string,
        decorative_elements: string[],
        textures: string[] (e.g., "Film grain", "Paper noise", "Glass reflection", "Topographic lines"),
        art_style: "Flat Graphic" | "Minimalist Illustration" | "Realistic Photo" | "3D Glassmorphism" | "Scrapbook Collage"
      },
    - photographic_style: {
        layout_type: "Single focal point" | "Grid collage" | "Scrapbook overlap",
        photo_treatment: string (e.g., "B&W", "High grain", "White torn paper borders", "Polaroid style"),
        masking_logic: string (How photos are cropped: e.g., "Organic shapes", "Strict rectangles")
      },
    - prompts: { 
        midjourney_base: string (A highly distilled prompt for recreating this visual style, including collage/photographic rules)
      },
    - styleDescription: string (Executive summary of the design language),
    - thematicLogic: string (How the brand flow operates across the grid),
    - reuseInstructions: string (Strict rules for an AI generator)

    CRITICAL RULES:
    1. SYNTHESIS: If multiple images are provided, find the common denominator between them.
    2. TECHNICAL PRECISION: Be specific about "Stroke Weights" (e.g. 1px vs 4px) and "Corner Radii".
    3. FLATNESS/DEPTH: Clearly distinguish if the style is "Strictly Flat" or has "Depth and Layers".
    4. COLLAGE LOGIC: If images show multiple photos with offsets or torn edges, explicitly define this as "Scrapbook Collage" and describe the border and shadow logic.
  `;

  try {
    const formattedImages = imageList.map(img => ({
      type: "image_url" as const,
      image_url: {
        url: img.startsWith('http') ? img : (img.startsWith('data:') ? img : `data:image/png;base64,${img}`)
      }
    }));

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...formattedImages
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
