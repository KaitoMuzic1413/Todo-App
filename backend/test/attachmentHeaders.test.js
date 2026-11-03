import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttachmentContentDisposition, sanitizeDownloadFilename } from '../src/utils/attachmentHeaders.js';

test('only safe preview MIME types may be served inline', () => {
  assert.match(getAttachmentContentDisposition('image/png', 'photo.png', true), /^inline;/);
  assert.match(getAttachmentContentDisposition('application/pdf', 'document.pdf', true), /^inline;/);
  assert.match(getAttachmentContentDisposition('application/xml', 'vector.xml', true), /^attachment;/);
  assert.match(getAttachmentContentDisposition('text/markdown', 'note.md', true), /^attachment;/);
  assert.match(getAttachmentContentDisposition('image/svg+xml', 'vector.svg', true), /^attachment;/);
});

test('sanitizes path separators and header control characters in filenames', () => {
  const filename = sanitizeDownloadFilename('..\\secret\r\nX-Injected: yes".pdf');
  assert.equal(filename.includes('\r'), false);
  assert.equal(filename.includes('\n'), false);
  assert.equal(filename.includes('\\'), false);
  assert.equal(filename.includes('/'), false);
  assert.equal(filename.includes('"'), false);
});

test('includes a UTF-8 encoded filename parameter', () => {
  const header = getAttachmentContentDisposition('application/pdf', 'tài liệu.pdf', false);
  assert.match(header, /^attachment;/);
  assert.match(header, /filename\*=UTF-8''/);
  assert.match(header, /%C3%A0/);
});
