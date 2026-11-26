import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "cn"

// A form that checks itself (react-hook-form + zod): each field says its type, whether it is required and its
// shortest length, and shows "Email is required" under itself until it is right.

type Field = { label: string; type?: "text" | "email" | "password" | "number" | "textarea"; required?: boolean; min?: number; placeholder?: string }

function keyOf(label: string | undefined, index: number): string {
  return String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `field_${index + 1}`
}

function schemaOf(fields: Field[]) {
  const shape: Record<string, z.ZodType> = {}
  fields.forEach((field, index) => {
    shape[keyOf(field.label, index)] = z
      .string()
      .trim()
      .superRefine((value, context) => {
        const problem = !value
          ? field.required && `${field.label} is required`
          : field.min && value.length < field.min
            ? `${field.label} needs at least ${field.min} characters`
            : field.type === "email" && !z.email().safeParse(value).success
              ? "Enter a valid email address"
              : field.type === "number" && Number.isNaN(Number(value)) && `${field.label} must be a number`
        if (problem) context.addIssue({ code: "custom", message: problem })
      })
  })
  return z.object(shape)
}

function FormBlock({
  fields,
  title,
  submitLabel = "Submit",
  successMessage = "Thanks! We got it.",
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  fields: Field[]
  title?: string
  submitLabel?: string
  successMessage?: string
}) {
  const schema = React.useMemo(() => schemaOf(fields), [fields])
  const form = useForm<Record<string, string>>({ resolver: zodResolver(schema) as never, mode: "onTouched" })
  const [sent, setSent] = React.useState(false)
  const errors = form.formState.errors

  return (
    <form data-slot="form" noValidate className={cn("flex w-full max-w-sm flex-col gap-4 text-sm", className)} onSubmit={form.handleSubmit(() => setSent(true))} {...props}>
      {title && <div className="text-lg font-semibold">{title}</div>}
      {fields.map((field, index) => {
        const name = keyOf(field.label, index)
        const error = errors[name]?.message as string | undefined
        return (
          <label key={name} className="flex flex-col gap-1.5">
            <span className="font-medium">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </span>
            {field.type === "textarea" ? (
              <textarea rows={3} placeholder={field.placeholder} aria-invalid={!!error} className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive" {...form.register(name)} />
            ) : (
              <input type={field.type === "number" ? "text" : (field.type ?? "text")} inputMode={field.type === "number" ? "decimal" : undefined} placeholder={field.placeholder} aria-invalid={!!error} className="w-full rounded-md border border-input bg-transparent h-9 px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive" {...form.register(name)} />
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
          </label>
        )
      })}
      <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90">
        {submitLabel}
      </button>
      {sent && <p className="text-center text-muted-foreground">{successMessage}</p>}
    </form>
  )
}

export { FormBlock }
