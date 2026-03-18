import { useMemo } from 'react';
import { User } from '../types';

export function useProfileSetup(user: User | null) {
  const setupStatus = useMemo(() => {
    if (!user) return { isComplete: false, percent: 0, missing: [] };

    const items = [
      { key: 'watermark_text', label: 'Водяной знак', value: user.watermark_text },
      { key: 'subtitle_style', label: 'Стиль субтитров', value: user.subtitle_style },
      { key: 'default_plaque_id', label: 'Плашка по умолчанию', value: user.default_plaque_id },
    ];

    const completedItems = items.filter(item => !!item.value);
    const percent = Math.round((completedItems.length / items.length) * 100);
    
    // We consider it complete if mandatory onboarding fields are present
    const isComplete = user.watermark_text && user.subtitle_style && user.default_plaque_id;

    return {
      isComplete: !!isComplete,
      percent,
      missing: items.filter(item => !item.value).map(item => item.label)
    };
  }, [user]);

  return setupStatus;
}
