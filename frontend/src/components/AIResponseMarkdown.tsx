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
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    if (lowerText.includes('recommended fix') || lowerText.includes('solution')) {
      return <Wrench className="h-4 w-4 text-green-600" />;
    }
    if (lowerText.includes('code changes') || lowerText.includes('implementation')) {
      return <Code className="h-4 w-4 text-blue-600" />;
    }
    if (lowerText.includes('additional') || lowerText.includes('notes')) {
      return <Info className="h-4 w-4 text-indigo-600" />;
    }
    return <Shield className="h-4 w-4 text-slate-600" />;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom heading styles with icons
        h1: ({ children }) => (
          <div className="flex items-center gap-2 mt-6 mb-4 pb-3 border-b-2 border-blue-200">
            {getSectionIcon(String(children))}
            <h1 className="text-xl font-bold text-slate-900">{children}</h1>
          </div>
        ),
        h2: ({ children }) => (
          <div className="flex items-center gap-2 mt-5 mb-3 pb-2 border-b border-slate-200">
            {getSectionIcon(String(children))}
            <h2 className="text-lg font-bold text-slate-800">{children}</h2>
          </div>
        ),
        h3: ({ children }) => (
          <div className="flex items-center gap-2 mt-4 mb-2">
            {getSectionIcon(String(children))}
            <h3 className="text-base font-semibold text-slate-700">{children}</h3>
          </div>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-slate-700 mt-3 mb-2">{children}</h4>
        ),

        // Styled paragraphs
        p: ({ children }) => (
          <p className="text-sm text-slate-700 leading-relaxed mb-3">{children}</p>
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
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs">
                {children}
              </code>
            );
          }

          // Block code - render with syntax highlighting
          return (
            <div className="my-4 rounded-lg overflow-hidden shadow-md border border-slate-200">
              {/* Code block header */}
              <div className="flex items-center justify-between bg-slate-800 px-4 py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"></span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  </div>
                  {language && (
                    <span className="text-xs font-medium text-slate-400 ml-2 uppercase">
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
          <ul className="list-disc list-inside space-y-1.5 mb-3 text-sm text-slate-700 ml-2">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1.5 mb-3 text-sm text-slate-700 ml-2">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),

        // Styled blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-2 my-3 italic text-sm text-slate-700 rounded-r">
            {children}
          </blockquote>
        ),

        // Styled tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="bg-white divide-y divide-slate-200">{children}</tbody>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-slate-700">{children}</td>
        ),

        // Styled links
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline decoration-blue-300 hover:decoration-blue-500 underline-offset-2 transition-colors font-medium"
          >
            {children}
          </a>
        ),

        // Styled horizontal rules
        hr: () => (
          <hr className="my-6 border-t-2 border-slate-200" />
        ),

        // Strong/bold text
        strong: ({ children }) => (
          <strong className="font-bold text-slate-900">{children}</strong>
        ),

        // Emphasis/italic text
        em: ({ children }) => (
          <em className="italic text-slate-700">{children}</em>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
