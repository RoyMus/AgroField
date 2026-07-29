import * as React from "react"
import Box from "@mui/material/Box"

import { cn } from "@/lib/utils"

// ponytail: MUI has no scroll-area primitive, so this is a plain overflow box
// with native scrollbars. Swap in a custom scrollbar library only if the native
// one actually becomes a problem.
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <Box
    ref={ref}
    className={cn("relative overflow-y-auto", className)}
    {...props}
  >
    {children}
  </Box>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
