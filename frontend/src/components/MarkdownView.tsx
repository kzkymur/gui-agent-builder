import React from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url: string): string | null {
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

function toHtml(md: string): string {
  let src = md.replace(/\r\n?/g, "\n");
  // Escape first
  src = escapeHtml(src);

  // Code fences ```
  src = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre class="mono">${code}</pre>`;
  });

  // Headings #, ##, ### at line start
  src = src.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  src = src.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  src = src.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold **text** and italic *text*
  src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  src = src.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code `code`
  src = src.replace(/`([^`]+)`/g, '<code class="mono">$1</code>');

  // Links [text](url)
  src = src.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (_m, text, url) => {
    const safe = sanitizeUrl(url);
    const t = text as string;
    return safe ? `<a href="${safe}" target="_blank" rel="noreferrer noopener">${t}</a>` : t;
  });

  // Unordered lists - item
  src = src.replace(/(?:^|\n)-(\s+.+)(?=(\n[^-]|$))/g, (m) => {
    const items = m
      .trim()
      .split(/\n-\s+/)
      .map((it) => it.replace(/^-/,'').trim())
      .filter(Boolean)
      .map((li) => `<li>${li}</li>`) 
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Paragraphs: split by two newlines
  src = src
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<h\d|^<ul>|^<pre>/.test(block)) return block; 
      const withBr = block.replace(/\n/g, '<br/>');
      return `<p>${withBr}</p>`;
    })
    .join('');

  return src;
}

export default function MarkdownView({ text }: { text: string }) {
  const html = React.useMemo(() => toHtml(text || ""), [text]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

