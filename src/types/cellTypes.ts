import { makeAutoObservable } from 'mobx';

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
  type?: 'number' | 'currency' | 'date' | 'percent' | 'duration' | 'text';
  pattern?: string;
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

export interface SheetMetadata {
  title: string;
  sheetCount: number;
  availableSheets?: SheetTab[];
}

/** Raw wire format returned by the readAllSheets edge function. */
export interface SheetData {
  values: string[][];
  sheetName: string;
  metadata?: SheetMetadata;
  formatting?: CellStyle[];
  hiddenColumns?: number[];
  hiddenRows?: number[];
}

export class Cell {
  original: string;
  modified: string | null = null;
  formatting: CellFormat = {};
  saved = true;

  constructor(original: unknown = '', formatting: CellFormat = {}, saved = true) {
    this.original = String(original ?? '');
    this.formatting = formatting;
    this.saved = saved;
    makeAutoObservable(this);
  }

  get value(): string {
    return String(this.modified ?? this.original ?? '');
  }

  get isModified(): boolean {
    return this.modified !== null;
  }

  get isFormula(): boolean {
    return this.original.startsWith('=');
  }

  setValue(value: string | null) {
    this.modified = value;
    this.saved = false;
  }

  setFormat(format: CellFormat) {
    this.formatting = format;
    this.saved = false;
  }

  /** Merge keys into the existing format instead of replacing it. */
  mergeFormat(format: CellFormat) {
    this.setFormat({ ...this.formatting, ...format });
  }

  markSaved() {
    this.saved = true;
  }
}

export class Sheet {
  sheetName: string;
  metadata?: SheetMetadata;
  values: Cell[][];
  hiddenColumns: number[];
  hiddenRows: number[];

  constructor(data: SheetData) {
    this.sheetName = data.sheetName;
    this.metadata = data.metadata;
    this.hiddenColumns = data.hiddenColumns ?? [];
    this.hiddenRows = data.hiddenRows ?? [];
    this.values = data.values.map((row, r) =>
      row.map((value, c) =>
        new Cell(
          value,
          data.formatting?.find(s => s.rowIndex === r && s.columnIndex === c)?.format ?? {}
        )
      )
    );
    makeAutoObservable(this);
  }

  get hiddenColumnSet(): Set<number> {
    return new Set(this.hiddenColumns);
  }

  get hiddenRowSet(): Set<number> {
    return new Set(this.hiddenRows);
  }

  cell(row: number, col: number): Cell | undefined {
    return this.values[row]?.[col];
  }

  /** Value of a cell, empty string when out of bounds. */
  valueAt(row: number, col: number): string {
    return this.values[row]?.[col]?.value ?? '';
  }

  get maxCols(): number {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }

  setRows(rows: Cell[][]) {
    this.values = rows;
  }

  insertRow(at: number) {
    this.values.splice(at, 0, Array.from({ length: this.maxCols }, () => new Cell('', {}, false)));
  }

  removeRow(at: number) {
    this.values.splice(at, 1);
  }

  insertColumn(at: number) {
    this.values.forEach(row => row.splice(at, 0, new Cell('', {}, false)));
  }

  removeColumn(at: number) {
    this.values.forEach(row => row.splice(at, 1));
  }

  /** Grows the grid so (row, col) exists, then returns that cell. */
  ensureCell(row: number, col: number): Cell {
    while (this.values.length <= row) this.values.push([]);
    while (this.values[row].length <= col) this.values[row].push(new Cell('', {}, false));
    return this.values[row][col];
  }
}
