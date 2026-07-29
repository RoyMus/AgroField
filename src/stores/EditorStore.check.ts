/**
 * Smoke check for the sheet-layout derivation and cursor movement that used to
 * live as inline loops inside SheetDataEditor.
 *
 *   npm run check
 */
import './checkStub'; // must stay first: installs the browser globals
import assert from 'node:assert/strict';
import { runInAction } from 'mobx';
import { Sheet, SheetData } from '../types/cellTypes';
import { EditorStore } from './EditorStore';

// Columns 6 and 7 are the editable range: header row 3 is blank at column 5
// (opening the range) and at column 8 (closing it).
const raw: SheetData = {
  sheetName: 'test',
  values: [
    ['',   'Title',        '',      '',      '', '', '',          '',    ''], // 0 banner
    ['',   'Faucet',       '2.1',   '',      '', '', '',          '',    ''], // 1
    ['',   'talgil:key:7', 'stamp', 'date',  '', '', '',          '',    ''], // 2
    ['Hamama', 'Magof',    'c2',    'Gidul', 'h4', '', 'A',       'B',   ''], // 3 headers
    ['H1', 'M1',           '',      'G1',    '', '', '',          '',    ''], // 4 data
    ['H1', 'M2',           '',      'G2',    '', '', '=SUM(A1)',  '',    ''], // 5 data
    ['H2', 'M3',           '',      'G3',    '', '', '',          '',    ''], // 6 data
    ['H2', 'M4',           '',      'G4',    '', '', '',          '',    ''], // 7 data (last)
    ['',   '',             '',      '',      '', '', '1-5',       '1-5', ''], // 8 target range
    ['',   '',             'avg',   '',      '', '', '',          '',    ''], // 9 average output
    ['',   '',             '',      '',      '', '', '',          '',    ''], // 10 blank
  ],
};

const sheet = new Sheet(raw);
const drive: any = { sheet, saveProgress: () => {} };
const lang: any = { commands: { skip: ['skip'], back: ['back'], delete: ['del'], save: ['save'], decimal: 'point' } };
const settings: any = { isTemplate: false, place: '', plant: '', grower: '', faucetConductivity: '' };
const voice: any = { onWord: null, speak: (_t: string, cb?: () => void) => cb?.(), isRecording: false };

const editor = new EditorStore(drive, lang, settings, voice);

// Layout: header row is the first row with a non-blank first column.
assert.equal(editor.headerRowIndex, 3);
assert.equal(editor.firstDataRow, 4);
// Comment row is the first fully blank row after the headers.
assert.equal(editor.commentRowIndex, 10);
assert.equal(editor.dataRows.length, 10);

// Editable columns sit between the first and second blank header past column 4.
assert.deepEqual(editor.columnRange, [6, 7]);

// Cursor walks the editable range and skips formula cells.
runInAction(() => { editor.currentRow = 4; editor.currentCol = 6; });
editor.moveNext();
assert.deepEqual([editor.currentRow, editor.currentCol], [4, 7]);
editor.moveNext(); // (5,6) holds a formula, so it must land on (5,7)
assert.deepEqual([editor.currentRow, editor.currentCol], [5, 7]);
editor.movePrevious();
assert.deepEqual([editor.currentRow, editor.currentCol], [4, 7]);

// Row 8 (target range) and row 9 (average output) are reserved and never entered.
runInAction(() => { editor.currentRow = 7; editor.currentCol = 7; });
editor.moveNext();
assert.deepEqual([editor.currentRow, editor.currentCol], [7, 7]);

// Dropdown cascade is derived, not hand-maintained.
assert.deepEqual(editor.optionsHamama, ['H1', 'H2']);
editor.selectHamama('H1');
assert.deepEqual(editor.optionsMagof, ['M1', 'M2']);
assert.deepEqual(editor.optionsGidul, ['G1']);
editor.selectMagof('M2');
assert.deepEqual(editor.optionsGidul, ['G2']);
assert.equal(editor.currentRow, 5); // selecting navigated to the matching row

// Averages land in the last data row and are coloured against the target range.
editor.calcAverages();
assert.equal(sheet.valueAt(9, 6), ''); // no numeric data yet -> column skipped
assert.equal(sheet.cell(9, 6)!.formatting.backgroundColor, undefined);

// Cell mutation is in place — no cloning needed for the value to change.
const cell = sheet.cell(4, 6)!;
cell.setValue('12');
assert.equal(cell.value, '12');
assert.equal(cell.isModified, true);
assert.equal(cell.saved, false);
assert.equal(sheet.valueAt(4, 6), '12');

// Now there is numeric data, so the average is computed and flagged out of range.
editor.calcAverages();
assert.equal(sheet.valueAt(9, 6), '12.00');
assert.equal(sheet.cell(9, 6)!.formatting.backgroundColor, '#ff0000ff'); // 12 not in 1-5

console.log('EditorStore.check: all assertions passed');
