import * as React from "react"
import InputBase from "@mui/material/InputBase"

import { cn } from "@/lib/utils"

// `size`/`color` are dropped from the public props: the HTML meanings (number /
// string) clash with MUI's own union types and neither was ever passed here.
export type InputProps = Omit<React.ComponentProps<"input">, "size" | "color">

// The Tailwind box (height, border, radius, padding) stays on InputBase's root
// so the control looks identical; the inner <input> is stripped to transparent.
// placeholder:* and file:* must sit on the inner element to have any effect.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <InputBase
      type={type}
      inputRef={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      slotProps={{
        input: {
          className:
            "h-full w-full bg-transparent p-0 text-inherit outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed",
        },
      }}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
