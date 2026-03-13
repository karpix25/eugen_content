import { query } from '../lib/db.js';

export class UserManager {
  static async getAllUsers() {
    const result = await query(`
      SELECT
        u.*,
        COUNT(p.id)::int as publication_count,
        COALESCE(
          (SELECT array_agg(link) FROM (SELECT unnest(social_links) as link FROM publications WHERE user_id = u.telegram_id) as links),
          '{}'
        ) as published_links
      FROM users u
      LEFT JOIN publications p ON u.telegram_id = p.user_id
      GROUP BY u.telegram_id
      ORDER BY u.created_at DESC
    `);
    return result.rows;
  }

  static async updateSettings(telegramId: string, username: string, firstName: string, settings: any) {
    const keys = Object.keys(settings);
    const columns = [
      'telegram_id', 'username', 'first_name',
      ...keys
    ];
    
    // Build values array and placeholder string
    const values = [telegramId, username || '', firstName || '', ...keys.map(k => settings[k])];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    // Build update clause for conflict
    const updateClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');

    const sql = `
      INSERT INTO users (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (telegram_id) DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        ${updateClause}
    `;

    return query(sql, values);
  }

  static async setAuthorization(telegramId: string, isAuthorized: boolean) {
    return query("UPDATE users SET is_authorized = $1 WHERE telegram_id = $2", [isAuthorized, telegramId]);
  }

  static async updateWatermarkUrl(telegramId: string, imageUrl: string) {
    return query("UPDATE users SET watermark_text = $1 WHERE telegram_id = $2", [imageUrl, telegramId]);
  }
}
