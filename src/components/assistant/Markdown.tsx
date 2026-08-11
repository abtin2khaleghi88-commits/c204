import { Check, Copy } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/** Kod bloklari icin kopyalama dugmeli sarmalayici. */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = (event: React.MouseEvent<HTMLButtonElement>) => {
    const pre = event.currentTarget.parentElement?.querySelector("code");
    void navigator.clipboard.writeText(pre?.textContent ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="group/code relative">
      <button
        type="button"
        onClick={copy}
        className="hud-text absolute top-2 right-2 rounded-md border border-border/70 bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition group-hover/code:opacity-100 hover:text-primary"
        aria-label="copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-border/70 bg-secondary/40 p-4 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
