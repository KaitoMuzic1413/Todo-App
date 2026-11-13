export const keepTextareaContentVisible = (textarea) => {
  const currentHeight = textarea.getBoundingClientRect().height;
  const computedMaxHeight = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);
  const maxHeight = Number.isFinite(computedMaxHeight) ? computedMaxHeight : Number.POSITIVE_INFINITY;

  textarea.style.minHeight = '0px';
  textarea.style.height = 'auto';
  const contentHeight = textarea.scrollHeight;
  const targetHeight = Math.min(contentHeight, maxHeight);

  textarea.style.minHeight = `${targetHeight}px`;
  textarea.style.height = `${Math.max(Math.min(currentHeight, maxHeight), targetHeight)}px`;
};
