import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Shield, AlertTriangle, Wrench, Code, Info } from 'lucide-react';

interface AIResponseMarkdownProps {
  content: string;
}

export const AIResponseMarkdown: React.FC<AIResponseMarkdownProps> = ({ content }) => {
  // Section icons mapping
  const getSectionIcon = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('security risk') || lowerText.includes('vulnerability')) {
      return <AlertTriangle className="h-4 w-4 text-red-300" />;
    }
    if (lowerText.includes('recommended fix') || lowerText.includes('solution')) {
      return <Wrench className="h-4 w-4 text-emerald-300" />;
    }
    if (lowerText.includes('code changes') || lowerText.includes('implementation')) {
      return <Code className="h-4 w-4 text-orange-300" />;
    }
    if (lowerText.includes('additional') || lowerText.includes('notes')) {
      return <Info className="h-4 w-4 text-zinc-300" />;
    }
    return <Shield className="h-4 w-4 text-zinc-300" />;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom heading styles with icons
        h1: ({ children }) => (
          <div className="mt-6 mb-4 flex items-center gap-2 border-b border-zinc-700 pb-3">
            {getSectionIcon(String(children))}
            <h1 className="text-xl font-bold text-zinc-100">{children}</h1>
          </div>
        ),
        h2: ({ children }) => (
          <div className="mt-5 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
            {getSectionIcon(String(children))}
            <h2 className="text-lg font-bold text-zinc-100">{children}</h2>
          </div>
        ),
        h3: ({ children }) => (
          <div className="mt-4 mb-2 flex items-center gap-2">
            {getSectionIcon(String(children))}
            <h3 className="text-base font-semibold text-zinc-200">{children}</h3>
          </div>
        ),
        h4: ({ children }) => (
          <h4 className="mt-3 mb-2 text-sm font-semibold text-zinc-200">{children}</h4>
        ),

        // Styled paragraphs
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-relaxed text-zinc-300">{children}</p>
        ),

        // Enhanced code blocks with syntax highlighting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code(props: any) {
          const { className, children, node } = props;
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          // Check if this is an inline code element
          // Inline code doesn't have a language class and is not inside a <pre> tag
          const isInline = !className && node?.position?.start?.line === node?.position?.end?.line && !String(children).includes('\n');

          if (isInline) {
            return (
              <code className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-orange-200">
                {children}
              </code>
            );
          }

          // Block code - render with syntax highlighting
          return (
            <div className="my-4 overflow-hidden rounded-md border border-zinc-800">
              {/* Code block header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"></span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500"></span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  {language && (
                    <span className="ml-2 font-mono text-xs font-medium uppercase text-zinc-500">
                      {language}
                    </span>
                  )}
                </div>
              </div>

              {/* Syntax highlighted code */}
              <SyntaxHighlighter
                style={oneDark}
                language={language || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  background: '#282c34',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          );
        },

        // Override pre to prevent nesting issues - let code handle the rendering
        pre: ({ children }) => <>{children}</>,

        // Styled lists
        ul: ({ children }) => (
          <ul className="mb-3 ml-2 list-inside list-disc space-y-1.5 text-sm text-zinc-300">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-2 list-inside list-decimal space-y-1.5 text-sm text-zinc-300">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),

        // Styled blockquotes
        blockquote: ({ children }) => (
          <blockquote className="my-3 rounded-md border-l-2 border-orange-500 bg-zinc-900/70 px-4 py-2 text-sm italic text-zinc-300">
            {children}
          </blockquote>
        ),

        // Styled tables
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-md border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-zinc-900">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">{children}</tbody>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-zinc-300">{children}</td>
        ),

        // Styled links
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-orange-300 underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-orange-200 hover:decoration-orange-400"
          >
            {children}
          </a>
        ),

        // Styled horizontal rules
        hr: () => (
          <hr className="my-6 border-t border-zinc-800" />
        ),

        // Strong/bold text
        strong: ({ children }) => (
          <strong className="font-bold text-zinc-100">{children}</strong>
        ),

        // Emphasis/italic text
        em: ({ children }) => (
          <em className="italic text-zinc-300">{children}</em>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
