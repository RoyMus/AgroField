import { useState } from "react";
import { Menu, MenuItem } from "@mui/material";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { SheetTab } from "@/types/cellTypes";

interface SheetSelectorProps {
  availableSheets: SheetTab[];
  currentSheet: string;
  onSheetSelect: (sheetName: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const SheetSelector = ({ 
  availableSheets, 
  currentSheet, 
  onSheetSelect, 
  isLoading = false,
  disabled = false 
}: SheetSelectorProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleSheetSelect = (sheetTitle: string) => {
    onSheetSelect(sheetTitle);
    setAnchorEl(null);
  };

  if (!availableSheets || availableSheets.length <= 1) {
    return null; // Don't show selector if there's only one sheet
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled || isLoading}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className="min-w-[200px] justify-between"
      >
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="truncate">{currentSheet}</span>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { className: "w-[280px]" } }}
      >
        {availableSheets.map((sheet) => (
          <MenuItem
            key={sheet.id}
            disableRipple
            onClick={() => handleSheetSelect(sheet.title)}
            className={`cursor-pointer py-2 px-3 ${
              sheet.title === currentSheet
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3 w-full">
              <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-green-600" />
              <span className="truncate">{sheet.title}</span>
            </div>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SheetSelector;