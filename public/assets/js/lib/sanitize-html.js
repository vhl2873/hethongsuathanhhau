// Minimal allow-list sanitiser for rich text written in the admin (blog post
// bodies). Posts are stored as HTML, so escaping them shows literal <p> tags
// to the reader - but pasting them into innerHTML unchecked would make any
// compromised admin account a stored-XSS vector. This parses the markup and
// rebuilds it from a fixed set of tags and attributes, dropping everything
// else (script/style/iframe, event handlers, javascript: URLs).
const ALLOWED = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  h2: [],
  h3: [],
  h4: [],
  ul: [],
  ol: [],
  li: [],
  blockquote: [],
  figure: [],
  figcaption: [],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
  a: ['href', 'title'],
  img: ['src', 'alt'],
};

const SAFE_URL = /^(https?:|mailto:|tel:|\/|\.\/|#)/i;

function cleanNode(node, out, doc) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.append(doc.createTextNode(child.nodeValue));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName.toLowerCase();
    const allowedAttrs = ALLOWED[tag];

    // Unknown tag: keep its text content, drop the tag itself. That way a
    // <div> wrapper doesn't silently delete a paragraph of copy.
    if (!allowedAttrs) {
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') continue;
      cleanNode(child, out, doc);
      continue;
    }

    const el = doc.createElement(tag);
    for (const attr of allowedAttrs) {
      const value = child.getAttribute(attr);
      if (value === null) continue;
      if ((attr === 'href' || attr === 'src') && !SAFE_URL.test(value.trim())) continue;
      el.setAttribute(attr, value);
    }
    if (tag === 'a') {
      el.setAttribute('rel', 'noopener');
    }
    cleanNode(child, el, doc);
    out.append(el);
  }
}

export function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  const target = document.createElement('div');
  cleanNode(parsed.body, target, document);
  return target.innerHTML;
}
