export const escapeHtml = (value: string): string => {
  let escaped = value;
  escaped = escaped.split('&').join('&amp;');
  escaped = escaped.split('<').join('&lt;');
  escaped = escaped.split('>').join('&gt;');
  escaped = escaped.split('"').join('&quot;');
  escaped = escaped.split("'").join('&#39;');
  return escaped;
};

const renderInline = (value: string): string => {
  const parts = value.split(/(`[^`]+`)/g);

  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return `<code class="md-inline-code">${escapeHtml(part.slice(1, -1))}</code>`;
      }

      const escaped = escapeHtml(part);
      return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
};

const renderParagraph = (lines: string[]): string =>
  `<p class="md-paragraph">${renderInline(lines.join(' '))}</p>`;

const renderList = (
  items: string[],
  ordered: boolean,
): string => {
  const tag = ordered ? 'ol' : 'ul';
  const className = ordered ? 'md-list md-list-ordered' : 'md-list md-list-unordered';
  const renderedItems = items
    .map((item) => `<li class="md-list-item">${renderInline(item)}</li>`)
    .join('');

  return `<${tag} class="${className}">${renderedItems}</${tag}>`;
};

export const renderMarkdown = (content: string): string => {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p class="md-paragraph"></p>';
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !(lines[index] ?? '').trimStart().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(
        `<pre class="md-code-block"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(`<h3 class="md-heading md-heading-3">${renderInline(line.slice(4).trim())}</h3>`);
      index += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(`<h2 class="md-heading md-heading-2">${renderInline(line.slice(3).trim())}</h2>`);
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteLine = (lines[index] ?? '').trimEnd();
        if (!quoteLine.trimStart().startsWith('>')) {
          break;
        }

        quoteLines.push(quoteLine.trimStart().replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push(
        `<blockquote class="md-blockquote">${renderParagraph(quoteLines)}</blockquote>`,
      );
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const currentLine = (lines[index] ?? '').trimEnd();
        const nextUnordered = currentLine.match(/^[-*+]\s+(.*)$/);
        const nextOrdered = currentLine.match(/^\d+\.\s+(.*)$/);
        const nextMatch = ordered ? nextOrdered : nextUnordered;
        if (!nextMatch) {
          break;
        }

        items.push(nextMatch[1] ?? '');
        index += 1;
      }

      blocks.push(renderList(items, ordered));
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = (lines[index] ?? '').trimEnd();
      const trimmed = paragraphLine.trim();
      if (!trimmed) {
        break;
      }

      if (
        trimmed.startsWith('```')
        || trimmed.startsWith('## ')
        || trimmed.startsWith('### ')
        || trimmed.startsWith('>')
        || /^[-*+]\s+/.test(trimmed)
        || /^\d+\.\s+/.test(trimmed)
      ) {
        break;
      }

      paragraphLines.push(trimmed);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(renderParagraph(paragraphLines));
      continue;
    }

    index += 1;
  }

  return blocks.join('');
};

export const renderPlainText = (content: string): string =>
  `<p class="message-content-text">${escapeHtml(content)}</p>`;
