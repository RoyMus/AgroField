import { useState, useCallback, useEffect } from "react";
import { SheetData, ModifiedCellData, CellStyle } from "@/types/cellTypes";

interface SheetModifications {
  originalData: string[][];
  cellChanges: Record<string, ModifiedCellData>;
  addedRows: number[];
  removedRows: number[];
  addedColumns: number[];
  removedColumns: number[];
  cellStyles: CellStyle[];
  currentRowCount: number;
  currentColCount: number;
}

export const useSheetModifications = (sheetData: SheetData | null) => {
  const [modifications, setModifications] = useState<SheetModifications>({
    originalData: [],
    cellChanges: {},
    addedRows: [],
    removedRows: [],
    addedColumns: [],
    removedColumns: [],
    cellStyles: [],
    currentRowCount: 0,
    currentColCount: 0,
  });

  // Load modifications from localStorage when sheet changes
  useEffect(() => {
    if (!sheetData) return;

    const sheetName = sheetData.sheetName;
    
    // Load cell changes
    const savedModifications = localStorage.getItem('all_sheet_modifications');
    const allModifications = savedModifications ? JSON.parse(savedModifications) : {};
    const cellChanges = allModifications[sheetName] || {};

    // Load styles
    const savedStyles = localStorage.getItem('all_sheet_styles');
    const allStyles = savedStyles ? JSON.parse(savedStyles) : {};
    const cellStyles = allStyles[sheetName] || [];

    // Initialize with original data
    const originalData = sheetData.values.map(row => [...row]);
    
    setModifications({
      originalData,
      cellChanges,
      addedRows: [],
      removedRows: [],
      addedColumns: [],
      removedColumns: [],
      cellStyles,
      currentRowCount: originalData.length,
      currentColCount: Math.max(...originalData.map(row => row.length), 0),
    });
  }, [sheetData?.sheetName]);

  // Compute current data by applying all modifications
  const getCurrentData = useCallback((): string[][] => {
    let data = modifications.originalData.map(row => [...row]);
    
    // Apply cell changes
    Object.values(modifications.cellChanges).forEach(change => {
      const { rowIndex, columnIndex, modifiedValue } = change;
      
      // Extend rows if needed
      while (data.length <= rowIndex) {
        data.push([]);
      }
      
      // Extend columns if needed
      while (data[rowIndex].length <= columnIndex) {
        data[rowIndex].push("");
      }
      
      data[rowIndex][columnIndex] = modifiedValue;
    });

    // Apply added rows
    modifications.addedRows.forEach(rowIndex => {
      const newRow = new Array(modifications.currentColCount).fill("");
      data.splice(rowIndex, 0, newRow);
    });

    // Apply removed rows (in reverse to maintain indices)
    [...modifications.removedRows].sort((a, b) => b - a).forEach(rowIndex => {
      data.splice(rowIndex, 1);
    });

    // Apply added columns
    modifications.addedColumns.forEach(colIndex => {
      data.forEach(row => {
        row.splice(colIndex, 0, "");
      });
    });

    // Apply removed columns (in reverse to maintain indices)
    [...modifications.removedColumns].sort((a, b) => b - a).forEach(colIndex => {
      data.forEach(row => {
        row.splice(colIndex, 1);
      });
    });

    return data;
  }, [modifications]);

  // Update a cell value
  const updateCell = useCallback((rowIndex: number, colIndex: number, value: string) => {
    if (!sheetData) return;

    const originalValue = (modifications.originalData[rowIndex] && modifications.originalData[rowIndex][colIndex]) || "";
    const cellKey = `${rowIndex}-${colIndex}`;

    setModifications(prev => {
      const newCellChanges = { ...prev.cellChanges };
      
      if (originalValue === value) {
        // Value matches original, remove from changes
        delete newCellChanges[cellKey];
      } else {
        // Value is different, track as modification
        newCellChanges[cellKey] = {
          originalValue,
          modifiedValue: value,
          rowIndex,
          columnIndex: colIndex,
        };
      }

      // Save to localStorage
      const allModifications = JSON.parse(localStorage.getItem('all_sheet_modifications') || '{}');
      allModifications[sheetData.sheetName] = newCellChanges;
      localStorage.setItem('all_sheet_modifications', JSON.stringify(allModifications));

      return {
        ...prev,
        cellChanges: newCellChanges,
      };
    });
  }, [sheetData, modifications.originalData]);

  // Add a row
  const addRow = useCallback((index: number) => {
    setModifications(prev => ({
      ...prev,
      addedRows: [...prev.addedRows, index],
      currentRowCount: prev.currentRowCount + 1,
    }));
  }, []);

  // Remove a row
  const removeRow = useCallback((index: number) => {
    setModifications(prev => ({
      ...prev,
      removedRows: [...prev.removedRows, index],
      currentRowCount: prev.currentRowCount - 1,
    }));
  }, []);

  // Add a column
  const addColumn = useCallback((index: number) => {
    setModifications(prev => ({
      ...prev,
      addedColumns: [...prev.addedColumns, index],
      currentColCount: prev.currentColCount + 1,
    }));
  }, []);

  // Remove a column
  const removeColumn = useCallback((index: number) => {
    setModifications(prev => ({
      ...prev,
      removedColumns: [...prev.removedColumns, index],
      currentColCount: prev.currentColCount - 1,
    }));
  }, []);

  // Update cell styles
  const updateCellStyles = useCallback((styles: CellStyle[]) => {
    if (!sheetData) return;

    setModifications(prev => {
      const newStyles = styles;

      // Save to localStorage
      const allStyles = JSON.parse(localStorage.getItem('all_sheet_styles') || '{}');
      allStyles[sheetData.sheetName] = newStyles;
      localStorage.setItem('all_sheet_styles', JSON.stringify(allStyles));

      return {
        ...prev,
        cellStyles: newStyles,
      };
    });
  }, [sheetData]);

  // Get change count
  const getChangeCount = useCallback(() => {
    return Object.keys(modifications.cellChanges).length + 
           modifications.addedRows.length + 
           modifications.removedRows.length +
           modifications.addedColumns.length +
           modifications.removedColumns.length;
  }, [modifications]);

  // Clear all modifications
  const clearModifications = useCallback(() => {
    if (!sheetData) return;

    setModifications(prev => ({
      ...prev,
      cellChanges: {},
      addedRows: [],
      removedRows: [],
      addedColumns: [],
      removedColumns: [],
    }));

    // Clear from localStorage
    const allModifications = JSON.parse(localStorage.getItem('all_sheet_modifications') || '{}');
    delete allModifications[sheetData.sheetName];
    localStorage.setItem('all_sheet_modifications', JSON.stringify(allModifications));
  }, [sheetData]);

  return {
    modifications,
    getCurrentData,
    updateCell,
    addRow,
    removeRow,
    addColumn,
    removeColumn,
    updateCellStyles,
    getChangeCount,
    clearModifications,
  };
};
