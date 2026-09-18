import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** iOS counterpart to the Android/web polite live regions used by status text. */
export function useStatusAnnouncement(message: string) {
  useEffect(() => {
    if (Platform.OS === 'ios' && message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
