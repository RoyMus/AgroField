import '@/stores';
import { StyledEngineProvider } from "@mui/material/styles";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import InteractivePage from "./pages/InteractivePage";
import EditableSheetPage from "./pages/EditableSheetPage";

const queryClient = new QueryClient();

// injectFirst puts MUI's emotion styles before the Tailwind stylesheet, so the
// Tailwind utility classes keep winning and the look is unchanged.
const App = () => (
  <StyledEngineProvider injectFirst>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/page/:pageName" element={<InteractivePage />} />
          <Route path="/edit-sheet" element={<EditableSheetPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Index />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </StyledEngineProvider>
);

export default App;
