import * as React from "react"
import { useDropzone, type Accept, type FileRejection } from "react-dropzone"
import { File as FileIcon, UploadCloud, X } from "lucide-react"
import { cn } from "cn"

// A file upload (react-dropzone): drop files on it or click to pick them; each shows with its size and a progress
// bar. Wrong types and files that are too big are listed with the reason.

const kAccept: Record<string, Accept | undefined> = {
  any: undefined,
  images: { "image/*": [] },
  pdf: { "application/pdf": [".pdf"] },
  video: { "video/*": [] },
  documents: { "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt"] },
}

function sizeOf(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type Entry = { file: File; progress: number }

function FileUpload({
  accept = "any",
  maxSize = 10,
  multiple = true,
  title = "Drop files here or click to upload",
  hint,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  accept?: "any" | "images" | "pdf" | "video" | "documents"
  maxSize?: number
  multiple?: boolean
  title?: string
  hint?: string
}) {
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [rejected, setRejected] = React.useState<FileRejection[]>([])
  // Uploads are shown, not sent: each bar fills over about a second.
  React.useEffect(() => {
    if (!entries.some((entry) => entry.progress < 100)) return
    const timer = setInterval(() => setEntries((current) => current.map((entry) => ({ ...entry, progress: Math.min(100, entry.progress + 12) }))), 120)
    return () => clearInterval(timer)
  }, [entries])
  const onDrop = React.useCallback(
    (accepted: File[], wrong: FileRejection[]) => {
      setEntries((current) => [...(multiple ? current : []), ...accepted.map((file) => ({ file, progress: 0 }))])
      setRejected(wrong)
    },
    [multiple]
  )
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: kAccept[accept], maxSize: maxSize * 1024 * 1024, multiple })
  const kinds = accept === "any" ? "Any file" : accept === "images" ? "Images" : accept === "pdf" ? "PDF" : accept === "video" ? "Videos" : "PDF, Word or text"

  return (
    <div data-slot="file-upload" className={cn("flex w-full flex-col gap-3 text-sm", className)} {...props}>
      <div
        {...getRootProps()}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50", isDragActive && "border-primary bg-primary/5")}
      >
        <input {...getInputProps()} />
        <UploadCloud className="size-8 text-muted-foreground" />
        <div className="font-medium">{isDragActive ? "Drop to upload" : title}</div>
        <div className="text-xs text-muted-foreground">{hint || `${kinds}, up to ${maxSize} MB${multiple ? "" : ", one file"}`}</div>
      </div>
      {entries.map((entry, index) => (
        <div key={`${entry.file.name} ${index}`} className="flex items-center gap-3 rounded-lg border p-3">
          <FileIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2">
              <span className="truncate font-medium">{entry.file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{entry.progress < 100 ? `${entry.progress}%` : sizeOf(entry.file.size)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${entry.progress}%` }} />
            </div>
          </div>
          <button type="button" aria-label={`Remove ${entry.file.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setEntries((current) => current.filter((_, at) => at !== index))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      {rejected.map(({ file, errors }) => (
        <div key={file.name} className="text-xs text-destructive">
          {file.name}: {errors[0]?.code === "file-too-large" ? `bigger than ${maxSize} MB` : errors[0]?.code === "file-invalid-type" ? "not an accepted type" : errors[0]?.message}
        </div>
      ))}
    </div>
  )
}

export { FileUpload }
