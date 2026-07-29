import * as React from "react"
import FormLabel from "@mui/material/FormLabel"

import { cn } from "@/lib/utils"

const labelClasses =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"

// `color` is dropped: the HTML attribute is a plain string, which clashes with
// MUI's palette union, and nothing in the app passes it.
export type LabelProps = Omit<
  React.LabelHTMLAttributes<HTMLLabelElement>,
  "color"
>

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <FormLabel
      component="label"
      ref={ref}
      className={cn(labelClasses, className)}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label }
