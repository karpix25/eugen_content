import cron from "node-cron";
import fs from "fs";
import { query } from "../lib/db.js";
import { downloadYouTubeVideo } from "../services/video-downloader.js";
import { uploadToS3 } from "../lib/s3.js";
import { sendToVizard, getVizardProjectStatus, listVizardProjects, storeVizardClipInS3 } from "../services/vizard.js";
import { processClip, generateThumbnail } from "../services/processor.js";
import { sanitizeFolderName } from "../lib/sanitize.js";
import { detectLanguage, translateText } from "../services/gemini.js";
import { videoProcessingQueue, renderingQueue } from "../lib/queues.js";

const normalizeLang = (lang: string | null): string | null => {
  if (!lang) return null;
  const l = lang.toLowerCase().trim();
  if (l.includes('russian') || l === 'ru') return 'ru';
  if (l.includes('english') || l === 'en') return 'en';
  if (l.includes('spanish') || l === 'es') return 'es';
  return l;
};

async function recoverLostVizardIds() {
  const stuckVideos = await query(
    "SELECT id FROM videos WHERE status IN ('approved', 'vizard_creating', 'sent_to_vizard', 'vizard_processing') AND (vizard_project_id IS NULL OR vizard_project_id IN ('unknown_id', 'project_exists_but_no_id')) LIMIT 25"
  );
  
  if (stuckVideos.rows.length === 0) return;

  console.log(`[Recovery] Attempting to recover IDs for ${stuckVideos.rows.length} stuck videos...`);
  try {
    const vizardProjects: any[] = [];
    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      const page = await listVizardProjects(pageNo, 100);
      if (!page || page.length === 0) break;
      vizardProjects.push(...page);
      if (page.length < 100) break;
    }

    if (!vizardProjects || vizardProjects.length === 0) return;

    for (const video of stuckVideos.rows) {
      const expectedName = `Youtube_${video.id}`;
      const match = vizardProjects.find((p: any) => 
        p.projectName === expectedName || 
        p.projectName === video.id || 
        p.external_id === video.id ||
        p.externalId === video.id
      );

      if (match) {
        const vizardId = match.projectId || match.id;
        console.log(`[Recovery] Found lost ID for ${video.id}: ${vizardId}`);
        await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard', vizard_requested_at = COALESCE(vizard_requested_at, NOW()) WHERE id = $2", [vizardId, video.id]);
      }
    }
  } catch (err: any) {
    console.error("[Recovery] Failed to recover IDs:", err.message);
  }
}

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
    
    // Fetch global Vizard settings
    const settingsRes = await query("SELECT key, value FROM global_settings WHERE key IN ('vizard_prefer_length', 'vizard_remove_silence', 'vizard_auto_broll')");
    const settings = settingsRes.rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});

    const newProjectId = await sendToVizard(s3Url, videoId, {
      videoType: 1,
      preferLength: [Number(settings.vizard_prefer_length || 2)],
      removeSilenceSwitch: Number(settings.vizard_remove_silence || 0),
      autoBrollSwitch: Number(settings.vizard_auto_broll || 0)
    });
    if (newProjectId) {
      await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard', vizard_requested_at = NOW(), error_message = 'Resent via S3 fallback' WHERE id = $2", [newProjectId, videoId]);
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
  await recoverLostVizardIds();
  try {
    // Fetch global Vizard settings
    const settingsRes = await query("SELECT key, value FROM global_settings WHERE key IN ('vizard_prefer_length', 'vizard_remove_silence', 'vizard_auto_broll')");
    const settings = settingsRes.rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});

    const approvedVideos = await query("SELECT id FROM videos WHERE status = 'approved' AND vizard_project_id IS NULL LIMIT 5");
    for (const video of approvedVideos.rows) {
      console.log(`[Auto] Sending approved video ${video.id} to Vizard...`);
      
      // Mark as sending to prevent duplicate triggers
      await query("UPDATE videos SET status = 'vizard_creating', vizard_requested_at = NOW() WHERE id = $1", [video.id]);

      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      try {
        const vizardId = await sendToVizard(videoUrl, video.id, {
          preferLength: [Number(settings.vizard_prefer_length || 2)],
          removeSilenceSwitch: Number(settings.vizard_remove_silence || 0),
          autoBrollSwitch: Number(settings.vizard_auto_broll || 0)
        });

        if (vizardId) {
          await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard', vizard_requested_at = NOW() WHERE id = $2", [vizardId, video.id]);
          console.log(`[Auto] Successfully sent ${video.id} to Vizard. ID: ${vizardId}`);
        } else {
          // If null, it might have failed or project already exists without ID
          await query("UPDATE videos SET status = 'approved', error_message = 'Failed to get Vizard ID, retrying...' WHERE id = $1", [video.id]);
        }
      } catch (err: any) {
        console.error(`[Auto] Error sending ${video.id} to Vizard:`, err.message);
        await query("UPDATE videos SET status = 'approved', error_message = $1 WHERE id = $2", [err.message, video.id]);
      }
    }
    
    // Recovery for projects stuck in 'vizard_creating' for more than 30 mins
    await query(`
      UPDATE videos 
      SET status = 'approved', error_message = 'Recovered from vizard_creating timeout' 
      WHERE status = 'vizard_creating' 
      AND COALESCE(vizard_requested_at, created_at) < NOW() - INTERVAL '30 minutes'
    `);
  } catch (err) {
    console.error("Auto-Vizard error:", err);
  }
};

export const pollVizardStatus = async () => {
    console.log("Polling Vizard for completed projects...");
    try {
      const sentVideos = await query("SELECT id, vizard_project_id, title FROM videos WHERE status IN ('sent_to_vizard', 'vizard_processing')");
      for (const v of sentVideos.rows) {
        if (!v.vizard_project_id || v.vizard_project_id === 'unknown_id') {
           // If we have no ID but we were supposed to, try to reset to approved so it can be re-sent or recovered
           await query("UPDATE videos SET status = 'approved', vizard_project_id = NULL WHERE id = $1", [v.id]);
           continue;
        }

        // Set to processing to indicate we are actively working on it
        await query("UPDATE videos SET status = 'vizard_processing' WHERE id = $1", [v.id]);

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
            const vizardClipUrl = c.videoUrl || c.url || c.video_url;

            if (!vizardClipUrl) {
              console.error(`[Vizard] Skipping clip for video ${v.id} because Vizard did not return a clip URL.`);
              continue;
            }

            try {
              const storedClipUrl = await storeVizardClipInS3(vizardClipUrl, originalClipId, v.id);
              if (!storedClipUrl) {
                throw new Error('Failed to store Vizard clip in S3');
              }

              const thumbUrl = await generateThumbnail(storedClipUrl, originalClipId);
              await query(
                "INSERT INTO clips (id, video_id, url, title, hook, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, $7, 'raw', $8)",
                [originalClipId, v.id, storedClipUrl, originalTitle, originalHook, thumbUrl || c.thumbnail_url || '', originalTranscript, finalInsertLang]
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
              let storedDubbedSourceUrl: string | null = null;

              const [tTitle, tTranscript, tHook] = await Promise.all([
                translateText(originalTitle, finalLanguage),
                translateText(originalTranscript, finalLanguage),
                translateText(originalHook, finalLanguage)
              ]);

              if (tTitle) translatedTitle = tTitle;
              if (tTranscript) translatedTranscript = tTranscript;
              if (tHook) translatedHook = tHook;

              try {
                storedDubbedSourceUrl = await storeVizardClipInS3(vizardClipUrl, dubbedClipId, v.id);
                if (!storedDubbedSourceUrl) {
                  throw new Error('Failed to store dubbed Vizard clip source in S3');
                }

                await query(
                  "INSERT INTO clips (id, video_id, url, title, hook, thumbnail, transcript, status, language) VALUES ($1, $2, $3, $4, $5, $6, $7, 'raw', $8)",
                  [dubbedClipId, v.id, storedDubbedSourceUrl, translatedTitle, translatedHook, c.thumbnail_url || '', translatedTranscript, finalLanguage]
                );

                const dubbedThumbUrl = await generateThumbnail(storedDubbedSourceUrl, dubbedClipId);
                if (dubbedThumbUrl) {
                  await query("UPDATE clips SET thumbnail = $1 WHERE id = $2", [dubbedThumbUrl, dubbedClipId]);
                }
              } catch (insErr: any) {
                console.error(`[Vizard] Failed to insert dubbed clip ${dubbedClipId}:`, insErr.message);
                continue;
              }

              if (!approverPlaqueUrl) {
                console.error(`[Vizard] Skipping dubbed clip ${dubbedClipId} - no default plaque for approver ${approvedBy}`);
                continue;
              }

              try {
                const folderName = sanitizeFolderName(v.title || "Unknown_Video");
                await renderingQueue.add(`render-dub-${dubbedClipId}`, {
                  clipId: dubbedClipId,
                  videoUrl: storedDubbedSourceUrl || vizardClipUrl,
                  plaqueImageUrl: approverPlaqueUrl,
                  targetLang: finalLanguage,
                  sourceLang: finalInsertLang,
                  videoFolderName: folderName
                });
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
  cron.schedule('*/5 * * * *', async () => {
    await videoProcessingQueue.add('auto-vizard', { type: 'auto-vizard' });
  });
  cron.schedule('*/2 * * * *', async () => {
    await videoProcessingQueue.add('poll-vizard', { type: 'poll-vizard' });
  });
}
