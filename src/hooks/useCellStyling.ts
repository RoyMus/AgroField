import { useState, useCallback, useEffect } from 'react';
import { CellStyle, CellFormat } from '@/types/cellTypes';

interface UseCellStylingReturn {
  cellStyles: CellStyle[];
  getCellStyle: (rowIndex: number, columnIndex: number) => CellFormat | undefined;
  setCellStyle: (rowIndex: number, columnIndex: number, format: CellFormat) => void;
  setCellStyleFormat: (rowIndex: number, columnIndex: number, format: CellFormat) => void;
  insertRow: (atIndex: number) => void;
  deleteRow: (atIndex: number) => void;
  insertColumn: (atIndex: number) => void;
  deleteColumn: (atIndex: number) => void;
  loadInitialStyles: (styles: CellStyle[]) => void;
  clearStyles: () => void;
  saveStyles: ()=>void;
}

export const useCellStyling = (sheetName: string): UseCellStylingReturn => {
  const [cellStyles, setCellStyles] = useState<CellStyle[]>([]);

  // Load styles from localStorage for the current sheet
  useEffect(() => {
    const savedStyles = localStorage.getItem('all_sheet_styles');
    if (savedStyles) {
      try {
        const allStyles = JSON.parse(savedStyles);
        const currentSheetStyles = allStyles[sheetName] || [];
        setCellStyles(currentSheetStyles);
        console.log(`Loaded ${currentSheetStyles.length} styles for sheet: ${sheetName}`);
      } catch (error) {
        console.error('Failed to parse saved styles:', error);
        setCellStyles([]);
      }
    } else {
      // No saved styles, reset to empty
      setCellStyles([]);
    }
  }, [sheetName]);

  const getCellStyle = useCallback((rowIndex: number, columnIndex: number): CellFormat | undefined => {
    const style = cellStyles.find(s => s.rowIndex === rowIndex && s.columnIndex === columnIndex);
    return style?.format;
  }, [cellStyles]);

  const setCellStyleFormat = (rowIndex: number, columnIndex: number, format: CellFormat) => {
  setCellStyles(prev => {
    // Find if a style already exists for this cell
    const existing = prev.find(s => s.rowIndex === rowIndex && s.columnIndex === columnIndex);
    if (existing) {
      // Update only the provided fields
      return prev.map(s =>
        s.rowIndex === rowIndex && s.columnIndex === columnIndex
          ? { ...s, format: { ...s.format, ...format } }
          : s
      );
    } else {
      // Add a new style for this cell
      return [...prev, { rowIndex, columnIndex, format }];
    }
  });
};
  const setCellStyle = useCallback((rowIndex: number, columnIndex: number, format: CellFormat) => {
    setCellStyles(prev => {
      const filtered = prev.filter(s => !(s.rowIndex === rowIndex && s.columnIndex === columnIndex));
      return [...filtered, { rowIndex, columnIndex, format }];
    });
  }, []);

  const insertRow = useCallback((atIndex: number) => {
     setCellStyles(prev => {
    // 1. Shift styles down (same as before)
    const shifted = prev.map(style =>
      style.rowIndex >= atIndex
        ? { ...style, rowIndex: style.rowIndex + 1 }
        : style
    );

    // 2. Find styles from the row above (atIndex - 1)
    const prevRowStyles = prev.filter(style => style.rowIndex === atIndex - 1);

    // 3. Duplicate them for the new row, but update rowIndex
    const newRowStyles = prevRowStyles.map(style => ({
      ...style,
      rowIndex: atIndex
    }));

    // 4. Return merged result
    return [...shifted, ...newRowStyles];
  });
  }, []);

  const deleteRow = useCallback((atIndex: number) => {
    setCellStyles(prev => 
      prev.filter(style => style.rowIndex !== atIndex)
        .map(style => 
          style.rowIndex > atIndex 
            ? { ...style, rowIndex: style.rowIndex - 1 }
            : style
        )
    );
  }, []);

  const insertColumn = useCallback((atIndex: number) => {
    setCellStyles(prev => {
    // 1. Shift all columns to the right
    const shifted = prev.map(style =>
      style.columnIndex >= atIndex
        ? { ...style, columnIndex: style.columnIndex + 1 }
        : style
    );

    // 2. Collect all styles from the previous column (atIndex - 1)
    const prevColStyles = prev.filter(style => style.columnIndex === atIndex - 1);

    // 3. Duplicate them for the new column, but update columnIndex
    const newColStyles = prevColStyles.map(style => ({
      ...style,
      columnIndex: atIndex
    }));

    // 4. Return merged result
    return [...shifted, ...newColStyles];
    });
  }, []);

  const deleteColumn = useCallback((atIndex: number) => {
    setCellStyles(prev => 
      prev.filter(style => style.columnIndex !== atIndex)
        .map(style => 
          style.columnIndex > atIndex 
            ? { ...style, columnIndex: style.columnIndex - 1 }
            : style
        )
    );
  }, []);

  // Load initial styles and merge with stored ones
  const loadInitialStyles = useCallback((styles: CellStyle[]) => {
    // Get stored styles for this sheet
    const savedStyles = localStorage.getItem('all_sheet_styles');
    let storedStyles: CellStyle[] = [];
    if (savedStyles) {
      try {
        const allStyles = JSON.parse(savedStyles);
        storedStyles = allStyles[sheetName] || [];
      } catch (error) {
        console.error('Failed to parse saved styles:', error);
      }
    }

    // Merge stored styles with new styles, preferring stored styles for cells that exist in both
    const mergedStyles = [...styles];
    storedStyles.forEach(storedStyle => {
      const existingIndex = mergedStyles.findIndex(
        s => s.rowIndex === storedStyle.rowIndex && s.columnIndex === storedStyle.columnIndex
      );
      if (existingIndex !== -1) {
        mergedStyles[existingIndex] = storedStyle;
      } else {
        mergedStyles.push(storedStyle);
      }
    });

    setCellStyles(mergedStyles);
  }, [sheetName]);

  const clearStyles = useCallback(() => {
    setCellStyles([]);
    const allStyles = JSON.parse(localStorage.getItem('all_sheet_styles') || '{}');
    delete allStyles[sheetName];
    localStorage.setItem('all_sheet_styles', JSON.stringify(allStyles));
  }, [sheetName]);
  
  const saveStyles = useCallback(() => {
    setCellStyles(currentStyles => {
      console.log('Saving styles to localStorage for sheet:', sheetName, currentStyles);
      const allStyles = JSON.parse(localStorage.getItem('all_sheet_styles') || '{}');
      
      // Only save non-empty styles
      const validStyles = currentStyles.filter(style => 
        style && style.format && Object.keys(style.format).length > 0
      );
      
      if (validStyles.length > 0) {
        allStyles[sheetName] = validStyles;
      } else {
        delete allStyles[sheetName];
      }
      
      localStorage.setItem('all_sheet_styles', JSON.stringify(allStyles));
      return currentStyles;
    });
  }, [sheetName]);

  return {
    cellStyles,
    getCellStyle,
    setCellStyle,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    loadInitialStyles,
    clearStyles,
    setCellStyleFormat,
    saveStyles
  };
};