import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { CopyCodeWrapper } from "./copy-code-wrapper";

export function MarkdownView({ content }: { content: string }) {
  return (
    <article className="prose-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        components={{ pre: CopyCodeWrapper }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
