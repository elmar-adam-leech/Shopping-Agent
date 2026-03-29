import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { memo, useMemo } from 'react';

interface MarkdownContentProps {
  content: string;
}

const remarkPlugins = [remarkGfm];

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  const sanitizedContent = useMemo(() => DOMPurify.sanitize(content), [content]);

  return (
    <ReactMarkdown remarkPlugins={remarkPlugins}>
      {sanitizedContent}
    </ReactMarkdown>
  );
});
