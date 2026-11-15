import { useEffect } from 'react';
import { lockPageScroll } from '@/lib/scrollLock';

export const useScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    return lockPageScroll();
  }, [active]);
};

export default useScrollLock;
