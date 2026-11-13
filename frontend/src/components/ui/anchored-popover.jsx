import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const VIEWPORT_PADDING = 8;

const AnchoredPopover = ({
  open,
  onOpenChange,
  triggerRef,
  align = 'start',
  sideOffset = 6,
  matchTriggerWidth = false,
  className,
  children,
}) => {
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return undefined;

    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      if (matchTriggerWidth) panel.style.width = `${rect.width}px`;
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;

      let left = align === 'end' ? rect.right - panelWidth : rect.left;
      left = Math.min(
        Math.max(VIEWPORT_PADDING, left),
        window.innerWidth - panelWidth - VIEWPORT_PADDING
      );

      let top = rect.bottom + sideOffset;
      if (panelHeight && top + panelHeight > window.innerHeight - VIEWPORT_PADDING) {
        const above = rect.top - sideOffset - panelHeight;
        top = above >= VIEWPORT_PADDING
          ? above
          : Math.max(VIEWPORT_PADDING, window.innerHeight - panelHeight - VIEWPORT_PADDING);
      }

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, align, sideOffset, matchTriggerWidth, triggerRef]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (trigger?.contains(event.target) || panel?.contains(event.target)) return;
      onOpenChange?.(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange?.(false);
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div ref={panelRef} className={cn('fixed z-[70]', className)}>
      {children}
    </div>,
    document.body
  );
};

export default AnchoredPopover;
