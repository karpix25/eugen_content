import { query } from '../lib/db';
import { getTranscript, getLatestVideos, getChannelInfo } from './apify';
import { evaluateContent } from './gemini';
import { sendToVizard } from './vizard';

export class VideoManager {
  static async getAllVideos(userId?: string, isAdmin?: boolean) {
    const result = await query(`
      SELECT v.* 
      FROM videos v 
      LEFT JOIN channels ch ON v.channel_id = ch.id 
      WHERE ($2 = true) 
         OR (v.is_public = true) 
         OR (ch.is_public = true) 
         OR (ch.user_id = $1)
         OR (v.user_id = $1)
      ORDER BY v.published_at DESC
    `, [userId, isAdmin || false]);
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

  static async approveVideo(id: string, userId: string, targetLanguage?: string) {
    await query("UPDATE videos SET status = 'approved', target_language = $2, approved_by = $3 WHERE id = $1", [id, targetLanguage || null, userId]);
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const settingsRes = await query("SELECT key, value FROM global_settings WHERE key IN ('vizard_prefer_length', 'vizard_remove_silence', 'vizard_auto_broll')");
    const settings = settingsRes.rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});

    const vizardId = await sendToVizard(videoUrl, id, {
      preferLength: [Number(settings.vizard_prefer_length || 2)],
      removeSilenceSwitch: Number(settings.vizard_remove_silence || 0),
      autoBrollSwitch: Number(settings.vizard_auto_broll || 0)
    });
    
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

  static async togglePublic(id: string, isPublic: boolean) {
    await query("UPDATE videos SET is_public = $1 WHERE id = $2", [isPublic, id]);
  }

  static async addManualVideo(url: string, userId: string) {
    // Detect if it's a channel URL (contains @, /channel/, /c/, or /user/)
    const isChannel = url.includes('/@') || url.includes('/channel/') || url.includes('/c/') || url.includes('/user/');
    
    if (isChannel) {
      return await this.addManualChannel(url);
    }

    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    const videoId = match ? match[1] : null;

    if (!videoId) throw new Error("Invalid YouTube URL. Please provide a video or channel link.");

    const existing = await query("SELECT id FROM videos WHERE id = $1", [videoId]);
    if (existing.rows.length > 0) return { id: videoId, status: 'exists' };
    
    // Initial insert with minimal data
    await query(`
      INSERT INTO videos (id, title, status, published_at, user_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [videoId, 'Manual Upload', 'pending', new Date().toISOString(), userId]);

    // Process in background to get title and transcript
    this.processVideoBackground(videoId, { id: videoId, title: 'Manual Upload' });

    return { id: videoId, status: 'added' };
  }

  static async addManualChannel(url: string) {
    console.log(`Adding manual channel from URL: ${url}`);
    const info = await getChannelInfo(url);
    if (!info) throw new Error("Could not find YouTube channel. Check the URL.");

    await query(`
      INSERT INTO channels (id, name, handle)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        handle = EXCLUDED.handle
    `, [info.id, info.name, info.handle || null]);

    // Fast-track monitoring for this channel
    this.monitorChannels().catch(console.error);

    return { id: info.id, name: info.name, status: 'channel_added' };
  }

  static async deleteVideo(id: string) {
    // Delete from videos table. 
    // Dependent data (clips, publications, carousels) will be deleted via ON DELETE CASCADE in DB.
    await query("DELETE FROM videos WHERE id = $1", [id]);
  }
}
