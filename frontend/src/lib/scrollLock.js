let lockCount = 0;
let savedStyles = null;

const captureStyles = () => {
  const html = document.documentElement;
  const body = document.body;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

  return {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    scrollbarWidth,
    bodyPaddingRightValue: bodyPaddingRight,
  };
};

const applyLock = () => {
  savedStyles = captureStyles();
  const { scrollbarWidth, bodyPaddingRightValue } = savedStyles;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${bodyPaddingRightValue + scrollbarWidth}px`;
  }
};

const releaseLock = () => {
  if (!savedStyles) return;

  document.documentElement.style.overflow = savedStyles.htmlOverflow;
  document.body.style.overflow = savedStyles.bodyOverflow;
  document.body.style.paddingRight = savedStyles.bodyPaddingRight;
  document.body.style.overscrollBehavior = savedStyles.bodyOverscrollBehavior;
  savedStyles = null;
};

export const lockPageScroll = () => {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) applyLock();
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
};
