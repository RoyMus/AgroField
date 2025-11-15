import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ModifiedCellData } from '@/types/cellTypes';

export type ModifiedData = Record<string, ModifiedCellData>;
type AllSheetModifications = Record<string, ModifiedData>;

interface ModifiedDataContextType {
  modifiedData: ModifiedData;
  setModifiedData: (data: ModifiedData) => void;
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

  const clearAllModifications = useCallback(() => {
    setAllSheetModifications({});
    try {
      window.localStorage.removeItem('all_sheet_modifications');
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  }, []);

  return (
    <ModifiedDataContext.Provider value={{ modifiedData, setModifiedData, clearAllModifications }}>
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
