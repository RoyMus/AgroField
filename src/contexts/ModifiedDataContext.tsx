import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ModifiedCellData, CellFormat } from '@/types/cellTypes';

export type ModifiedData = Record<string, ModifiedCellData>;
type AllSheetModifications = Record<string, ModifiedData>;

interface ModifiedDataContextType {
  modifiedData: ModifiedData;
  setModifiedData: (data: ModifiedData) => void;
  updateCellValue: (rowIndex: number, columnIndex: number, originalValue: string, modifiedValue: string) => void;
  updateCellFormat: (rowIndex: number, columnIndex: number, format: CellFormat) => void;
  getCellFormat: (rowIndex: number, columnIndex: number) => CellFormat | undefined;
  clearAllModifications: () => void;
}

const ModifiedDataContext = createContext<ModifiedDataContextType | undefined>(undefined);

interface ModifiedDataProviderProps {
  children: ReactNode;
  sheetName: string;
}

export const ModifiedDataProvider: React.FC<ModifiedDataProviderProps> = ({ children, sheetName }) => {
  const [allSheetModifications, setAllSheetModifications] = useState<AllSheetModifications>(() => {
    try {
      const item = window.localStorage.getItem('all_sheet_modifications');
      return item ? JSON.parse(item) : {};
    } catch (error) {
      console.error('Error reading from localStorage', error);
      return {};
    }
  });

  const modifiedData = useMemo(() => {
    return allSheetModifications[sheetName] || {};
  }, [allSheetModifications, sheetName]);

  const setModifiedData = useCallback((data: ModifiedData) => {
    setAllSheetModifications(prev => {
      const newAllMods = { ...prev, [sheetName]: data };
      try {
        window.localStorage.setItem('all_sheet_modifications', JSON.stringify(newAllMods));
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
      return newAllMods;
    });
  }, [sheetName]);

  const updateCellValue = useCallback((rowIndex: number, columnIndex: number, originalValue: string, modifiedValue: string) => {
    const cellKey = `${rowIndex}-${columnIndex}`;
    setAllSheetModifications(prev => {
      const currentSheetData = prev[sheetName] || {};
      const existingCell = currentSheetData[cellKey];
      
      // If value matches original and no format changes, remove the modification
      if (originalValue === modifiedValue && !existingCell?.format) {
        const { [cellKey]: _, ...rest } = currentSheetData;
        const newAllMods = { ...prev, [sheetName]: rest };
        try {
          window.localStorage.setItem('all_sheet_modifications', JSON.stringify(newAllMods));
        } catch (error) {
          console.error('Error writing to localStorage', error);
        }
        return newAllMods;
      }
      
      // Otherwise, update or create the modification
      const newSheetData = {
        ...currentSheetData,
        [cellKey]: {
          originalValue,
          modifiedValue,
          rowIndex,
          columnIndex,
          format: existingCell?.format, // Preserve existing format if any
        }
      };
      
      const newAllMods = { ...prev, [sheetName]: newSheetData };
      try {
        window.localStorage.setItem('all_sheet_modifications', JSON.stringify(newAllMods));
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
      return newAllMods;
    });
  }, [sheetName]);

  const updateCellFormat = useCallback((rowIndex: number, columnIndex: number, format: CellFormat) => {
    const cellKey = `${rowIndex}-${columnIndex}`;
    setAllSheetModifications(prev => {
      const currentSheetData = prev[sheetName] || {};
      const existingCell = currentSheetData[cellKey];
      
      // Create or update the cell with the new format
      const newSheetData = {
        ...currentSheetData,
        [cellKey]: {
          originalValue: existingCell?.originalValue || '',
          modifiedValue: existingCell?.modifiedValue || existingCell?.originalValue || '',
          rowIndex,
          columnIndex,
          format: { ...existingCell?.format, ...format }, // Merge with existing format
        }
      };
      
      const newAllMods = { ...prev, [sheetName]: newSheetData };
      try {
        window.localStorage.setItem('all_sheet_modifications', JSON.stringify(newAllMods));
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
      return newAllMods;
    });
  }, [sheetName]);

  const getCellFormat = useCallback((rowIndex: number, columnIndex: number): CellFormat | undefined => {
    const cellKey = `${rowIndex}-${columnIndex}`;
    return modifiedData[cellKey]?.format;
  }, [modifiedData]);

  const clearAllModifications = useCallback(() => {
    setAllSheetModifications({});
    try {
      window.localStorage.removeItem('all_sheet_modifications');
      window.localStorage.removeItem('all_sheet_styles'); // Also clear old styles
      window.localStorage.removeItem('sheet_cell_styles'); // Also clear old styles
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  }, []);

  return (
    <ModifiedDataContext.Provider value={{ 
      modifiedData, 
      setModifiedData, 
      updateCellValue,
      updateCellFormat,
      getCellFormat,
      clearAllModifications 
    }}>
      {children}
    </ModifiedDataContext.Provider>
  );
};

export const useModifiedData = () => {
  const context = useContext(ModifiedDataContext);
  if (context === undefined) {
    throw new Error('useModifiedData must be used within a ModifiedDataProvider');
  }
  return context;
};
