const startsWith = (buffer, bytes) => buffer.length >= bytes.length
  && bytes.every((byte, index) => buffer[index] === byte);

const ascii = (buffer, start, end) => buffer.subarray(start, end).toString('latin1');

const isTextBuffer = (buffer) => {
  const text = buffer.toString('utf8');
  return !text.includes('\u0000');
};

const isMp4Container = (buffer) => ascii(buffer, 4, 8) === 'ftyp';

const SIGNATURE_CHECKS = {
  'application/pdf': (buffer) => ascii(buffer, 0, 5) === '%PDF-',
  'application/rtf': (buffer) => ascii(buffer, 0, 5) === '{\\rtf',
  'text/rtf': (buffer) => ascii(buffer, 0, 5) === '{\\rtf',
  'application/msword': (buffer) => startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  'application/vnd.ms-excel': (buffer) => startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  'application/vnd.ms-powerpoint': (buffer) => startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.oasis.opendocument.text': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.oasis.opendocument.spreadsheet': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.oasis.opendocument.presentation': (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  'image/jpeg': (buffer) => startsWith(buffer, [0xff, 0xd8, 0xff]),
  'image/png': (buffer) => startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (buffer) => ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a',
  'image/webp': (buffer) => ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP',
  'image/bmp': (buffer) => ascii(buffer, 0, 2) === 'BM',
  'image/avif': (buffer) => ascii(buffer, 4, 8) === 'ftyp' && /avif|avis/.test(ascii(buffer, 8, 12)),
  'image/heic': (buffer) => ascii(buffer, 4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(ascii(buffer, 8, 12)),
  'image/heif': (buffer) => ascii(buffer, 4, 8) === 'ftyp' && /mif1|msf1/.test(ascii(buffer, 8, 12)),
  'audio/mpeg': (buffer) => ascii(buffer, 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0),
  'audio/mp3': (buffer) => ascii(buffer, 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0),
  'audio/wav': (buffer) => ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WAVE',
  'audio/x-wav': (buffer) => ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WAVE',
  'audio/ogg': (buffer) => ascii(buffer, 0, 4) === 'OggS',
  'audio/opus': (buffer) => ascii(buffer, 0, 4) === 'OggS',
  'audio/aac': (buffer) => (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) || isMp4Container(buffer),
  'audio/mp4': (buffer) => isMp4Container(buffer),
  'audio/flac': (buffer) => ascii(buffer, 0, 4) === 'fLaC',
  'audio/x-flac': (buffer) => ascii(buffer, 0, 4) === 'fLaC',
  'audio/x-ms-wma': (buffer) => startsWith(buffer, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]),
  'audio/midi': (buffer) => ascii(buffer, 0, 4) === 'MThd',
  'audio/x-midi': (buffer) => ascii(buffer, 0, 4) === 'MThd',
  'text/plain': isTextBuffer,
  'text/markdown': isTextBuffer,
  'text/x-markdown': isTextBuffer,
  'text/csv': isTextBuffer,
  'application/json': (buffer) => {
    if (!isTextBuffer(buffer)) return false;
    try {
      JSON.parse(buffer.toString('utf8'));
      return true;
    } catch {
      return false;
    }
  },
  'application/xml': isTextBuffer,
  'text/xml': isTextBuffer,
};

const HTML_PREFIX = /^\s*<(?:!doctype\s+html|html|head|body|script|iframe|object|embed|svg)\b/i;

export const validateFileSignature = ({ buffer, mimeType }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, message: 'The uploaded file is empty.' };
  }

  const check = SIGNATURE_CHECKS[mimeType];
  if (!check) {
    return { valid: false, message: 'This file type is not supported.' };
  }

  if (!check(buffer)) {
    return { valid: false, message: 'The file content does not match its declared type.' };
  }

  if (mimeType.startsWith('text/') && HTML_PREFIX.test(buffer.toString('utf8', 0, Math.min(buffer.length, 512)))) {
    return { valid: false, message: 'HTML content is not allowed in text uploads.' };
  }

  return { valid: true };
};
