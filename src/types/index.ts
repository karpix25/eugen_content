export interface Channel {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: number;
  monitoring_interval?: string;
  scrape_days?: number;
  next_check?: string;
  user_id?: string;
  is_public?: boolean;
  sync_status?: 'idle' | 'syncing' | 'error';
  sync_error?: string;
}

export interface VideoData {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  published_at: string;
  thumbnail: string;
  ai_score: number | null;
  ai_evaluation: string | null;
  detected_language: string | null;
  target_language: string | null;
  status: 'pending' | 'evaluating' | 'approved' | 'rejected' | 'sent_to_vizard' | 'completed';
  is_public?: boolean;
  user_evaluation_status?: 'evaluating' | null;
}

export interface Clip {
  id: string;
  video_id: string;
  url: string;
  thumbnail: string;
  title: string;
  status: 'raw' | 'processed';
  ad_plaque_id: string | null;
  is_available: boolean;
  is_public?: boolean;
  downloaded_by?: string;
  downloaded_at?: string;
  transcript: string;
  language: string | null;
  published_by_me?: boolean;
  hook?: string;
  created_at?: string;
  video_is_public?: boolean;
}

export interface Publication {
  id: string;
  clip_id: string;
  user_id: string;
  username?: string;
  first_name?: string;
  clip_title?: string;
  clip_thumbnail?: string;
  social_links: string[];
  status: 'sent' | 'published';
  created_at: string;
}

export interface User {
  telegram_id: string;
  username: string;
  first_name: string;
  is_authorized: boolean;
  is_admin: boolean;
  role: 'admin' | 'worker';
  created_at: string;
  publication_count?: number;
  published_links?: string[];
  watermark_text?: string;
  watermark_opacity?: number;
  watermark_position?: string;
  subtitle_enabled?: boolean;
  subtitle_font_size?: number;
  subtitle_font_color?: string;
  subtitle_position?: string;
  subtitle_style?: string;
  subtitle_font_family?: string;
  subtitle_highlight_color?: string;
  subtitle_highlight_enabled?: boolean;
  subtitle_outline_color?: string;
  default_plaque_id?: string | null;
  plaque_position?: string;
  plaque_size?: number;
  plaque_timerange?: number;
  auto_mode_enabled?: boolean;
  auto_mode_videos_per_day?: number;
  face_image_url?: string;
  use_face_in_carousels?: boolean;
}

export interface AdPlaque {
  id: string;
  name: string;
  image_url: string;
}
