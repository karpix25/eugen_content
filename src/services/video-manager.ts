import { query } from '../lib/db.js';
import { getTranscript, getLatestVideos } from './apify.js';
import { evaluateContent } from './gemini.js';
import { sendToVizard } from './vizard.js';

export class VideoManager {
  static async getAllVideos() {
    const result = await query("SELECT * FROM videos ORDER BY published_at DESC");
    return result.rows;
  }

  static async monitorChannels() {
    const channelsResult = await query("SELECT * FROM channels");
    const results = [];

    for (const channel of channelsResult.rows) {
      try {
        const scrapeDays = channel.scrape_days ?? 0;
        let publishedAfter = undefined;
        if (scrapeDays > 0) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - scrapeDays);
          publishedAfter = pastDate.toISOString().split('T')[0];
        }

        const discoveredVideos = await getLatestVideos(`https://www.youtube.com/channel/${channel.id}/videos`, 10, publishedAfter);

        for (const item of discoveredVideos) {
          const videoId = item.id;
          if (!videoId) continue;

          const existing = await query("SELECT id FROM videos WHERE id = $1", [videoId]);
          if (existing.rows.length > 0) continue;

          await query(`
            INSERT INTO videos (id, channel_id, title, description, published_at, thumbnail)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [videoId, channel.id, item.title, item.description, item.publishedAt, item.thumbnail]);

          // Fire and forget transcript and evaluation
          this.processVideoBackground(videoId, item);
          results.push(videoId);
        }
      } catch (error) {
        console.error(`Error monitoring channel ${channel.id}:`, error);
      }
    }
    return results;
  }

  private static async processVideoBackground(videoId: string, item: any) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const transcript = await getTranscript(videoUrl);
      if (transcript) {
        await query("UPDATE videos SET transcript = $1 WHERE id = $2", [transcript, videoId]);
        const evaluation = await evaluateContent(item.title, transcript, "Предприниматели, интересующиеся ИИ и автоматизацией");
        if (evaluation) {
          await query("UPDATE videos SET ai_score = $1, ai_evaluation = $2, detected_language = $3 WHERE id = $4", 
            [evaluation.score, evaluation.evaluation, evaluation.detected_language, videoId]);
        }
      }
    } catch (error) {
      console.error(`Background processing failed for video ${videoId}:`, error);
    }
  }

  static async evaluateVideo(id: string, targetAudience: string) {
    const result = await query("SELECT * FROM videos WHERE id = $1", [id]);
    const video = result.rows[0];

    if (!video) throw new Error("Video not found");
    if (!video.transcript) throw new Error("Transcript not available for evaluation");

    const evaluation = await evaluateContent(video.title, video.transcript, targetAudience);
    if (!evaluation) throw new Error("AI Evaluation failed");

    await query("UPDATE videos SET ai_score = $1, ai_evaluation = $2, detected_language = $3 WHERE id = $4",
      [evaluation.score, evaluation.evaluation, evaluation.detected_language, id]);
    
    return evaluation;
  }

  static async approveVideo(id: string, targetLanguage?: string) {
    await query("UPDATE videos SET status = 'approved', target_language = $2 WHERE id = $1", [id, targetLanguage || null]);
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const vizardId = await sendToVizard(videoUrl, id);
    
    if (vizardId) {
      await query("UPDATE videos SET vizard_project_id = $1, status = 'sent_to_vizard' WHERE id = $2", [vizardId, id]);
      return vizardId;
    } else {
      await query("UPDATE videos SET status = 'pending' WHERE id = $1", [id]);
      throw new Error("Failed to send to Vizard AI");
    }
  }

  static async markCompleted(id: string) {
    await query("UPDATE videos SET status = 'completed' WHERE id = $1", [id]);
  }
}
