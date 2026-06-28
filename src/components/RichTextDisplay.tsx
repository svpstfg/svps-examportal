import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextDisplayProps {
  content: string;
  className?: string;
  as?: 'p' | 'span' | 'div' | 'h3';
}

/**
 * Renders text content that may contain HTML formatting (from pasted rich text).
 * Falls back to plain text rendering if content doesn't contain HTML tags.
 */
export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ 
  content, 
  className,
  as: Tag = 'span' 
}) => {
  if (!content) return null;

  // Check if the content contains HTML tags
  const hasHTML = /<[a-z][\s\S]*>/i.test(content);

  if (hasHTML) {
    return (
      <Tag
        className={cn('rich-text-content', className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Plain text - preserve line breaks
  if (content.includes('\n')) {
    return (
      <Tag className={className}>
        {content.split('\n').map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  return <Tag className={className}>{content}</Tag>;
};
