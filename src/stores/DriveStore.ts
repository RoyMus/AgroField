import { makeAutoObservable, runInAction } from 'mobx';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetData } from '@/types/cellTypes';
import { toast } from 'sonner';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

const cleanFileName = (name: string) =>
  name.replace(/\b(?:\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d{2,4}[-./]\d{1,2}[-./]\d{1,2})\b/g, ' ')
      .trim().replace(/\s\s+/g, ' ');

const formatToday = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export class DriveStore {
  sheet: Sheet | null = null;
  allSheets: Record<string, Sheet> | null = null;
  isAuthenticated = false;
  isLoading = false;
  isInitializing = true;
  files: DriveFile[] = [];
  selectedFile: DriveFile | null = null;
  error: string | null = null;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    this.init();
  }

  get availableSheets() {
    return this.sheet?.metadata?.availableSheets;
  }

  // ---------------------------------------------------------------- bootstrap

  private async init() {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code && !this.isAuthenticated && code !== sessionStorage.getItem('google_auth_code_used')) {
        sessionStorage.setItem('google_auth_code_used', code);
        await this.exchangeCode(code);
        return;
      }

      const savedToken = localStorage.getItem('google_drive_token');
      const savedRefresh = localStorage.getItem('google_drive_refresh_token');
      const expiresAt = parseInt(localStorage.getItem('google_drive_token_expires') || '0');
      const lastSheetName = localStorage.getItem('google_drive_last_sheet_name') || undefined;

      let file: DriveFile | null = null;
      const rawFile = localStorage.getItem('google_drive_selected_file');
      if (rawFile) {
        try {
          file = JSON.parse(rawFile);
          runInAction(() => { this.selectedFile = file; });
        } catch {
          localStorage.removeItem('google_drive_selected_file');
        }
      }

      if (savedRefresh) {
        runInAction(() => { this.refreshToken = savedRefresh; });
        const expired = !savedToken || expiresAt < Date.now() + 5 * 60 * 1000;
        if (expired) {
          const token = await this.refreshAccessToken();
          if (token && file) await this.readSheet(file.id, lastSheetName);
          return;
        }
      }

      if (savedToken) {
        runInAction(() => {
          this.accessToken = savedToken;
          this.isAuthenticated = true;
        });
        if (file) await this.readSheet(file.id, lastSheetName);
      }
    } finally {
      runInAction(() => { this.isInitializing = false; });
      if (this.isAuthenticated && this.files.length === 0) this.loadFiles();
    }
  }

  // ------------------------------------------------------------------- auth

  async authenticate() {
    try {
      this.isLoading = true;
      this.error = null;
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'getAuthUrl' }
      });
      if (error) throw error;
      window.location.href = data.authUrl;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to start authentication';
        this.isLoading = false;
      });
    }
  }

  private async exchangeCode(code: string) {
    try {
      runInAction(() => { this.isLoading = true; this.error = null; });
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'exchangeCode', code }
      });
      if (error) throw error;

      const { access_token, refresh_token, expires_in } = data;
      runInAction(() => {
        this.accessToken = access_token;
        this.isAuthenticated = true;
        if (refresh_token) this.refreshToken = refresh_token;
      });
      localStorage.setItem('google_drive_token', access_token);
      localStorage.setItem('google_drive_token_expires', String(Date.now() + ((expires_in || 3600) - 60) * 1000));
      if (refresh_token) localStorage.setItem('google_drive_refresh_token', refresh_token);

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Authentication failed';
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) return null;
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'refreshToken', refreshToken: this.refreshToken }
      });
      if (error) throw error;
      runInAction(() => {
        this.accessToken = data.access_token;
        this.isAuthenticated = true;
      });
      localStorage.setItem('google_drive_token', data.access_token);
      localStorage.setItem('google_drive_token_expires', String(Date.now() + 3590 * 1000));
      return data.access_token;
    } catch (err) {
      console.error('Failed to refresh token:', err);
      runInAction(() => {
        this.error = 'Session expired. Please re-authenticate.';
        this.isAuthenticated = false;
      });
      return null;
    }
  }

  /** Runs an API call with the current token, retrying once after a token refresh. */
  private async call<T>(apiCall: (token: string) => Promise<T>, retry = true): Promise<T> {
    const execute = async (token: string) => {
      const result: any = await apiCall(token);
      if (result && result.error) throw result.error;
      return result as T;
    };
    try {
      if (!this.accessToken) throw new Error('No access token available. Please authenticate first.');
      return await execute(this.accessToken);
    } catch (err) {
      if (retry && this.refreshToken) {
        const token = await this.refreshAccessToken();
        if (token) return await execute(token);
        throw new Error('Failed to refresh authentication. Please log in again.');
      }
      throw err;
    }
  }

  logout() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.files = [];
    this.selectedFile = null;
    this.sheet = null;
    this.allSheets = null;
    [
      'google_drive_token', 'google_drive_token_expires', 'google_drive_refresh_token',
      'google_drive_selected_file', 'all_sheet_modifications', 'all_sheet_styles',
      'google_drive_last_sheet_name',
    ].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('google_auth_code_used');
  }

  // ------------------------------------------------------------------ files

  async loadFiles() {
    if (!this.isAuthenticated) {
      this.error = 'Not authenticated. Please log in first.';
      return;
    }
    try {
      runInAction(() => { this.isLoading = true; this.error = null; });
      const { data, error } = await this.call(token =>
        supabase.functions.invoke('google-drive-auth', { body: { action: 'listFiles', accessToken: token } })
      );
      if (error) throw error;
      runInAction(() => { this.files = data.files || []; });
    } catch (err) {
      console.error('Failed to load files:', err);
      runInAction(() => {
        this.error = 'Failed to load files. Please try again.';
        this.files = [];
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  selectFile(file: DriveFile) {
    this.selectedFile = file;
    this.sheet = null;
    this.allSheets = null;
    localStorage.setItem('google_drive_selected_file', JSON.stringify(file));
    localStorage.removeItem('google_drive_last_sheet_name');
  }

  private async copyFile(fileId: string, newName: string): Promise<DriveFile | null> {
    try {
      const { data, error } = await this.call(token =>
        supabase.functions.invoke('google-drive-auth', {
          body: { action: 'copyFile', accessToken: token, fileId, newFileName: newName }
        })
      );
      if (error) throw error;
      return data.copiedFile;
    } catch (err) {
      console.error('Failed to copy file:', err);
      runInAction(() => { this.error = 'Failed to copy file. Please try again.'; });
      return null;
    }
  }

  // ----------------------------------------------------------------- sheets

  async readSheet(fileId: string, sheetName?: string) {
    try {
      runInAction(() => { this.isLoading = true; this.error = null; });
      if (!this.accessToken) throw new Error('No access token available. Please authenticate first.');

      const { data, error } = await this.call(token =>
        supabase.functions.invoke('google-drive-auth', {
          body: { action: 'readAllSheets', accessToken: token, fileId }
        })
      );
      if (error) throw error;

      const sheets: Record<string, Sheet> = {};
      data.sheets.forEach((raw: SheetData) => {
        // Pad short rows so every row is rectangular before wrapping in Cells.
        const width = raw.values.reduce((max, row) => Math.max(max, row.length), 0);
        raw.values.forEach(row => {
          for (let c = row.length; c < width; c++) row[c] = '';
        });
        sheets[raw.sheetName] = new Sheet(raw);
      });

      const resolved = (sheetName && sheets[sheetName]) ? sheetName : Object.keys(sheets)[0];
      runInAction(() => {
        this.allSheets = sheets;
        this.sheet = sheets[resolved];
      });
      if (resolved) localStorage.setItem('google_drive_last_sheet_name', resolved);
    } catch (err) {
      console.error('Error in readSheet:', err);
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to read sheet';
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async loadSheetByName(sheetName: string) {
    localStorage.setItem('google_drive_last_sheet_name', sheetName);
    if (!this.allSheets) {
      this.error = 'No sheet data to load';
      return;
    }
    this.sheet = this.allSheets[sheetName];
  }

  async loadAndCopySheet(sheetName?: string, copySheet?: boolean) {
    if (!this.selectedFile) {
      this.error = 'No file selected to load and copy.';
      return;
    }
    runInAction(() => { this.isLoading = true; });

    let copied: DriveFile | null;
    let newName: string;
    if (copySheet) {
      newName = `${cleanFileName(this.selectedFile.name)} ${formatToday()}`;
      copied = await this.copyFile(this.selectedFile.id, newName);
    } else {
      copied = this.selectedFile;
      newName = this.selectedFile.name;
    }

    if (copied) {
      runInAction(() => { this.selectedFile = copied; });
      localStorage.setItem('google_drive_selected_file', JSON.stringify(copied));
      await this.readSheet(copied.id, newName);
    } else {
      runInAction(() => { this.error = 'Failed to create a copy of the file. Please try again.'; });
    }
    runInAction(() => { this.isLoading = false; });
  }

  clearSheet() {
    this.sheet = null;
    this.allSheets = null;
    localStorage.removeItem('google_drive_last_sheet_name');
  }

  // ------------------------------------------------------------------- save

  /** Pushes every unsaved cell of the active sheet to Google Sheets. */
  async saveProgress(refreshAll = false) {
    const sheet = this.sheet;
    if (!sheet) return;

    if (this.allSheets) this.allSheets[sheet.sheetName] = sheet;
    if (!this.selectedFile) return;

    const updated: { row: number; column: number; value: string }[] = [];
    const formattingUpdates: { rowIndex: number; columnIndex: number; format: any }[] = [];
    const refreshedSheetData: string[][] = [];

    sheet.values.forEach((row, r) => {
      refreshedSheetData[r] = [];
      row.forEach((cell, c) => {
        if (!cell.saved) {
          updated.push({ row: r + 1, column: c + 1, value: cell.value });
          if (Object.keys(cell.formatting).length > 0) {
            formattingUpdates.push({ rowIndex: r, columnIndex: c, format: cell.formatting });
          }
          cell.markSaved();
        }
        refreshedSheetData[r][c] = cell.value;
      });
    });

    if (updated.length === 0 && formattingUpdates.length === 0 && !refreshAll) return;

    try {
      await this.call(token =>
        supabase.functions.invoke('google-drive-auth', {
          body: {
            action: 'updateSheet',
            accessToken: token,
            fileId: this.selectedFile!.id,
            sheetName: sheet.sheetName,
            rangeUpdates: updated,
            refreshAll,
            refreshedSheetData,
            formattingUpdates,
          }
        })
      );
    } catch (err) {
      toast('Failed to update sheet:', err as any);
    }
  }

  async createNewSheet(fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.selectedFile) return { success: false, error: 'Missing file data' };
    if (!this.allSheets) return { success: false, error: 'No sheet data to save' };

    const sheetList = Object.values(this.allSheets).map(sheet => {
      const formatting: { rowIndex: number; columnIndex: number; format: any }[] = [];
      sheet.values.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
          if (Object.keys(cell.formatting).length > 0) {
            formatting.push({ rowIndex, columnIndex, format: cell.formatting });
          }
        });
      });
      return {
        sheetName: sheet.sheetName,
        metadata: sheet.metadata,
        hiddenColumns: sheet.hiddenColumns,
        hiddenRows: sheet.hiddenRows,
        values: sheet.values.map(row => row.map(cell => cell.value)),
        formatting,
      };
    });

    try {
      const { data, error } = await this.call(token =>
        supabase.functions.invoke('create-google-sheet', {
          body: { accessToken: token, fileName, sheets: sheetList, originalFileId: this.selectedFile!.id }
        })
      );
      if (error) return { success: false, error: error.message || 'Failed to create new sheet' };
      if (data?.success) return { success: true, url: data.spreadsheetUrl };
      return { success: false, error: data?.error || 'Unknown error occurred' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
