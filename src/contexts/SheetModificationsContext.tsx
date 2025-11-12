import { createContext, useContext, ReactNode } from "react";
import { SheetData, ModifiedCellData, CellStyle } from "@/types/cellTypes";
import { useSheetModifications } from "@/hooks/useSheetModifications";

interface SheetModificationsContextType {
  modifications: {
    originalData: string[][];
    cellChanges: Record<string, ModifiedCellData>;
    addedRows: number[];
    removedRows: number[];
    addedColumns: number[];
    removedColumns: number[];
    cellStyles: CellStyle[];
    currentRowCount: number;
    currentColCount: number;
  };
  getCurrentData: () => string[][];
  updateCell: (rowIndex: number, colIndex: number, value: string) => void;
  addRow: (index: number) => void;
  removeRow: (index: number) => void;
  addColumn: (index: number) => void;
  removeColumn: (index: number) => void;
  updateCellStyles: (styles: CellStyle[]) => void;
  getChangeCount: () => number;
  clearModifications: () => void;
}

const SheetModificationsContext = createContext<SheetModificationsContextType | null>(null);

interface SheetModificationsProviderProps {
  children: ReactNode;
  sheetData: SheetData | null;
}

export const SheetModificationsProvider = ({ children, sheetData }: SheetModificationsProviderProps) => {
  const modificationsHook = useSheetModifications(sheetData);

  return (
    <SheetModificationsContext.Provider value={modificationsHook}>
      {children}
    </SheetModificationsContext.Provider>
  );
};

export const useSheetModificationsContext = () => {
  const context = useContext(SheetModificationsContext);
  if (!context) {
    throw new Error("useSheetModificationsContext must be used within SheetModificationsProvider");
  }
  return context;
};
