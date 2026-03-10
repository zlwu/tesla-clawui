import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '../render-markdown.js';

describe('renderMarkdown', () => {
  it('renders headings, lists, blockquotes, and code blocks', () => {
    const html = renderMarkdown(`## 标题

- 第一项
- 第二项

> 引用内容

\`\`\`
const answer = 42;
\`\`\`
`);

    expect(html).toContain('md-heading-2');
    expect(html).toContain('md-list-item');
    expect(html).toContain('md-blockquote');
    expect(html).toContain('md-code-block');
    expect(html).toContain('const answer = 42;');
  });

  it('renders inline bold and inline code safely', () => {
    const html = renderMarkdown('这是 **重点**，这里有 `code()`，还有 <script>alert(1)</script>');

    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<code class="md-inline-code">code()</code>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
