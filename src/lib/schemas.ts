import { z } from 'zod';

export const UserSettingsSchema = z.object({
  watermark_text: z.string().max(100).optional(),
  watermark_opacity: z.number().min(0).max(1).optional(),
  watermark_position: z.enum(['center', 'top_left', 'top_right', 'bottom_left', 'bottom_right', 'tilted_center']).optional(),
  subtitle_enabled: z.boolean().optional(),
  subtitle_font_size: z.number().min(8).max(120).optional(),
  subtitle_font_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  subtitle_position: z.string().optional(),
  subtitle_style: z.string().optional(),
  subtitle_font_family: z.string().optional(),
  subtitle_highlight_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  subtitle_highlight_enabled: z.boolean().optional(),
  subtitle_outline_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  default_plaque_id: z.string().uuid().nullable().optional(),
  plaque_position: z.enum(['top', 'center', 'bottom']).optional(),
  plaque_size: z.number().min(10).max(100).optional(),
  plaque_timerange: z.number().min(0).optional(),
  auto_mode_enabled: z.boolean().optional(),
  auto_mode_videos_per_day: z.number().min(1).max(100).optional(),
  use_face_in_carousels: z.boolean().optional(),
});

export const VideoStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  output_url: z.string().url().optional(),
  error_message: z.string().optional(),
});
