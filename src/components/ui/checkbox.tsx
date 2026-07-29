import * as React from "react"
import MuiCheckbox from "@mui/material/Checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const box =
  "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  id?: string
  className?: string
  onCheckedChange?: (checked: boolean) => void
}

// Keeps the Radix-style `onCheckedChange` API the app already calls, backed by
// MUI's Checkbox. The icon slots carry the Tailwind box so the square is
// pixel-identical to the shadcn original.
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <MuiCheckbox
      ref={ref}
      disableRipple
      className="p-0"
      onChange={(_, checked) => onCheckedChange?.(checked)}
      icon={<span className={cn(box, className)} />}
      checkedIcon={
        <span
          className={cn(box, "bg-primary text-primary-foreground", className)}
        >
          <Check className="h-4 w-4" />
        </span>
      }
      {...props}
    />
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
