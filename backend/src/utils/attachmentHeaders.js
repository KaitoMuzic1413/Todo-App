const INLINE_PREVIEW_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'image/avif', 'image/heic', 'image/heif', 'application/pdf',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac',
  'audio/mp4', 'audio/opus', 'audio/flac', 'audio/x-flac', 'audio/x-ms-wma',
  'audio/midi', 'audio/x-midi',
]);

export const sanitizeDownloadFilename = (originalName) => {
  const safeFilename = String(originalName || 'download')
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .slice(0, 180);
  return safeFilename || 'download';
};

export const getAttachmentContentDisposition = (mimeType, originalName, preview = false) => {
  const disposition = preview && INLINE_PREVIEW_TYPES.has(mimeType) ? 'inline' : 'attachment';
  const safeFilename = sanitizeDownloadFilename(originalName);
  const fallbackFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_');
  const encodedFilename = encodeURIComponent(safeFilename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `${disposition}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`;
};
