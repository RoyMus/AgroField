export interface CellFormat {
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
  borders?: {
    top?: { style: string; color: string; width: number };
    bottom?: { style: string; color: string; width: number };
    left?: { style: string; color: string; width: number };
    right?: { style: string; color: string; width: number };
  };
}

export interface CellStyle {
  rowIndex: number;
  columnIndex: number;
  format: CellFormat;
}

export interface ModifiedCellData {
  originalValue: string;
  modifiedValue: string;
  rowIndex: number;
  columnIndex: number;
  format?: CellFormat; // Optional styling for this cell
}

export interface SheetTab {
  id: number;
  title: string;
  index: number;
}

export interface SheetData {
  values: string[][];
  sheetName: string;
  metadata?: {
    title: string;
    sheetCount: number;
    availableSheets?: SheetTab[];
  };
  formatting?: CellStyle[];
}