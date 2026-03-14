import cron from "node-cron";
import fs from "fs";
import { query } from "../lib/db.js";
import { downloadYouTubeVideo } from "../services/video-downloader.js";
import { uploadToS3 } from "../lib/s3.js";
import { sendToVizard, getVizardProjectStatus } from "../services/vizard.js";
import { processClip } from "../services/processor.js";
import { sanitizeFolderName } from "../lib/sanitize.js";
import { detectLanguage, translateText } from "../services/gemini.js";

const normalizeLang = (lang: string | null): string | null => {
  if (!lang) return null;
  const l = lang.toLowerCase().trim();
  if (l.includes('russian') || l === 'ru') return 'ru';
  if (l.includes('english') || l === 'en') return 'en';
  if (l.includes('spanish') || l === 'es') return 'es';
  return l;
};

export const handleVizardFallback = async (videoId: string) => {
  try {
    await query("UPDATE videos SET status = 'vizard_fallback_running', error_message = 'Downloading video for S3 fallback...' WHERE id = $1", [videoId]);
    
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const downloaded = await downloadYouTubeVideo(videoUrl);
    
    if (!downloaded) {
      throw new Error("Failed to download video via yt-dlp");
    }

    const { filePath, fileName } = downloaded;
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`[Vizard Fallback] Uploading ${fileName} to S3...`);
    const uploadResult = await uploadToS3(fileBuffer, fileName, 'video/mp4');
    
    const s3Url = (uploadResult as any).Location;
    console.log(`[Vizard Fallback] S3 URL: ${s3Url}`);

    console.log(`[Vizard Fallback] Resending to Vizard with Direct URL...`);
    const newProjectId = await sendToVizard(s3Url, videoId, 1); 

    if (newProjectId) {
      await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard', error_message = 'Resent via S3 fallback' WHERE id = $2", [newProjectId, videoId]);
      console.log(`[Vizard Fallback] Success! New Project ID: ${newProjectId}`);
    } else {
      throw new Error("Failed to resend to Vizard after S3 upload");
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  } catch (error: any) {
    console.error(`[Vizard Fallback] Hard failure for ${videoId}:`, error.message);
    await query("UPDATE videos SET status = 'failed', error_message = $1 WHERE id = $2", 
      [`Fallback Failed: ${error.message}`, videoId]);
  }
};

export const autoSendToVizard = async () => {
  console.log("Checking for approved videos to send to Vizard...");
  try {
    const approvedVideos = await query("SELECT id FROM videos WHERE status = 'approved' AND vizard_project_id IS NULL LIMIT 5");
    for (const video of approvedVideos.rows) {
      console.log(`[Auto] Sending approved video ${video.id} to Vizard...`);
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const vizardId = await sendToVizard(videoUrl, video.id);
      if (vizardId) {
        await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard' WHERE id = $2", [vizardId, video.id]);
        console.log(`[Auto] Successfully sent ${video.id} to Vizard. ID: ${vizardId}`);
      }
    }
  } catch (err) {
    console.error("Auto-Vizard error:", err);
  }
};

export const pollVizardStatus = async () => {
    console.log("Polling Vizard for completed projects...");
    try {
      const sentVideos = await query("SELECT id, vizard_project_id, title FROM videos WHERE status = 'sent_to_vizard'");
      for (const v of sentVideos.rows) {
        if (!v.vizard_project_id) continue;

        const statusData = await getVizardProjectStatus(v.vizard_project_id);
        if (!statusData) {
          console.log(`No status data for project ${v.vizard_project_id}`);
          continue;
        }

        const clips = statusData.videos || statusData.data;
        const isSuccess = (statusData.code === 0 || statusData.code === 2000) && clips && Array.isArray(clips);
        const isPending = statusData.code === 1000 || statusData.code === 0 && (!clips || !Array.isArray(clips));
        const isError = !isSuccess && !isPending && statusData.code !== undefined;

        if (isError) {
          const errMsg = statusData.errMsg || statusData.message || "Unknown Vizard error";
          console.error(`[Vizard] Project ${v.vizard_project_id} failed with code ${statusData.code}: ${errMsg}`);
          
          if (statusData.code === 4008) {
            console.log(`[Vizard Fallback] Error 4008 detected for ${v.id}. Starting S3 fallback...`);
            handleVizardFallback(v.id);
            continue;
          }

          await query("UPDATE videos SET status = 'failed', error_message = $1 WHERE id = $2", 
            [`Vizard Error ${statusData.code}: ${errMsg}`, v.id]);
          continue;
        }

        if (isSuccess) {
          console.log(`Vizard project ${v.vizard_project_id} completed. Saving clips... count: ${clips.length}`);

          await query("UPDATE videos SET status = 'completed', error_message = NULL WHERE id = $1", [v.id]);

          const videoResult = await query("SELECT detected_language, target_language, transcript, approved_by FROM videos WHERE id = $1", [v.id]);
          const video = videoResult.rows[0];
          
          let detLang = normalizeLang(video?.detected_language);
          const tarLang = normalizeLang(video?.target_language);
          const approvedBy = video?.approved_by;

          if (!detLang && video?.transcript) {
            detLang = await detectLanguage(video.transcript);
            if (detLang) {
              detLang = normalizeLang(detLang);
              await query("UPDATE videos SET detected_language = $1 WHERE id = $2", [detLang, v.id]);
            }
          }

          const finalLanguage = tarLang || detLang || null;
          const needsTranslation = tarLang && detLang && tarLang !== detLang;

          // Fetch approver's default plaque
          let approverPlaqueUrl = null;
          if (approvedBy) {
            const userPRes = await query(`
              SELECT p.image_url 
              FROM users u 
              JOIN ad_plaques p ON u.default_plaque_id = p.id 
              WHERE u.telegram_id = $1
            `, [approvedBy]);
            if (userPRes.rows.length > 0) {
              approverPlaqueUrl = userPRes.rows[0].image_url;
            }
          }

          for (const c of clips) {
            const originalClipId = Math.random().toString(36).substr(2, 9);
            const originalTitle = c.title || "Vizard Clip";
            const originalTranscript = c.transcript || '';
            const originalHook = c.hook || c.headline || "";
            const finalInsertLang = normalizeLang(video?.detected_language);
            try {
              await query(
                "INSERT INTO clips (id, video_id, url, title, hook, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, $7, 'raw', $8)",
                [originalClipId, v.id, c.videoUrl || c.url || c.video_url, originalTitle, originalHook, c.thumbnail_url || '', originalTranscript, finalInsertLang]
              );
              await query("UPDATE clips SET status = 'processed' WHERE id = $1", [originalClipId]);
            } catch (insErr: any) {
              console.error(`[Vizard] Failed to insert clip ${originalClipId}:`, insErr.message);
            }

            if (needsTranslation && finalLanguage) {
              const dubbedClipId = Math.random().toString(36).substr(2, 9);
              let translatedTitle = originalTitle;
              let translatedTranscript = originalTranscript;
              let translatedHook = originalHook;

              const [tTitle, tTranscript, tHook] = await Promise.all([
                translateText(originalTitle, finalLanguage),
                translateText(originalTranscript, finalLanguage),
                translateText(originalHook, finalLanguage)
              ]);

              if (tTitle) translatedTitle = tTitle;
              if (tTranscript) translatedTranscript = tTranscript;
              if (tHook) translatedHook = tHook;

              try {
                await query(
                  "INSERT INTO clips (id, video_id, url, title, hook, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, $7, 'raw', $8)",
                  [dubbedClipId, v.id, c.videoUrl || c.url || c.video_url, translatedTitle, translatedHook, c.thumbnail_url || '', translatedTranscript, finalLanguage]
                );
              } catch (insErr: any) {
                console.error(`[Vizard] Failed to insert dubbed clip ${dubbedClipId}:`, insErr.message);
              }

              if (!approverPlaqueUrl) {
                console.error(`[Vizard] Skipping dubbed clip ${dubbedClipId} - no default plaque for approver ${approvedBy}`);
                continue;
              }

              try {
                const folderName = sanitizeFolderName(v.title || "Unknown_Video");
                await processClip(
                  dubbedClipId,
                  c.videoUrl || c.url || c.video_url,
                  approverPlaqueUrl,
                  finalLanguage,
                  finalInsertLang,
                  false,
                  undefined,
                  undefined,
                  undefined,
                  folderName
                );
              } catch (err) {
                console.error(`Error processing dubbed clip ${dubbedClipId}:`, err);
              }
            }
          }
        } else if (!isPending) {
          await query("UPDATE videos SET status = 'rejected' WHERE id = $1", [v.id]);
        }
      }
    } catch (e) {
      console.error("Error pooling Vizard statuses", e);
    }
};

export function initVizardWorker() {
  cron.schedule('*/15 * * * *', autoSendToVizard);
  cron.schedule('*/2 * * * *', pollVizardStatus);
}
