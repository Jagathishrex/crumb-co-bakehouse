import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "cn"

// Markdown shown as formatted text (react-markdown + GitHub's tables, task lists and strikethrough), styled with the
// theme: for help pages, release notes, terms and AI answers.

function Markdown({
  content,
  size = "base",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  content: string
  size?: "sm" | "base" | "lg"
}) {
  return (
    <div
      data-slot="markdown"
      className={cn(
        "max-w-prose leading-relaxed text-foreground",
        size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
        "[&_h1]:mb-3 [&_h1]:text-[1.8em] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[1.4em] [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold",
        "[&_p]:my-3 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_hr]:my-6",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_input]:mr-2",
        className
      )}
      {...props}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export { Markdown }
