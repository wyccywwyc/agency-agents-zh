import { marked } from 'marked';
import hljs from 'highlight.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// marked v14：renderer.code 接收 token 对象 { text, lang }
marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code(token) {
      const text = typeof token === 'string' ? token : token.text;
      const lang = typeof token === 'string' ? arguments[1] : token.lang;
      const hasLang = lang && hljs.getLanguage(lang);
      const highlighted = hasLang
        ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(text).value;
      const label = hasLang ? lang : 'text';
      return (
        '<div class="code-block">' +
        `<div class="code-block-bar"><span>${escapeHtml(label)}</span></div>` +
        `<pre><code class="hljs${hasLang ? ` language-${escapeHtml(lang)}` : ''}">${highlighted}</code></pre>` +
        '</div>'
      );
    }
  }
});

export function renderMarkdown(md) {
  return marked.parse(md || '');
}

export { escapeHtml };
