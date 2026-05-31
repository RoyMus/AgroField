import React, { createContext, useContext, useState } from 'react';
import { ModifiedSheet } from '@/types/cellTypes';

interface SheetDataContextType {
  sheetData: ModifiedSheet | null;
  setSheetData: (data: ModifiedSheet | null) => void;
  allSheets: Record<string, ModifiedSheet> | null;
  setAllSheets: (sheets: Record<string, ModifiedSheet> | null) => void;
}

const SheetDataContext = createContext<SheetDataContextType | null>(null);

export const SheetDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sheetData, setSheetData] = useState<ModifiedSheet | null>(null);
  const [allSheets, setAllSheets] = useState<Record<string, ModifiedSheet> | null>(null);

  return (
    <SheetDataContext.Provider value={{ sheetData, setSheetData, allSheets, setAllSheets }}>
      {children}
    </SheetDataContext.Provider>
  );
};

export const useSheetData = (): SheetDataContextType => {
  const ctx = useContext(SheetDataContext);
  if (!ctx) throw new Error('useSheetData must be used inside SheetDataProvider');
  return ctx;
};
