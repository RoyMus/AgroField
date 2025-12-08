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

export interface ModifiedCell {
  original: string;
  modified: string | null;
  formatting: CellFormat;
}

export interface ModifiedSheet {
  sheetName: string;
  metadata?: {
    title: string;
    sheetCount: number;
    availableSheets?: SheetTab[];
  };
  values: ModifiedCell[][];
}

export function getValue(cell: ModifiedCell | null | undefined): string {
  if (!cell) return String('');
  const value = cell.modified ?? cell.original ?? '';
  return String(value);
}

export function isModified(cell: ModifiedCell): boolean {
  return cell.modified !== null;
}

export function createModifiedSheet(sheetData: SheetData): ModifiedSheet {
  return {
    sheetName: sheetData.sheetName,
    metadata: sheetData.metadata,
    values: sheetData.values.map((row, rIdx) =>
      row.map((value, cIdx) => ({
        original: value,
        modified: null,
        formatting:
          sheetData.formatting?.find(
            s => s.rowIndex === rIdx && s.columnIndex === cIdx
          )?.format || {}
      }))
    )
  };
}
