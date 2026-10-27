const ALLOWED_TAGS = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE']);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const hasNotificationHtml = (value = '') => /<\/?[a-z][^>]*>|&lt;\/?[a-z][^&]*&gt;/i.test(value);

export const sanitizeNotificationHtml = (value = '') => {
  if (typeof value !== 'string' || typeof window === 'undefined' || !hasNotificationHtml(value)) {
    return String(value ?? '');
  }

  const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');
  let parsed = parseHtml(value);

  // Some clients/APIs may HTML-escape the content before storing it. Decode one layer
  // only when the whole payload is text, then sanitize it through the same allowlist.
  if (
    parsed.body.children.length === 0 &&
    /<\/?[a-z][^>]*>/i.test(parsed.body.textContent || '')
  ) {
    parsed = parseHtml(parsed.body.textContent || '');
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
            // Navigate in the current tab, including on mobile browsers.
            clean.setAttribute('target', '_self');
            clean.setAttribute('rel', 'nofollow');
            clean.style.color = '#7c3aed';
            clean.style.textDecoration = 'underline';
            clean.style.textUnderlineOffset = '3px';
          }
        } catch {
          // Invalid links are rendered as plain text.
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
