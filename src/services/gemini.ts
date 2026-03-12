import * as OpenRouter from './openrouter.js';
import * as Kie from './kie.js';

export const evaluateContent = OpenRouter.evaluateContent;
export const translateText = OpenRouter.translateText;
export const detectLanguage = OpenRouter.detectLanguage;
export const generateCarouselScript = OpenRouter.generateCarouselScript;
export const generateImagePrompt = OpenRouter.generateImagePrompt;

/**
 * High-level orchestration for grid image generation.
 * Takes the script and analysis, generates a visual prompt via OpenRouter,
 * and then calls kie.ai to generate the image.
 */
export const generateGridImage = async (script: OpenRouter.CarouselSlide[], styleAnalysis: any): Promise<string> => {
  console.log("Generating visual prompt via OpenRouter...");
  const prompt = await OpenRouter.generateImagePrompt(script, styleAnalysis);
  
  console.log("Generating grid image via Kie.ai (Nano Banana Pro)...");
  // Nano Banana works best with 2:3 or 3:2 for grids, documentation says 2:3 is common for vertical.
  // The slicer expects 2x3 grid, so 2:3 aspect ratio is correct for the whole image.
  return Kie.generateGridImage(prompt, "2:3");
};

export type CarouselSlide = OpenRouter.CarouselSlide;
