import path from "path";
import { query } from "../lib/db.js";
import { generateCarouselScript, generateGridImage, detectLanguage } from "./gemini.js";
import { sliceCarouselGrid } from "./slicer.js";
import { sendCarouselToTelegram } from "./telegram.js";
import { SettingsManager } from "./SettingsManager.js";

export interface CarouselParams {
    carouselId: string;
    clipId: string;
    userId: string;
    styleId: string;
    topic?: string;
    targetAudience?: string;
}

export class CarouselService {
    static async generateCarousel(params: CarouselParams) {
        const { carouselId, clipId, userId, styleId, topic, targetAudience } = params;
        
        // Idempotency check: don't start if already ready or generating
        const currentRes = await query("SELECT status FROM carousels WHERE id = $1", [carouselId]);
        if (currentRes.rows.length > 0) {
            const status = currentRes.rows[0].status;
            if (status === 'ready') {
                console.log(`[CarouselService] Carousel ${carouselId} is already ready. Skipping generation.`);
                return { success: true, carouselId };
            }
            // If it's already generating, this is likely a redundant BullMQ retry due to stall timeout
            if (status === 'generating') {
                console.log(`[CarouselService] Carousel ${carouselId} is already in 'generating' state. Skipping to avoid loop.`);
                return { success: true, carouselId };
            }
        }

        try {
            const clipRes = await query("SELECT transcript, title FROM clips WHERE id = $1", [clipId]);
            if (clipRes.rows.length === 0) throw new Error("Clip not found");
            const { transcript, title } = clipRes.rows[0];

            let analysis: any;
            if (['ios-notes', 'dark-luxury', 'cyber-brutalist'].includes(styleId)) {
                // Template prompt mappings (copied from routes/carousels.ts logic)
                const templates: Record<string, any> = {
                    'ios-notes': { 
                        styleDescription: "iOS Notes app style, clean white background, San Francisco typography, minimalist UI elements",
                        design_dna: { vibe: "Clean, productivity-focused, minimalist" },
                        visual_elements: { art_style: "Flat Graphic" }
                    },
                    'dark-luxury': { 
                        styleDescription: "Luxury dark aesthetic, deep black and gold accents, elegant serif typography, high-end product photography style",
                        design_dna: { vibe: "Premium, exclusive, high-value" },
                        visual_elements: { art_style: "Realistic Photo" }
                    },
                    'cyber-brutalist': { 
                        styleDescription: "Cyber Brutalist style, high contrast, bold neon colors, glitch effects, raw industrial typography",
                        design_dna: { vibe: "Edgy, technical, bold" },
                        visual_elements: { art_style: "Flat Graphic" }
                    }
                };
                analysis = templates[styleId] || { styleDescription: "Clean modern style" };
            } else {
                const styleRes = await query("SELECT analysis FROM carousel_styles WHERE id = $1", [styleId]);
                if (styleRes.rows.length === 0) throw new Error("Style not found");
                analysis = styleRes.rows[0].analysis;
            }

            // Update status to generating
            await query("UPDATE carousels SET status = 'generating', error_message = NULL WHERE id = $1", [carouselId]);

            const userRes = await query("SELECT face_image_url, use_face_in_carousels FROM users WHERE telegram_id = $1", [String(userId)]);
            const user = userRes.rows[0];
            const faceRef = user?.use_face_in_carousels ? user.face_image_url : undefined;
            
            console.log(`[CarouselService] User ${userId} face settings: use_face=${user?.use_face_in_carousels}, face_url=${user?.face_image_url}`);
            if (faceRef) {
                console.log(`[CarouselService] Using face reference: ${faceRef}`);
            } else {
                console.log(`[CarouselService] NO face reference used (either disabled or missing URL)`);
            }

            const detectedLang = transcript ? (await detectLanguage(transcript) || 'ru') : 'ru';
            const script = await generateCarouselScript(transcript || title, topic || title, styleId, detectedLang, targetAudience);
            const gridUrl = await generateGridImage(script, analysis, faceRef);
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'carousels');
            
            // Fetch logo for programmatic overlay in slicer
            const logoUrl = await SettingsManager.getCarouselLogo();
            const slices = await sliceCarouselGrid(gridUrl, uploadsDir, logoUrl);

            await query(
                `UPDATE carousels 
                 SET script = $1, image_url = $2, slides = $3, status = 'ready', 
                     style_id = $4, target_audience = $5, topic = $6
                 WHERE id = $7`, 
                [JSON.stringify(script), gridUrl, slices, styleId, targetAudience, topic, carouselId]
            );

            await sendCarouselToTelegram(String(userId), slices.map(s => path.join(process.cwd(), 'public', s)), clipId, carouselId);
            
            return { success: true, carouselId };
        } catch (err: any) {
            console.error(`Carousel generation failed for ${carouselId}:`, err);
            await query("UPDATE carousels SET status = 'error', error_message = $1 WHERE id = $2", [err.message, carouselId]);
            throw err;
        }
    }
}
