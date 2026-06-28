import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { CopyCodeWrapper } from "./copy-code-wrapper";
import { injectMentionLinks, type MentionUser } from "@/lib/mentions";

interface Props {
  content: string;
  /** Username → {id, realName} map for @mention rendering. Pass from server component. */
  mentionMap?: Map<string, MentionUser>;
}

export function MarkdownView({ content, mentionMap }: Props) {
  const processed =
    mentionMap && mentionMap.size > 0
      ? injectMentionLinks(content, mentionMap)
      : content;

  return (
    <article className="prose-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        components={{
          pre: CopyCodeWrapper,
          // Mention links use title="mention" marker set by injectMentionLinks
          a: ({ href, title, children }) => {
            if (title === "mention" && href) {
              return (
                <Link
                  href={href}
                  className="font-semibold text-primary no-underline hover:underline"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </article>
  );
}
