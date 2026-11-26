import * as React from "react"
import PhoneNumberInput, { type Country } from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { cn } from "cn"

// A phone number input (react-phone-number-input): a country picker with its flag, and the number formatted as it
// is typed ("+91 98765 43210").

const Field = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Field({ className, ...props }, ref) {
  return <input ref={ref} className={cn("h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)} {...props} />
})

function PhoneInput({
  defaultCountry = "IN",
  placeholder = "Phone number",
  international = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> & {
  defaultCountry?: Country
  placeholder?: string
  international?: boolean
}) {
  const [value, setValue] = React.useState<string | undefined>()
  return (
    <div
      data-slot="phone-input"
      className={cn("flex h-9 w-72 items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-xs focus-within:ring-2 focus-within:ring-ring/50 [&_.PhoneInputCountry]:mr-0 [&_.PhoneInputCountryIcon]:shadow-none", className)}
      {...props}
    >
      <PhoneNumberInput
        key={`${defaultCountry} ${international}`}
        value={value}
        onChange={setValue}
        defaultCountry={defaultCountry}
        international={international}
        placeholder={placeholder}
        inputComponent={Field}
        className="flex w-full items-center gap-2"
      />
    </div>
  )
}

export { PhoneInput }
