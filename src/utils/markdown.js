export const renderMarkdown = (source = '') => {
  const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let html = escape(String(source));
  html = html.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre class="code-block"><span class="code-lang">${lang || 'text'}</span><code>${code.trim()}</code><button data-copy-code="${encodeURIComponent(code.trim())}">复制代码</button></pre>`);
  html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return html.split(/\n{2,}/).map(part => /^<(h[234]|ul|pre)/.test(part) ? part : `<p>${part.replace(/\n/g, '<br/>')}</p>`).join('');
};
