"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/components/ui";

interface Props extends React.HTMLAttributes<HTMLPreElement> {
  // react-markdown passes a `node` prop from the AST; we ignore it
  node?: unknown;
}

export function CopyCodeWrapper({
  children,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  node: _,
  ...props
}: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState<string | null>(null);

  useEffect(() => {
    const code = preRef.current?.querySelector("code");
    const match = code?.className.match(/language-(\w+)/);
    setLang(match ? match[1] : null);
  }, []);

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-5">
      {lang && (
        <span className="pointer-events-none absolute left-4 top-2.5 select-none font-mono text-[11px] font-semibold uppercase tracking-widest text-text-secondary/50">
          {lang}
        </span>
      )}
      <button
        onClick={handleCopy}
        aria-label="复制代码"
        className={cn(
          "absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition group-hover:opacity-100",
          "text-text-secondary/60 hover:bg-elevated hover:text-text-primary",
        )}
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <pre
        ref={preRef}
        className={cn(lang ? "pt-8" : undefined, className)}
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}
