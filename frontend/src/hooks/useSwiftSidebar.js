import { useEffect, useRef, useState } from 'react';

const SIDEBAR_WIDTH = 320; // Độ rộng Sidebar (px)
const EDGE_WIDTH = 35;      // Vùng rìa cảm ứng (px)

export function useSwiftSidebar(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [sidebarOffset, setSidebarOffset] = useState(initialOpen ? 0 : -SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartX = useRef(0);
  const startOffset = useRef(-SIDEBAR_WIDTH);
  const isEligibleSwipe = useRef(false);

  useEffect(() => {
    const handleTouchStart = (event) => {
      const touchX = event.touches[0].clientX;

      if ((!isOpen && touchX <= EDGE_WIDTH) || isOpen) {
        isEligibleSwipe.current = true;
        touchStartX.current = touchX;
        startOffset.current = isOpen ? 0 : -SIDEBAR_WIDTH;
      } else {
        isEligibleSwipe.current = false;
      }
    };

    const handleTouchMove = (event) => {
      if (!isEligibleSwipe.current) return;

      const currentX = event.touches[0].clientX;
      const deltaX = currentX - touchStartX.current;

      let nextOffset = startOffset.current + deltaX;

      if (nextOffset > 0) nextOffset = 0;
      if (nextOffset < -SIDEBAR_WIDTH) nextOffset = -SIDEBAR_WIDTH;

      setIsDragging(true);
      setSidebarOffset(nextOffset);
    };

    const handleTouchEnd = () => {
      if (!isEligibleSwipe.current) return;

      setIsDragging(false);
      isEligibleSwipe.current = false;

      const threshold = -SIDEBAR_WIDTH * 0.7;

      if (sidebarOffset > threshold) {
        setIsOpen(true);
        setSidebarOffset(0);
      } else {
        setIsOpen(false);
        setSidebarOffset(-SIDEBAR_WIDTH);
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, sidebarOffset]);

  useEffect(() => {
    if (!isDragging) {
      const frame = window.requestAnimationFrame(() => {
        setSidebarOffset(isOpen ? 0 : -SIDEBAR_WIDTH);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [isOpen, isDragging]);

  const backdropOpacity = Math.max(0, (SIDEBAR_WIDTH + sidebarOffset) / SIDEBAR_WIDTH);

  return {
    isOpen,
    setIsOpen,
    sidebarOffset,
    isDragging,
    backdropOpacity,
  };
}