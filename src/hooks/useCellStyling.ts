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
}``

export const useCellStyling = (): UseCellStylingReturn => {
  const [cellStyles, setCellStyles] = useState<CellStyle[]>([]);

  // Load styles from localStorage on mount
  useEffect(() => {
    const savedStyles = localStorage.getItem('sheet_cell_styles');
    if (savedStyles) {
      try {
        setCellStyles(JSON.parse(savedStyles));
      } catch (error) {
        console.error('Failed to parse saved styles:', error);
      }
    }
  }, []);

  // Save styles to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sheet_cell_styles', JSON.stringify(cellStyles));
  }, [cellStyles]);

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
    setCellStyles(prev => 
      prev.map(style => 
        style.rowIndex >= atIndex 
          ? { ...style, rowIndex: style.rowIndex + 1 }
          : style
      )
    );
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
    setCellStyles(prev => 
      prev.map(style => 
        style.columnIndex >= atIndex 
          ? { ...style, columnIndex: style.columnIndex + 1 }
          : style
      )
    );
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

  // Load initial styles and merge with existing ones
  const loadInitialStyles = useCallback((styles: CellStyle[]) => {
    setCellStyles(styles);
  }, []);

  const clearStyles = useCallback(() => {
    setCellStyles([]);
    localStorage.removeItem('sheet_cell_styles');
  }, []);

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
  };
};