const extensionType = {
  // Common image formats
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', heic: 'image', heif: 'image', avif: 'image',
  // Common video formats
  mp4: 'video', m4v: 'video', mov: 'video', webm: 'video', mkv: 'video', avi: 'video', wmv: 'video', mpg: 'video', mpeg: 'video', '3gp': 'video',
  // Common audio formats
  mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', opus: 'audio', flac: 'audio', wma: 'audio', mid: 'audio', midi: 'audio',
  // Text and office documents
  txt: 'document', md: 'document', markdown: 'document', rtf: 'document', pdf: 'document', doc: 'document', docx: 'document', odt: 'document',
  xls: 'document', xlsx: 'document', ods: 'document', ppt: 'document', pptx: 'document', odp: 'document', csv: 'document', json: 'document', xml: 'document',
};

export const getAttachmentType = (attachment) => {
  const mime = typeof attachment?.mimeType === 'string' ? attachment.mimeType.toLowerCase() : '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/pdf' || /word|excel|powerpoint|opendocument|rtf|json|xml/.test(mime)) return 'document';

  const name = typeof attachment?.originalName === 'string'
    ? attachment.originalName
    : typeof attachment?.name === 'string' ? attachment.name : '';
  const extension = name.split('.').pop()?.toLowerCase();
  return extensionType[extension] || 'other';
};

export const groupAttachmentsByType = (attachments) => {
  const groups = new Map();
  attachments.forEach((attachment) => {
    const type = getAttachmentType(attachment);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(attachment);
  });
  return [...groups.entries()];
};
