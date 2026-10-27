const ALLOWED_TAGS = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE']);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;
const ESCAPED_HTML_TAG_PATTERN = /&lt;\/?[a-z][^&]*&gt;/i;

export const hasNotificationHtml = (value = '') =>
  typeof value === 'string' && (HTML_TAG_PATTERN.test(value) || ESCAPED_HTML_TAG_PATTERN.test(value));

export const sanitizeNotificationHtml = (value = '') => {
  if (typeof value !== 'string' || typeof window === 'undefined' || !hasNotificationHtml(value)) {
    return String(value ?? '');
  }

  const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');
  let source = value;
  let parsed = parseHtml(source);

  // Decode HTML-escaped markup from API/storage layers, up to two layers.
  // Every decoded result is still sanitized through the strict tag/URL allowlist below.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const bodyText = parsed.body.textContent || '';
    if (parsed.body.children.length !== 0 || !HTML_TAG_PATTERN.test(bodyText)) break;
    source = bodyText;
    parsed = parseHtml(source);
  }

  const cleanNode = (node) => {
    const fragment = document.createDocumentFragment();
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        fragment.appendChild(document.createTextNode(child.textContent || ''));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) {
        fragment.appendChild(cleanNode(child));
        continue;
      }

      const clean = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const rawHref = child.getAttribute('href') || '';
        try {
          const url = new URL(rawHref, window.location.origin);
          if (ALLOWED_PROTOCOLS.has(url.protocol)) {
            clean.setAttribute('href', url.href);
            clean.setAttribute('target', '_self');
            clean.setAttribute('rel', 'nofollow');
            clean.style.color = '#7c3aed';
            clean.style.textDecoration = 'underline';
            clean.style.textUnderlineOffset = '3px';
          }
        } catch {
          // Invalid links remain non-clickable text.
        }
      }
      clean.appendChild(cleanNode(child));
      fragment.appendChild(clean);
    }
    return fragment;
  };

  const container = document.createElement('div');
  container.appendChild(cleanNode(parsed.body));
  return container.innerHTML;
};
