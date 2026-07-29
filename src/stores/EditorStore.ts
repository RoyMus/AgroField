import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Cell, Sheet } from '@/types/cellTypes';
import { toast } from '@/hooks/use-toast';
import i18n from '@/i18n';
import type { DriveStore } from './DriveStore';
import type { LangStore } from './LangStore';
import type { SettingsStore } from './SettingsStore';
import type { VoiceStore } from './VoiceStore';

function convertSecondsToTimeFormat(totalSeconds: number): string {
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Detects the format type for a value written to the sheet. 'text' for strings
// Google Sheets must NOT parse (e.g. "00:30"), 'percent' for "50%", or null to
// let the sheet's existing number format apply.
function detectValueType(value: string): 'text' | 'percent' | 'number' | null {
  if (!value || value.trim() === '') return null;
  const v = value.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return 'text';
  if (/^-?\d+(\.\d+)?%$/.test(v)) return 'percent';
  if (!isNaN(Number(v))) return 'number';
  return 'text';
}

const HIGHLIGHT = '#ffff00ff';
const ID_WORDS = ['סידורי', 'זיהוי', 'מזהה', 'מספר'];

/** Cursor + derived sheet layout for the voice-driven cell editor. */
export class EditorStore {
  currentRow = 0;
  currentCol = 0;
  currentValue = '';

  /** Greenhouse / valve / crop dropdown selection (mirrors the current row). */
  selectedHamama: string | null = null;
  selectedMagof: string | null = null;
  selectedGidul: string | null = null;

  private templateApplied = false;

  constructor(
    private drive: DriveStore,
    private lang: LangStore,
    private settings: SettingsStore,
    private voice: VoiceStore,
  ) {
    makeAutoObservable<this, 'drive' | 'lang' | 'settings' | 'voice'>(this, {
      drive: false, lang: false, settings: false, voice: false,
    }, { autoBind: true });

    voice.onWord = (word: string) => this.handleInput(word, true);

    // A new sheet resets the cursor and (once) stamps the template header.
    reaction(
      () => this.sheet?.sheetName,
      name => { if (name) this.onSheetChanged(); }
    );

    // Moving the cursor announces the column header and clears the pending value.
    reaction(
      () => [this.currentRow, this.currentCol] as const,
      () => {
        this.syncDropdownsFromRow();
        this.voice.speak(this.headers[this.currentCol]?.value ?? '', () => {
          runInAction(() => { this.currentValue = ''; });
        });
      }
    );
  }

  // ------------------------------------------------------------ sheet layout

  get sheet(): Sheet | null {
    return this.drive.sheet;
  }

  /** First row with a non-blank first column — the header row. */
  get headerRowIndex(): number {
    const values = this.sheet?.values ?? [];
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] != null && values[i][0].value.trim() !== '') return i;
    }
    return 0;
  }

  /** One past the header row: where data starts. */
  get firstDataRow(): number {
    return this.headerRowIndex + 1;
  }

  /** First fully-blank row after the headers — everything below it is commentary. */
  get commentRowIndex(): number {
    const values = this.sheet?.values ?? [];
    for (let i = this.firstDataRow; i < values.length; i++) {
      if (values[i].every(cell => cell == null || cell.value.trim() === '')) return i;
    }
    return values.length;
  }

  get headers(): Cell[] {
    return this.sheet?.values[this.headerRowIndex] ?? [];
  }

  get dataRows(): Cell[][] {
    return this.sheet?.values.slice(0, this.commentRowIndex) ?? [];
  }

  /**
   * Editable columns sit between the first and second blank header (past col 4).
   * Returns [min, max] inclusive.
   */
  get columnRange(): [number, number] {
    const headers = this.headers;
    let min = 0;
    let max = headers.length - 1;
    let foundFirst = false;
    for (let i = 4; i < headers.length; i++) {
      if (headers[i].value !== '') continue;
      if (!foundFirst) {
        min = i + 1;
        foundFirst = true;
      } else {
        max = i - 1;
        break;
      }
    }
    return [min, max];
  }

  get minCol() { return this.columnRange[0]; }
  get maxCol() { return this.columnRange[1]; }

  get hiddenRowSet() { return this.sheet?.hiddenRowSet ?? new Set<number>(); }
  get hiddenColSet() { return this.sheet?.hiddenColumnSet ?? new Set<number>(); }

  get currentCell(): Cell | undefined {
    return this.sheet?.cell(this.currentRow, this.currentCol);
  }

  get currentHeader(): string {
    return this.headers[this.currentCol]?.value ?? '';
  }

  get isFirstCell() {
    return this.currentRow === 0 && this.currentCol === 0;
  }

  get isLastCell() {
    return this.currentRow === this.dataRows.length - 1 && this.currentCol === this.headers.length - 1;
  }

  private isVisibleRow(i: number) {
    return !this.hiddenRowSet.has(i);
  }

  // ---------------------------------------------------------------- lifecycle

  private onSheetChanged() {
    this.resetPosition();
    if (!this.templateApplied) this.applyTemplate();
  }

  private resetPosition() {
    let row = this.firstDataRow;
    while (this.hiddenRowSet.has(row) && row < this.dataRows.length - 3) row++;
    let col = this.minCol;
    while (this.hiddenColSet.has(col) && col <= this.maxCol) col++;
    this.currentRow = row;
    this.currentCol = col;
    this.syncDropdownsFromRow();
  }

  /** Stamps place/plant/grower and faucet conductivity into the sheet header. */
  private applyTemplate() {
    const sheet = this.sheet;
    if (!sheet) return;

    const firstNonEmpty = (row: Cell[]) => {
      const i = row.findIndex(cell => cell.value !== '');
      return i === -1 ? 0 : i;
    };

    const topBarIndex = firstNonEmpty(sheet.values[0] ?? []);
    const faucetIndex = firstNonEmpty(sheet.values[1] ?? []);
    const { isTemplate, place, plant, grower, faucetConductivity } = this.settings;

    if (faucetConductivity !== '') {
      sheet.cell(1, faucetIndex + 1)?.setValue(`${faucetConductivity}`);
    }
    if (isTemplate) {
      sheet.cell(0, topBarIndex)?.setValue(`${place} - ${plant} - ${grower}`);
    }

    this.templateApplied = true;
    this.drive.saveProgress();
  }

  // ------------------------------------------------------------------ cursor

  setCurrentValue(value: string) {
    this.currentValue = value;
  }

  goToRow(row: number) {
    this.currentRow = row;
    this.currentCol = this.minCol;
  }

  /** True when the cell should be skipped: formula, hidden row, or hidden column. */
  private isSkippable(row: number, col: number) {
    return this.sheet?.cell(row, col)?.isFormula
      || this.hiddenColSet.has(col)
      || this.hiddenRowSet.has(row);
  }

  moveNext() {
    let row = this.currentRow;
    let col = this.currentCol;
    do {
      if (col < this.maxCol) col++;
      else if (row < this.dataRows.length - 3) { row++; col = this.minCol; }
      else return;
    } while (this.isSkippable(row, col));

    if (row !== this.currentRow) this.calcAverages();
    this.currentRow = row;
    this.currentCol = col;
  }

  movePrevious() {
    let row = this.currentRow;
    let col = this.currentCol;
    do {
      if (col > this.minCol) col--;
      else if (row > this.firstDataRow) { row--; col = this.maxCol; }
      else return;
    } while (this.isSkippable(row, col));

    this.currentRow = row;
    this.currentCol = col;
  }

  skip() {
    this.moveNext();
  }

  // ------------------------------------------------------------------- edits

  recordValue(value: string) {
    this.currentCell?.setValue(value);
    this.drive.saveProgress();
    toast({
      title: i18n.t('editor.valueRecorded'),
      description: i18n.t('editor.valueRecordedDesc', { header: this.currentHeader }),
    });
    this.currentValue = '';
    this.moveNext();
  }

  resetCurrentCell() {
    this.currentValue = '';
    this.currentCell?.setValue(null);
    this.drive.saveProgress();
  }

  /** Routes typed or spoken input to a command or to the pending cell value. */
  handleInput(value: string, fromVoice = false) {
    const { skip, back, delete: del, save } = this.lang.commands;
    const lower = value.toLowerCase();
    const matches = (cmds: string[]) => cmds.some(c => lower.includes(c.toLowerCase()));

    if (matches(skip)) {
      this.skip();
      this.currentValue = '';
    } else if (matches(back)) {
      this.movePrevious();
      this.currentValue = '';
    } else if (matches(del)) {
      this.resetCurrentCell();
    } else if (matches(save)) {
      if (this.currentValue) this.recordValue(this.currentValue);
    } else {
      this.currentValue = value;
      if (fromVoice) {
        // Only commit if the cursor hasn't moved while the value was read back.
        const row = this.currentRow;
        const col = this.currentCol;
        this.voice.speak(value, () => {
          if (this.currentRow === row && this.currentCol === col) this.recordValue(value);
        });
      }
    }
  }

  async startRecording() {
    if (this.voice.isRecording) return;
    this.voice.unlockSpeechIOS();
    await this.voice.startRecording();
    toast({
      title: i18n.t('editor.recordingStarted'),
      description: i18n.t('editor.recordingStartedDesc'),
    });
  }

  async stopRecording() {
    if (this.voice.isRecording) await this.voice.stopRecording();
  }

  notifySaved() {
    toast({
      title: i18n.t('editor.progressSaved'),
      description: i18n.t('editor.progressSavedDesc'),
    });
  }

  /** Averages each editable column into the summary row and colours it by target. */
  calcAverages() {
    const sheet = this.sheet;
    if (!sheet) return;
    const rows = this.dataRows.length;

    for (let col = this.minCol; col <= this.maxCol; col++) {
      let sum = 0;
      let count = 0;
      for (let row = this.firstDataRow; row <= rows - 3; row++) {
        const n = parseFloat(sheet.valueAt(row, col));
        if (!Number.isNaN(n)) { count++; sum += n; }
      }
      if (count === 0) continue;

      const average = sum / count;
      const target = sheet.valueAt(rows - 2, col).split('-');
      const inRange = target.length > 1
        ? average > parseFloat(target[0]) && average < parseFloat(target[1])
        : average < parseFloat(target[0]);

      const cell = sheet.cell(rows - 1, col);
      cell?.setValue(average.toFixed(2));
      cell?.mergeFormat({ backgroundColor: inRange ? '#00ff15ff' : '#ff0000ff' });
    }
  }

  async saveAndOpenSheet() {
    this.calcAverages();
    await this.drive.saveProgress();
    const fileId = this.drive.selectedFile?.id;
    if (fileId) window.location.href = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }

  // --------------------------------------------------------------- dropdowns

  /** Unique greenhouse names across visible data rows. */
  get optionsHamama(): string[] {
    const seen: string[] = [];
    for (let i = this.firstDataRow; i < this.dataRows.length; i++) {
      if (!this.isVisibleRow(i)) continue;
      const name = this.dataRows[i][0]?.value.trim();
      if (name && !seen.includes(name)) seen.push(name);
    }
    return seen;
  }

  /** Valves belonging to the selected greenhouse. */
  get optionsMagof(): string[] {
    const seen: string[] = [];
    if (this.selectedHamama == null) return seen;
    for (let i = this.firstDataRow; i < this.dataRows.length; i++) {
      if (!this.isVisibleRow(i)) continue;
      const row = this.dataRows[i];
      if (row[0]?.value.trim() !== this.selectedHamama.trim() || row[1] == null) continue;
      const valve = row[1].value.trim();
      if (!seen.includes(valve)) seen.push(valve);
    }
    return seen;
  }

  /** Crops on the selected greenhouse + valve. */
  get optionsGidul(): string[] {
    const found: string[] = [];
    if (this.selectedHamama == null || this.selectedMagof == null) return found;
    for (let i = this.firstDataRow; i < this.dataRows.length; i++) {
      if (!this.isVisibleRow(i)) continue;
      const row = this.dataRows[i];
      if (row[0]?.value.trim() === this.selectedHamama.trim() &&
          row[1]?.value.trim() === this.selectedMagof.trim()) {
        found.push(row[3]?.value ?? '');
      }
    }
    return found;
  }

  private syncDropdownsFromRow() {
    const row = this.dataRows[this.currentRow];
    if (!row) return;
    this.selectedHamama = row[0]?.value.trim() ?? null;
    this.selectedMagof = row[1]?.value.trim() ?? null;
    this.selectedGidul = row[3]?.value ?? null;
  }

  selectHamama(value: string) {
    this.selectedHamama = value;
    this.selectedMagof = this.optionsMagof[0] ?? null;
    this.selectedGidul = this.optionsGidul[0] ?? null;
    if (this.selectedGidul != null) this.navigateToSelection();
  }

  selectMagof(value: string) {
    this.selectedMagof = value;
    this.selectedGidul = this.optionsGidul[0] ?? null;
    if (this.selectedGidul != null) this.navigateToSelection();
  }

  selectGidul(value: string) {
    this.selectedGidul = value;
    this.navigateToSelection();
  }

  /** Jumps the cursor to the row matching the greenhouse/valve/crop selection. */
  private navigateToSelection() {
    for (let i = this.firstDataRow; i < this.dataRows.length; i++) {
      if (!this.isVisibleRow(i)) continue;
      const row = this.dataRows[i];
      if (row[0]?.value.trim() === this.selectedHamama?.trim() &&
          row[1]?.value.trim() === this.selectedMagof?.trim() &&
          row[3]?.value.trim() === this.selectedGidul) {
        this.goToRow(i);
        return;
      }
    }
  }

  // -------------------------------------------------------------- api import

  /** Finds the header column whose text contains an id word plus one of `words`. */
  private findColumn(words: string[]): number {
    const headers = this.sheet?.values[this.headerRowIndex] ?? [];
    return headers.findIndex(cell => {
      const text = cell.value;
      return ID_WORDS.some(w => text.includes(w)) && words.some(w => text.includes(w));
    });
  }

  private valueForHeader(colIndex: number, data: any, idsRowIndex: number): string | null {
    const id = this.sheet?.valueAt(idsRowIndex, colIndex) ?? '';
    const present = (v: any) => v !== undefined && v !== null;
    // Sheets store small quantities as-is and large ones in thousandths.
    const scale = (raw: any) => {
      const n = parseFloat(raw);
      return isNaN(n) ? null : (n < 100 ? n.toString() : (n / 1000).toString());
    };

    if (id === 'השקייה' || id === 'השקיה') {
      if (!present(data.waterDuration)) return null;
      if (!present(data.waterDosageMode)) return (data.waterDuration / 60).toString();
      // API may send the mode as a string, so keep the loose compare
      return data.waterDosageMode == 0
        ? convertSecondsToTimeFormat(data.waterDuration)
        : data.waterDuration.toString();
    }
    if (id === 'ספיקה') return present(data?.NominalFlow) ? scale(data.NominalFlow) : null;
    if (id === 'דשן') return present(data.fertQuant) ? scale(data.fertQuant) : null;
    if (id === 'מים') return present(data.waterQuantity) ? scale(data.waterQuantity) : null;
    if (id === 'תכנית' || id === 'תוכנית') return present(data.fertProgram) ? data.fertProgram.toString() : null;
    if (id === 'מחזור בימים' || id === 'מרווח בימים') return present(data.daysinterval) ? data.daysinterval.toString() : null;
    if (['השקיה ביום', 'השקיה ליום', 'השקיות ביום', 'מחזורים'].includes(id)) {
      return present(data.hourlyCyclesPerDay) ? data.hourlyCyclesPerDay.toString() : null;
    }

    const fertMatch = id.match(/^דשן\s?(\d+)$/);
    if (!fertMatch) return null;
    const index = parseInt(fertMatch[1], 10) - 1;
    if (!data.fertQuantities || data.fertQuantities.length <= index) return null;

    const quantity = parseFloat(data.fertQuantities[index]);
    if (isNaN(quantity)) return null;
    // Modes 3 and 6 dose by time, so the quantity is really seconds.
    const mode = data.fertLocalModes?.[index];
    // API may send the mode as a string, so keep the loose compare
    return (mode == 3 || mode == 6) ? convertSecondsToTimeFormat(quantity) : scale(quantity);
  }

  /** Pulls irrigation data from the controller API into the editable columns. */
  async fetchApiData() {
    const sheet = this.sheet;
    if (!sheet?.sheetName) return;

    const t = i18n.t.bind(i18n);
    const { locale, timeZone } = this.lang;
    const now = new Date();

    const stamp = sheet.cell(2, 2);
    stamp?.setValue(t('fetch.dataCollected') + now.toLocaleTimeString(locale, {
      timeZone, hour12: false, hour: '2-digit', minute: '2-digit',
    }));
    stamp?.mergeFormat({ backgroundColor: HIGHLIGHT });

    const dateCell = sheet.cell(2, 3);
    dateCell?.setValue(now.toLocaleDateString(locale, { timeZone }));
    dateCell?.mergeFormat({ backgroundColor: HIGHLIGHT });

    const [prefix, key, externalIDString] = sheet.valueAt(2, 1).split(':');

    try {
      const programIdCol = this.findColumn(['מגוף', 'תכנית', 'תוכנית']);
      const valveIdCol = this.findColumn(['ברז']);
      const bakarIdCol = this.findColumn(['בקר']);

      if (programIdCol === -1) {
        toast({ title: t('fetch.errorTitle'), description: t('fetch.noIdColumn') });
        return;
      }

      const idsRowIndex = sheet.values.findIndex(row => {
        const text = row[0]?.value ?? '';
        return (text.includes('נתונים') &&
                (text.includes('לשליפה') || text.includes('שליפה') || text.includes('לשלוף')))
               || text.includes('שליפת');
      });
      if (idsRowIndex === -1) {
        toast({ title: t('fetch.errorTitle'), description: t('fetch.noDataRow') });
        return;
      }

      const programIDs: number[] = [];
      const valveIDs: number[] = [];
      const externalIDs: number[] = [];
      const lastRow = this.dataRows.length - 2;

      for (let row = this.firstDataRow; row < lastRow; row++) {
        const programID = parseInt(sheet.valueAt(row, programIdCol));
        if (isNaN(programID)) continue;

        const rawValve = valveIdCol !== -1 ? sheet.valueAt(row, valveIdCol) : '';
        // Talgil valves are 1-based on the wire; every other platform is 0-based.
        const valveID = rawValve !== ''
          ? (prefix === 'talgil' ? parseInt(rawValve) : parseInt(rawValve) - 1)
          : 0;

        programIDs.push(programID);
        valveIDs.push(valveID);
        externalIDs.push(bakarIdCol === -1
          ? parseInt(externalIDString)
          : parseInt(sheet.valueAt(row, bakarIdCol)));
      }

      const { data, error } = await supabase.functions.invoke('fetch-data-from-api', {
        body: { platform: prefix, externalIDs, programIDs, APIKey: key, valveIDs },
      });

      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json();
        toast({ title: body?.error || error.message, description: '' });
        return;
      }

      const extracted = JSON.parse(data);
      const rowErrors: string[] = [];
      let dataIndex = 0;

      for (let row = this.firstDataRow; row < lastRow; row++) {
        if (dataIndex >= extracted.length) break;
        if (sheet.valueAt(row, programIdCol) === '') continue;

        const entry = extracted[dataIndex++];
        if (entry.error) {
          rowErrors.push(`שורה ${row + 1} (תכנית ${sheet.valueAt(row, programIdCol)}): ${entry.error}`);
          continue;
        }

        for (let col = 4; col < this.minCol - 1; col++) {
          const value = this.valueForHeader(col, entry, idsRowIndex);
          if (value === null) continue;
          const cell = sheet.cell(row, col);
          cell?.setValue(value);
          const type = detectValueType(value);
          const format = { ...cell?.formatting, backgroundColor: HIGHLIGHT } as any;
          if (type) format.type = type; else delete format.type;
          cell?.setFormat(format);
        }
      }

      await this.drive.saveProgress(true);

      if (rowErrors.length > 0) {
        toast({
          title: t('fetch.partialData'),
          description: rowErrors.join('\n'),
          variant: 'destructive',
          duration: 10000,
        });
      } else {
        toast({ title: t('fetch.successTitle'), description: '' });
      }
    } catch (err) {
      toast({ title: i18n.t('fetch.errorFetching'), description: '' });
      console.error('Error fetching data from API:', err);
    }
  }
}
