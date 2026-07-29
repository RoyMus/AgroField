import Snackbar from "@mui/material/Snackbar"
import IconButton from "@mui/material/IconButton"
import { X } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { toastVariants } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <>
      {toasts.map(({ id, title, description, action, variant, open, duration }) => (
        <Snackbar
          key={id}
          open={open}
          autoHideDuration={duration ?? null}
          onClose={(_, reason) => {
            if (reason !== "clickaway") dismiss(id)
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          className="md:max-w-[420px]"
        >
          <div className={cn(toastVariants({ variant }))}>
            <div className="grid gap-1">
              {title && <div className="text-sm font-semibold">{title}</div>}
              {description && (
                <div className="text-sm opacity-90 whitespace-pre-line">
                  {description}
                </div>
              )}
            </div>
            {action}
            <IconButton
              size="small"
              disableRipple
              onClick={() => dismiss(id)}
              className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </Snackbar>
      ))}
    </>
  )
}
