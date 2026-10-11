export const keepTextareaContentVisible = (textarea) => {
  const currentHeight = textarea.getBoundingClientRect().height;
  textarea.style.minHeight = '0px';
  textarea.style.height = 'auto';
  const contentHeight = textarea.scrollHeight;
  textarea.style.minHeight = `${contentHeight}px`;
  textarea.style.height = `${Math.max(currentHeight, contentHeight)}px`;
};
