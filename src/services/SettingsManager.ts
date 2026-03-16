import { query } from '../lib/db.js';

export class SettingsManager {
  static async getSetting(key: string): Promise<string | null> {
    const result = await query("SELECT value FROM global_settings WHERE key = $1", [key]);
    return result.rows[0]?.value || null;
  }

  static async setSetting(key: string, value: string | null): Promise<void> {
    await query(
      "INSERT INTO global_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
      [key, value]
    );
  }

  static async getCarouselLogo(): Promise<string | null> {
    return this.getSetting('carousel_logo_url');
  }

  static async setCarouselLogo(url: string | null): Promise<void> {
    return this.setSetting('carousel_logo_url', url);
  }

  static async getVizardSettings() {
    const keys = ['vizard_prefer_length', 'vizard_remove_silence', 'vizard_auto_broll'];
    const result = await query("SELECT key, value FROM global_settings WHERE key = ANY($1)", [keys]);
    return result.rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
  }
}
