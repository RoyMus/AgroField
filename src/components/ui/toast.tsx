import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

// Toast rendering now lives in toaster.tsx on MUI's Snackbar. This module keeps
// only the shared shape + class variants that use-toast.ts and the Toaster need.

export const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type ToastActionElement = React.ReactElement

export interface ToastProps extends VariantProps<typeof toastVariants> {
  duration?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}
