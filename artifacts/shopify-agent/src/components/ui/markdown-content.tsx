import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const sanitizedContent = useMemo(() => DOMPurify.sanitize(content), [content]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {sanitizedContent}
    </ReactMarkdown>
  );
}
