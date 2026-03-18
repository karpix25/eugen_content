import { useMemo } from 'react';
import { User } from '../types';

export function useProfileSetup(user: User | null) {
  const setupStatus = useMemo(() => {
    if (!user) return { isComplete: false, percent: 0, missing: [] };

    const items = [
      { key: 'watermark_text', label: 'Водяной знак', value: user.watermark_text },
      { key: 'subtitle_font_family', label: 'Шрифт субтитров', value: user.subtitle_font_family },
      { key: 'face_image_url', label: 'Брендинг (Фото)', value: user.face_image_url },
    ];

    const completedItems = items.filter(item => !!item.value);
    const percent = Math.round((completedItems.length / items.length) * 100);
    
    // We consider it complete if the first two are there (minimum for video generation)
    // or customize this logic as needed.
    const isComplete = user.watermark_text && user.subtitle_font_family;

    return {
      isComplete: !!isComplete,
      percent,
      missing: items.filter(item => !item.value).map(item => item.label)
    };
  }, [user]);

  return setupStatus;
}
