import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "cn"

// A code block: the code tidied by Prettier (when `format` is on and Prettier knows the language) and coloured by
// Shiki, with a file name, line numbers, a copy button, a font size and optional word wrap (as Miro's code block).
// Both load only when a code block shows.

type Language = "tsx" | "typescript" | "javascript" | "json" | "css" | "html" | "markdown" | "bash" | "python" | "java" | "c" | "cpp" | "php" | "sql" | "yaml" | "graphql" | "xml" | "scss"
type Theme = "github-light" | "github-dark" | "one-dark-pro" | "vitesse-light" | "vitesse-dark" | "dracula" | "nord"

const kParsers: Partial<Record<Language, { parser: string; plugins: string[] }>> = {
  tsx: { parser: "typescript", plugins: ["typescript", "estree"] },
  typescript: { parser: "typescript", plugins: ["typescript", "estree"] },
  javascript: { parser: "babel", plugins: ["babel", "estree"] },
  json: { parser: "json", plugins: ["babel", "estree"] },
  css: { parser: "css", plugins: ["postcss"] },
  html: { parser: "html", plugins: ["html", "postcss", "babel", "estree"] },
  markdown: { parser: "markdown", plugins: ["markdown"] },
}

const kPlugins: Record<string, () => Promise<unknown>> = {
  typescript: () => import("prettier/plugins/typescript"),
  estree: () => import("prettier/plugins/estree"),
  babel: () => import("prettier/plugins/babel"),
  postcss: () => import("prettier/plugins/postcss"),
  html: () => import("prettier/plugins/html"),
  markdown: () => import("prettier/plugins/markdown"),
}

/** The code as Prettier writes it, or as it is when Prettier cannot read it. */
async function formatted(code: string, language: Language): Promise<string> {
  const setup = kParsers[language]
  if (!setup) return code
  try {
    const [prettier, ...plugins] = await Promise.all([import("prettier/standalone"), ...setup.plugins.map((name) => kPlugins[name]())])
    return (await prettier.format(code, { parser: setup.parser, plugins: plugins as never[], semi: false, singleQuote: false, printWidth: 80 })).trimEnd()
  } catch {
    return code
  }
}

function CodeBlock({
  code,
  language = "tsx",
  theme = "github-light",
  format = true,
  lineNumbers = true,
  title,
  copy = true,
  fontSize = 13,
  wrap = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  code: string
  language?: Language
  theme?: Theme
  format?: boolean
  lineNumbers?: boolean
  title?: string
  copy?: boolean
  fontSize?: number | string
  wrap?: boolean
}) {
  // The panel writes it as text ("13"); a number either way.
  const size = Number(fontSize) || 13
  const [html, setHtml] = React.useState("")
  const [text, setText] = React.useState(code)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    let current = true
    void (async () => {
      const shown = format ? await formatted(code, language) : code
      const { codeToHtml } = await import("shiki/bundle/web")
      const coloured = await codeToHtml(shown, { lang: language, theme }).catch(() => "")
      if (!current) return
      setText(shown)
      setHtml(coloured)
    })()
    return () => {
      current = false
    }
  }, [code, language, theme, format])
  const onCopy = () => {
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div data-slot="code-block" className={cn("group relative w-full overflow-hidden rounded-xl border text-sm", className)} {...props}>
      {title && <div className="border-b bg-muted/50 px-4 py-2 font-mono text-xs text-muted-foreground">{title}</div>}
      {copy && (
        <button type="button" aria-label="Copy code" onClick={onCopy} className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md border bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" style={title ? { top: "2.6rem" } : undefined}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      )}
      {html ? (
        <div
          style={{ fontSize: size, lineHeight: `${Math.round(size * 1.75)}px` }}
          className={cn(
            "overflow-x-auto font-mono [&_pre]:px-4 [&_pre]:py-3 [&_pre]:outline-none",
            wrap && "[&_pre]:whitespace-pre-wrap [&_pre]:break-words",
            lineNumbers && "[counter-reset:line] [&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-5 [&_.line]:before:text-right [&_.line]:before:opacity-40 [&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line]"
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className={cn("overflow-x-auto px-4 py-3 font-mono", wrap && "whitespace-pre-wrap break-words")} style={{ fontSize: size, lineHeight: `${Math.round(size * 1.75)}px` }}>
          {text}
        </pre>
      )}
    </div>
  )
}

export { CodeBlock }
