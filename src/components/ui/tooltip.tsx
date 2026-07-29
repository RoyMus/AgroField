import * as React from "react"
import MuiTooltip from "@mui/material/Tooltip"

// MUI needs no provider, so TooltipProvider is a passthrough that keeps the
// existing App.tsx tree unchanged.
const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)

export interface TooltipProps {
  children: React.ReactNode
  title?: React.ReactNode
}

const Tooltip = ({ children, title = "" }: TooltipProps) => (
  <MuiTooltip title={title}>
    <span>{children}</span>
  </MuiTooltip>
)

export { Tooltip, TooltipProvider }
