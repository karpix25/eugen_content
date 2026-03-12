import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  Type as TypeIcon, 
  Sparkles, 
  LayoutGrid, 
  Download, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2,
  Key,
  Palette,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Extend window for AI Studio API
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface SavedStyle {
  id: string;
  name: string;
  image: string;
  analysis: any;
  timestamp: number;
}

export default function App() {
  const [text, setText] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCopywriting, setIsCopywriting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedSavedStyle, setSelectedSavedStyle] = useState<string | null>(null);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [slices, setSlices] = useState<string[]>([]);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [slideRatio, setSlideRatio] = useState<'1:1' | '4:5'>('1:1');
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkKey();
    loadSavedStyles();
  }, []);

  const loadSavedStyles = () => {
    const stored = localStorage.getItem('insta_saved_styles');
    if (stored) {
      try {
        setSavedStyles(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load saved styles", e);
      }
    }
  };

  const saveStyle = (image: string, analysisResult: any) => {
    const newStyle: SavedStyle = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Style ${savedStyles.length + 1}`,
      image,
      analysis: analysisResult,
      timestamp: Date.now()
    };
    const updated = [newStyle, ...savedStyles];
    setSavedStyles(updated);
    localStorage.setItem('insta_saved_styles', JSON.stringify(updated));
    setSelectedSavedStyle(newStyle.id);
  };

  const deleteSavedStyle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedStyles.filter(s => s.id !== id);
    setSavedStyles(updated);
    localStorage.setItem('insta_saved_styles', JSON.stringify(updated));
    if (selectedSavedStyle === id) {
      setSelectedSavedStyle(null);
      setAnalysis(null);
    }
  };

  const checkKey = async () => {
    try {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } catch (e) {
      setHasKey(false);
    }
  };

  const handleOpenKey = async () => {
    await window.aistudio.openSelectKey();
    setHasKey(true);
  };

  const templates = [
    {
      id: 'ios-notes',
      name: 'iOS Notes',
      description: 'Paper texture, system fonts, and yellow accents.',
      icon: <TypeIcon className="w-4 h-4" />,
      prompt: "Aesthetic: iOS Notes app. Background: Light cream/off-white paper texture. Typography: Clean system sans-serif (Inter). Accents: Subtle yellow highlights and a 'Done' button style in the corner. Layout: Minimalist, organized, feels like a digital notebook."
    },
    {
      id: 'dark-luxury',
      name: 'Dark Luxury',
      description: 'Pure black, high contrast, and elegant serifs.',
      icon: <Palette className="w-4 h-4" />,
      prompt: "Aesthetic: Premium Dark Minimalist. Background: Pure black (#000000). Typography: High-contrast white. Mix of bold sans-serif and elegant italic serifs. Layout: Thin dividers, spacious, high-end fashion magazine feel."
    },
    {
      id: 'cyber-brutalist',
      name: 'Cyber Brutalist',
      description: 'Neon accents, thick borders, and tech vibes.',
      icon: <LayoutGrid className="w-4 h-4" />,
      prompt: "Aesthetic: Modern Cyber Brutalist. Background: Dark charcoal. Typography: Bold sans-serif and Monospace. Accents: Neon green or electric blue. Layout: Thick borders, aggressive headings, technical and edgy."
    }
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedTemplate(null);
      setSelectedSavedStyle(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setRefImage(base64);
        analyzeReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectTemplate = (id: string) => {
    setSelectedTemplate(id);
    setSelectedSavedStyle(null);
    setRefImage(null);
    setAnalysis(null);
  };

  const selectSavedStyle = (style: SavedStyle) => {
    setSelectedSavedStyle(style.id);
    setSelectedTemplate(null);
    setRefImage(style.image);
    setAnalysis(style.analysis);
  };

  const callGeminiWithRetry = async (fn: () => Promise<any>, maxRetries = 3, stepName?: string) => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const errorMsg = err.message || "";
        const isRetryable = 
          errorMsg.includes("503") || 
          errorMsg.includes("high demand") || 
          errorMsg.includes("429") ||
          errorMsg.includes("UNAVAILABLE") ||
          errorMsg.includes("Internal error");
        
        if (isRetryable && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
          const retryMsg = `Retrying ${stepName || 'API call'} (${i + 1}/${maxRetries})...`;
          console.log(retryMsg);
          setStatus(retryMsg);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const analyzeReferenceImage = async (image: string) => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: image.split(',')[1],
                  mimeType: "image/png"
                }
              },
              {
                text: `Analyze this design reference image in extreme detail. 
                Extract the following design variables and return them in a structured JSON format:
                - fonts: { primary: string, secondary: string, styles: string[], typographyRules: string (e.g., "highlight key words with larger size", "use italics for emphasis") }
                - colors: { primary: string[], secondary: string[], background: string }
                - layout: { gridType: string, elementPositions: string, alignment: string, layering: string (e.g., "notebook collage on top of abstract background") }
                - elements: { textures: string[], decorativeElements: string[], collageStyle: string, specificContentDetails: string (e.g., "handwritten notes inside a notebook element") }
                - styleDescription: string (detailed stylistic summary)
                
                Be very specific with font names and hex color codes. Pay close attention to how text is emphasized (bolding, sizing, different fonts for specific words).`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fonts: {
                type: Type.OBJECT,
                properties: {
                  primary: { type: Type.STRING },
                  secondary: { type: Type.STRING },
                  styles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  typographyRules: { type: Type.STRING }
                }
              },
              colors: {
                type: Type.OBJECT,
                properties: {
                  primary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  secondary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  background: { type: Type.STRING }
                }
              },
              layout: {
                type: Type.OBJECT,
                properties: {
                  gridType: { type: Type.STRING },
                  elementPositions: { type: Type.STRING },
                  alignment: { type: Type.STRING },
                  layering: { type: Type.STRING }
                }
              },
              elements: {
                type: Type.OBJECT,
                properties: {
                  textures: { type: Type.ARRAY, items: { type: Type.STRING } },
                  decorativeElements: { type: Type.ARRAY, items: { type: Type.STRING } },
                  collageStyle: { type: Type.STRING },
                  specificContentDetails: { type: Type.STRING }
                }
              },
              styleDescription: { type: Type.STRING }
            }
          }
        }
      }), 3, "Style Analysis");

      const result = JSON.parse(response.text);
      setAnalysis(result);
      saveStyle(image, result);
      return result;
    } catch (err) {
      console.error("Analysis error:", err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateCarousel = async () => {
    if (!text) {
      setError("Please enter some text for the carousel.");
      return;
    }

    setIsGenerating(true);
    setIsSearching(true);
    setIsCopywriting(false);
    setStatus("Starting research...");
    setError(null);
    setGeneratedImage(null);
    setSlices([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Step 1: Fact Checking & Research
      let facts = "";
      try {
        const searchResponse = await callGeminiWithRetry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Research and find 5-7 real-world facts, statistics, or recent expert insights about this topic: "${text}". 
          Focus on information that is surprising, counter-intuitive, or highly valuable.
          Return the facts in the original language of the topic.`,
          config: {
            tools: [{ googleSearch: {} }]
          }
        }), 3, "Research");
        facts = searchResponse.text || "";
      } catch (searchErr) {
        console.error("Search error after retries:", searchErr);
        // Continue without facts if search fails
      } finally {
        setIsSearching(false);
      }

      // Step 2: Professional Copywriting
      setStatus("Writing professional script...");
      setIsCopywriting(true);
      let finalSlides: { title: string, body: string }[] = [];
      try {
        const copyResponse = await callGeminiWithRetry(() => ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `You are a world-class social media copywriter specializing in high-retention Instagram carousels.
          Your task is to write a script for 6 slides based on this topic: "${text}" and these facts: "${facts}".
          
          RULES:
          1. LANGUAGE: Use the EXACT same language as the input: "${text}".
          2. STYLE: Corporate professional, minimalist, and authoritative. Avoid fluff.
          3. WORD LIMITS (STRICT): 
             - Title: Max 6 words (Punchy, bold).
             - Body: Max 15 words (Clear, high-value insight).
          4. TYPOGRAPHIC HIERARCHY: For each slide, provide a "title" (headline) and a "body" (concise description).
          5. NARRATIVE ARC:
             - Slide 1 (The Hook): High-level value proposition.
             - Slide 2 (The Context): The "Why" in business terms.
             - Slide 3 (The Insight): Data-driven or logical core point.
             - Slide 4 (The Strategy): Actionable corporate advice.
             - Slide 5 (The Transformation): Business impact/ROI.
             - Slide 6 (The CTA): Professional next step.
          
          OUTPUT FORMAT:
          Return ONLY a JSON array of 6 objects.
          Example: [{"title": "Headline", "body": "Supporting text"}, ... ]`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  body: { type: Type.STRING }
                },
                required: ["title", "body"]
              }
            }
          }
        }), 3, "Copywriting");
        finalSlides = JSON.parse(copyResponse.text);
      } catch (copyErr) {
        console.error("Copywriting error after retries:", copyErr);
        finalSlides = Array(6).fill(null).map((_, i) => ({ 
          title: `Slide ${i + 1}`, 
          body: "Professional insight and data-backed content for your audience." 
        }));
      } finally {
        setIsCopywriting(false);
      }

      // Step 3: Design Analysis or Template
      setStatus("Designing visual layout...");
      let designContext = "";
      if (refImage) {
        const designData = await analyzeReferenceImage(refImage);
        if (designData) {
          designContext = `
          DESIGN SPECIFICATIONS (FROM REFERENCE):
          - Fonts: Primary is ${designData.fonts?.primary || 'N/A'}, Secondary is ${designData.fonts?.secondary || 'N/A'}. Styles: ${designData.fonts?.styles?.join(', ') || 'N/A'}.
          - Typography Rules: ${designData.fonts?.typographyRules || 'N/A'} (Replicate the emphasis and hierarchy exactly).
          - Color Palette: Primary colors are ${designData.colors?.primary?.join(', ') || 'N/A'}. Secondary colors are ${designData.colors?.secondary?.join(', ') || 'N/A'}. Background is ${designData.colors?.background || 'N/A'}.
          - Layout & Layering: ${designData.layout?.gridType || 'N/A'} with ${designData.layout?.elementPositions || 'N/A'}. Layering structure: ${designData.layout?.layering || 'N/A'}.
          - Elements: Textures like ${designData.elements?.textures?.join(', ') || 'N/A'}. Decorative elements include ${designData.elements?.decorativeElements?.join(', ') || 'N/A'}. Collage style: ${designData.elements?.collageStyle || 'N/A'}.
          - Specific Details: ${designData.elements?.specificContentDetails || 'N/A'}.
          - Stylistic Summary: ${designData.styleDescription || 'N/A'}
          `;
        }
      } else if (selectedTemplate) {
        const template = templates.find(t => t.id === selectedTemplate);
        designContext = `DESIGN SPECIFICATIONS (FROM TEMPLATE): ${template?.prompt}`;
      }

      const ratioDesc = slideRatio === '1:1' ? "square (1:1)" : "portrait (4:5)";
      // Gemini 3.1 Flash Image supported ratios: "1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"
      // 2x3 grid of 1:1 slides is 2:3 (0.66). Closest supported is 3:4 (0.75).
      // 2x3 grid of 4:5 slides is 8:15 (0.53). Closest supported is 9:16 (0.56).
      const totalRatio = slideRatio === '1:1' ? "3:4" : "9:16";

      const parts: any[] = [
        { text: `Create a professional Instagram carousel as a single, unified, continuous vertical artwork.
                 
                 CONTENT TO RENDER (STRICT HIERARCHY):
                 - Slide 1: TITLE: "${finalSlides[0].title}" | BODY: "${finalSlides[0].body}"
                 - Slide 2: TITLE: "${finalSlides[1].title}" | BODY: "${finalSlides[1].body}"
                 - Slide 3: TITLE: "${finalSlides[2].title}" | BODY: "${finalSlides[2].body}"
                 - Slide 4: TITLE: "${finalSlides[3].title}" | BODY: "${finalSlides[3].body}"
                 - Slide 5: TITLE: "${finalSlides[4].title}" | BODY: "${finalSlides[4].body}"
                 - Slide 6: TITLE: "${finalSlides[5].title}" | BODY: "${finalSlides[5].body}"
                 
                 TYPOGRAPHY & DESIGN RULES (CORPORATE LEVEL):
                 1. MINIMALISM: Use ample negative space (white space). Do NOT crowd the slides.
                 2. VISUAL HIERARCHY: The TITLE must be significantly LARGER (at least 3x) and BOLDER than the BODY text.
                 3. TYPOGRAPHIC PAIRING: Use a strong, clean sans-serif for titles and a highly legible, lighter weight for body text.
                 4. ALIGNMENT: Use strict grid alignment. Text should be perfectly centered or follow a clean corporate margin.
                 5. BREVITY: Render ONLY the provided text. No extra decorative words.
                 6. NO LABELS: Do NOT render "TITLE:", "BODY:", or "Slide X".
                 
                 LANGUAGE REQUIREMENT:
                 - RENDER THE TEXT EXACTLY AS PROVIDED.
                 
                 ${designContext}
                 
                 GRID STRUCTURE:
                 The image MUST be designed as a 2x3 grid (2 columns wide and 3 rows tall), totaling 6 slides.
                 Each individual slide section must be in ${ratioDesc} aspect ratio.
                 
                 CRITICAL SEAMLESS INSTRUCTION: 
                 - ABSOLUTELY NO GRID LINES, BORDERS, OR DIVIDERS.
                 - The background design MUST be clean, sophisticated, and flow fluidly across the entire canvas.
                 
                 TEXT PLACEMENT:
                 - Place EXACTLY ONE title+body pair on each of the 6 slides.
                 - Ensure text is vertically and horizontally centered within each slide's safety zone (avoid edges).
                 - CRITICAL: Text MUST NOT be split between slides.
                 - Use professional leading (line spacing) and tracking (letter spacing).
                 
                 The final output must be one solid, clean image with absolutely no internal lines, perfectly aligned for a 2x3 grid crop.` }
      ];

      if (refImage) {
        parts.push({
          inlineData: {
            data: refImage.split(',')[1],
            mimeType: "image/png"
          }
        });
      }

      setStatus("Generating high-resolution artwork...");
      const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: totalRatio as any,
            imageSize: "1K"
          }
        }
      }), 3, "Image Generation");

      setStatus("Processing and slicing carousel...");
      let base64 = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64 = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!base64) {
        throw new Error("No image was generated. Please try again.");
      }

      setGeneratedImage(base64);

      // Call backend to slice
      const sliceRes = await fetch('/api/slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });

      if (!sliceRes.ok) {
        throw new Error("Failed to slice the image.");
      }

      const { slices } = await sliceRes.json();
      setSlices(slices);
      setStatus(null);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      }
    } finally {
      setIsGenerating(false);
      setStatus(null);
    }
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
              <Key className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">API Key Required</h1>
            <p className="text-zinc-400">
              To use Gemini 3.1 Flash Image, you need to select a paid API key from your Google Cloud project.
            </p>
            <div className="pt-4">
              <button
                onClick={handleOpenKey}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Select API Key
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Gemini API billing</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <LayoutGrid className="text-black w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">InstaCarousel <span className="text-orange-500">AI</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Nano Banana 2 Engine</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-6">
              <div className="flex items-center gap-2 text-orange-500">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Configuration</h2>
              </div>

              {/* Text Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <TypeIcon className="w-4 h-4" />
                  Carousel Content
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter 6 points or a story (the AI will split it into 6 headlines, one for each slide)..."
                  className="w-full h-32 bg-zinc-900/50 border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none text-lg"
                />
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Slide Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSlideRatio('1:1')}
                    className={cn(
                      "py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-center gap-2",
                      slideRatio === '1:1' 
                        ? "bg-orange-500 border-orange-500 text-black" 
                        : "bg-zinc-900/50 border-white/10 text-zinc-400 hover:border-white/20"
                    )}
                  >
                    <div className="w-3 h-3 border-2 border-current rounded-sm" />
                    Square (1:1)
                  </button>
                  <button
                    onClick={() => setSlideRatio('4:5')}
                    className={cn(
                      "py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-center gap-2",
                      slideRatio === '4:5' 
                        ? "bg-orange-500 border-orange-500 text-black" 
                        : "bg-zinc-900/50 border-white/10 text-zinc-400 hover:border-white/20"
                    )}
                  >
                    <div className="w-3 h-4 border-2 border-current rounded-sm" />
                    Portrait (4:5)
                  </button>
                </div>
              </div>

              {/* Style Selection */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Choose Style Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all group relative overflow-hidden",
                        selectedTemplate === t.id 
                          ? "bg-orange-500/10 border-orange-500/50" 
                          : "bg-zinc-900/50 border-white/5 hover:border-white/20"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors",
                        selectedTemplate === t.id ? "bg-orange-500 text-white" : "bg-white/5 text-zinc-500 group-hover:text-zinc-300"
                      )}>
                        {t.icon}
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{t.name}</h4>
                      <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">{t.description}</p>
                      {selectedTemplate === t.id && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-orange-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {savedStyles.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Your Saved Styles</label>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {savedStyles.map((style) => (
                        <div
                          key={style.id}
                          onClick={() => selectSavedStyle(style)}
                          className={cn(
                            "relative shrink-0 w-24 aspect-square rounded-xl border-2 cursor-pointer transition-all overflow-hidden group",
                            selectedSavedStyle === style.id ? "border-orange-500" : "border-white/5 hover:border-white/20"
                          )}
                        >
                          <img src={style.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={(e) => deleteSavedStyle(e, style.id)}
                              className="p-1.5 bg-red-500 rounded-full hover:scale-110 transition-transform"
                            >
                              <AlertCircle className="w-3 h-3 text-white" />
                            </button>
                          </div>
                          {selectedSavedStyle === style.id && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2 className="w-3 h-3 text-orange-500" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-zinc-600"><span className="bg-zinc-950 px-2">or upload your own</span></div>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center gap-4 overflow-hidden",
                    refImage ? "border-orange-500/50 aspect-video" : "border-white/10 h-32 hover:border-orange-500/30 hover:bg-white/5"
                  )}
                >
                  {refImage ? (
                    <>
                      <img src={refImage} alt="Reference" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-sm font-medium">Change Reference</p>
                      </div>
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                          <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Analyzing Style...</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-zinc-500" />
                      </div>
                      <p className="text-xs text-zinc-500">Click to upload custom style reference</p>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>

              {/* Analysis Results (Optional Display) */}
              {analysis && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Search className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Style Analysis</span>
                    </div>
                    <button onClick={() => setAnalysis(null)} className="text-zinc-600 hover:text-zinc-400">
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div className="space-y-1">
                      <p className="text-zinc-500 uppercase font-bold">Fonts</p>
                      <p className="text-zinc-300 truncate">{analysis.fonts?.primary || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-zinc-500 uppercase font-bold">Colors</p>
                      <div className="flex gap-1">
                        {analysis.colors?.primary?.slice(0, 3).map((c: string, i: number) => (
                          <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} title={c} />
                        )) || <span className="text-zinc-600">N/A</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 italic">"{analysis.styleDescription || 'No description available'}"</p>
                </motion.div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateCarousel}
                disabled={isGenerating || !text}
                className="w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-500/10 active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{status || "Generating Magic..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate Carousel
                  </>
                )}
              </button>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-500">
                <LayoutGrid className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Preview & Slices</h2>
              </div>
              {slices.length > 0 && (
                <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to Post
                </div>
              )}
            </div>

            <div className="min-h-[600px] bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
              <AnimatePresence mode="wait">
                {!generatedImage && !isGenerating && (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <ImageIcon className="w-10 h-10 text-zinc-700" />
                    </div>
                    <h3 className="text-xl font-medium text-zinc-400">No carousel generated yet</h3>
                    <p className="text-zinc-600 max-w-xs mx-auto">
                      Configure your content and style on the left to start the AI generation process.
                    </p>
                  </motion.div>
                )}

                {isGenerating && (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center space-y-6"
                  >
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto" />
                      <Sparkles className="w-8 h-8 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-medium text-white">
                        {status || "Crafting your carousel"}
                      </h3>
                      <p className="text-zinc-500 animate-pulse">
                        {isSearching ? "Finding real-world facts and statistics..." : isCopywriting ? "Applying narrative psychology and hooks..." : "This may take a minute or two..."}
                      </p>
                    </div>
                  </motion.div>
                )}

                {generatedImage && !isGenerating && (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full space-y-12"
                  >
                    {/* Full Grid Preview */}
                    <div className="space-y-4">
                      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest text-center">Full 2x3 Grid Composition</p>
                      <div className="relative group max-w-md mx-auto">
                        <img 
                          src={generatedImage} 
                          alt="Generated Grid" 
                          className="w-full rounded-2xl shadow-2xl"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                           <a 
                            href={generatedImage} 
                            download="carousel-grid.png"
                            className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
                           >
                            <Download className="w-6 h-6" />
                           </a>
                        </div>
                      </div>
                    </div>

                    {/* Slices Grid */}
                    {slices.length > 0 && (
                      <div className="space-y-6">
                        <div className="h-px bg-white/5 w-full" />
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest text-center">Individual Sliced Slides</p>
                        <div className={cn(
                          "grid grid-cols-2 gap-0 bg-black rounded-2xl overflow-hidden",
                          slideRatio === '4:5' ? "aspect-[8/15]" : "aspect-[2/3]"
                        )}>
                          {slices.map((slice, idx) => (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={cn(
                                "relative group overflow-hidden bg-black",
                                slideRatio === '4:5' ? "aspect-[4/5]" : "aspect-square"
                              )}
                            >
                              <img src={slice} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                                Slide {idx + 1}
                              </div>
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a 
                                  href={slice} 
                                  download={`slide-${idx + 1}.png`}
                                  className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-zinc-500 text-sm">© 2026 InstaCarousel AI. Powered by Google Gemini.</p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm">Documentation</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm">Privacy Policy</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
