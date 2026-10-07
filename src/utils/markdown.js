// Minimal, dependency-free Markdown renderer.
// All input is HTML-escaped first; only a small, explicit subset of Markdown is
// converted afterwards, so user/model content can never inject raw HTML.
export const escapeMarkdownSource = (source = '') =>
  String(source).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const renderMarkdown = (source = '') => {
  let html = escapeMarkdownSource(source);
  html = html.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.replace(/\n$/, '');
    return `<pre class="code-block"><span class="code-lang">${lang || 'text'}</span><code>${trimmed}</code><button type="button" class="code-copy" data-copy-code="${encodeURIComponent(trimmed)}">复制代码</button></pre>`;
  });
  html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>(?:\n<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return html.split(/\n{2,}/).map(part => (/^<(h[234]|ul|pre)/.test(part.trim()) ? part : `<p>${part.replace(/\n/g, '<br/>')}</p>`)).join('');
};
