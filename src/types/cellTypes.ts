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

export class ModifiedCellData {
  originalValue: string;
  newValue: string | null;
  formatting: CellFormat;

  constructor(originalValue: string, newValue: string,formatting: CellFormat) {
    this.originalValue = originalValue;
    this.newValue = newValue;
    this.formatting = formatting;
  }

  isModified():boolean
  {
    return this.newValue !== null;
  }
  getValue():string
  {
    return this.newValue !== null ? this.newValue : this.originalValue;
  }
}

export interface SheetTab {
  id: number;
  title: string;
  index: number;
}

export interface SheetData {
  values: ModifiedCellData[][];
  sheetName: string;
  metadata?: {
    title: string;
    sheetCount: number;
    availableSheets?: SheetTab[];
  };
}