import * as OpenRouter from './openrouter.js';
import * as Kie from './kie.js';
import { SettingsManager } from './SettingsManager.js';

export const evaluateContent = OpenRouter.evaluateContent;
export const translateText = OpenRouter.translateText;
export const detectLanguage = OpenRouter.detectLanguage;
export const generateCarouselScript = OpenRouter.generateCarouselScript;
export const generatePlaquePrompt = OpenRouter.generatePlaquePrompt;
export const generateImagePrompt = OpenRouter.generateImagePrompt;
export const analyzeStyle = OpenRouter.analyzeStyle;

/**
 * High-level orchestration for grid image generation.
 * Takes the script and analysis, generates a visual prompt via OpenRouter,
 * and then calls kie.ai to generate the image.
 */
export const generateGridImage = async (script: OpenRouter.CarouselSlide[], styleAnalysis: any, referImageUrl?: string): Promise<string> => {
  console.log("Fetching global logo...");
  const logoUrl = await SettingsManager.getCarouselLogo();
  
  console.log("Generating visual prompt via OpenRouter...");
  const prompt = await OpenRouter.generateImagePrompt(script, styleAnalysis, !!referImageUrl, logoUrl);
  
  console.log("Generating grid image via Kie.ai (Nano Banana Pro)...");
  return Kie.generateGridImage(prompt, "2:3", referImageUrl);
};

/**
 * High-level orchestration for single plaque image generation.
 */
export const generatePlaqueImage = async (topic: string): Promise<string> => {
  console.log(`Generating plaque prompt for topic: ${topic}...`);
  const prompt = await OpenRouter.generatePlaquePrompt(topic);
  
  console.log("Generating plaque image via Kie.ai (Nano Banana Pro)...");
  // Plaques are rectangular, 3:2 or 16:9. 3:2 is a good compromise for wide banners.
  return Kie.generateGridImage(prompt, "3:2");
};

export type CarouselSlide = OpenRouter.CarouselSlide;
