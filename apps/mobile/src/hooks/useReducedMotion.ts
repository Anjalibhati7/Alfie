import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Default to reduced motion until the platform preference is known. */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        receivedChange = true;
        setReducedMotion(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !receivedChange) setReducedMotion(value);
      })
      .catch(() => {
        /* Keep the conservative default if platform lookup fails. */
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reducedMotion;
}
