import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { ModifiedSheet, createModifiedSheet, getValue } from '@/types/cellTypes';
import { toast } from 'sonner';
import { useSheetData } from '@/contexts/SheetDataContext';

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface UseGoogleDriveReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  files: GoogleDriveFile[];
  selectedFile: GoogleDriveFile | null;
  sheetData: ModifiedSheet | null;
  error: string | null;
  authenticate: () => Promise<void>;
  selectFile: (file: GoogleDriveFile) => void;
  readSheet: (fileId: string, sheetName?: string) => Promise<void>;
  loadAndCopySheet: (sheetName?: string, copySheet?: boolean) => Promise<void>;
  logout: () => void;
  clearSheetData: () => void;
  createNewSheet: (fileName: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  handleSaveProgress: (newData: ModifiedSheet, refreshAll: boolean) => void;
  loadSheetByName: (sheetName: string) => Promise<void>;
}

export const useGoogleDrive = (): UseGoogleDriveReturn => {
  const { t } = useTranslation();
  const { sheetData, setSheetData, allSheets, setAllSheets } = useSheetData();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const usedCode = sessionStorage.getItem('google_auth_code_used');

      if (code && !isAuthenticated && code !== usedCode) {
        sessionStorage.setItem('google_auth_code_used', code);
        handleAuthCode(code);
        return;
      }

      const savedToken = localStorage.getItem('google_drive_token');
      const savedRefreshToken = localStorage.getItem('google_drive_refresh_token');
      const tokenExpiresAt = parseInt(localStorage.getItem('google_drive_token_expires') || '0');
      const savedFile = localStorage.getItem('google_drive_selected_file');
      const savedSheetData = localStorage.getItem('google_drive_sheet_data');

      if (savedFile) {
        try {
          setSelectedFile(JSON.parse(savedFile));
        } catch {
          localStorage.removeItem('google_drive_selected_file');
        }
      }

      // Only load from localStorage if context doesn't already have the data
      // (context already has data when navigating from home → workspace)
      if (!sheetData && savedSheetData) {
        try {
          const parsed: Record<string, ModifiedSheet> = JSON.parse(savedSheetData);
          const sheets = Object.values(parsed);
          if (sheets.length > 0) {
            setAllSheets(parsed);
            setSheetData(sheets[0]);
          }
        } catch {
          localStorage.removeItem('google_drive_sheet_data');
        }
      }

      if (savedRefreshToken) {
        setRefreshToken(savedRefreshToken);
        const isExpired = !savedToken || tokenExpiresAt < Date.now() + 5 * 60 * 1000;
        if (isExpired) {
          try {
            const { data, error } = await supabase.functions.invoke('google-drive-auth', {
              body: { action: 'refreshToken', refreshToken: savedRefreshToken }
            });
            if (!error && data?.access_token) {
              setAccessToken(data.access_token);
              setIsAuthenticated(true);
              localStorage.setItem('google_drive_token', data.access_token);
              localStorage.setItem('google_drive_token_expires', String(Date.now() + 3590 * 1000));
            }
          } catch (err) {
            console.error('Startup token refresh failed:', err);
          }
          return;
        }
      }

      if (savedToken) {
        setAccessToken(savedToken);
        setIsAuthenticated(true);
      }
    };

    init();
  }, []);

  const handleAuthCode = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'exchangeCode', code }
      });

      if (error) throw error;

      const { access_token, refresh_token, expires_in } = data;
      setAccessToken(access_token);
      setIsAuthenticated(true);
      localStorage.setItem('google_drive_token', access_token);
      localStorage.setItem('google_drive_token_expires', String(Date.now() + ((expires_in || 3600) - 60) * 1000));

      if (refresh_token) {
        setRefreshToken(refresh_token);
        localStorage.setItem('google_drive_refresh_token', refresh_token);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSheetByName = async (sheetName: string) => {
    localStorage.setItem('google_drive_last_sheet_name', sheetName);
    const sheets = allSheets ?? (() => {
      const raw = localStorage.getItem('google_drive_sheet_data');
      return raw ? JSON.parse(raw) : null;
    })();
    if (!sheets) {
      setError('No sheet data to load');
      return;
    }
    setSheetData(sheets[sheetName]);
  };

  const authenticate = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'getAuthUrl' }
      });

      if (error) throw error;

      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start authentication');
      setIsLoading(false);
    }
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;

    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'refreshToken', refreshToken }
      });

      if (error) throw error;

      const { access_token } = data;
      setAccessToken(access_token);
      localStorage.setItem('google_drive_token', access_token);
      localStorage.setItem('google_drive_token_expires', String(Date.now() + 3590 * 1000));
      return access_token;
    } catch (err) {
      console.error('Failed to refresh token:', err);
      setError('Session expired. Please re-authenticate.');
      setIsAuthenticated(false);
      return null;
    }
  };

  const makeApiCall = async (apiCall: (token: string) => Promise<any>, retryOnError = true): Promise<any> => {
    const execute = async (token: string) => {
      const result = await apiCall(token);
      if (result && result.error) throw result.error;
      return result;
    };

    try {
      if (!accessToken) throw new Error('No access token available. Please authenticate first.');
      return await execute(accessToken);
    } catch (err: any) {
      if (retryOnError && refreshToken) {
        const newToken = await refreshAccessToken();
        if (newToken) return await execute(newToken);
        throw new Error('Failed to refresh authentication. Please log in again.');
      }
      throw err;
    }
  };

  const loadFiles = async () => {
    if (!isAuthenticated) {
      setError('Not authenticated. Please log in first.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await makeApiCall(async (token: string) => {
        const { data, error } = await supabase.functions.invoke('google-drive-auth', {
          body: { action: 'listFiles', accessToken: token }
        });
        if (error) throw error;
        setFiles(data.files || []);
      });
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to load files. Please try again.');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyFile = async (fileId: string, newName: string): Promise<GoogleDriveFile | null> => {
    try {
      const { data, error } = await makeApiCall(async (token: string) => {
        return await supabase.functions.invoke('google-drive-auth', {
          body: { action: 'copyFile', accessToken: token, fileId, newFileName: newName }
        });
      });
      if (error) throw error;
      return data.copiedFile;
    } catch (err) {
      console.error('Failed to copy file:', err);
      setError('Failed to copy file. Please try again.');
      return null;
    }
  };

  const selectFile = (file: GoogleDriveFile) => {
    setSelectedFile(file);
    localStorage.setItem('google_drive_selected_file', JSON.stringify(file));
    setSheetData(null);
    setAllSheets(null);
    localStorage.removeItem('google_drive_sheet_data');
    localStorage.removeItem('google_drive_last_sheet_name');
  };

  const readSheet = async (fileId: string, sheetName?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!accessToken) throw new Error('No access token available. Please authenticate first.');

      await makeApiCall(async (token: string) => {
        const { data: originalFileData, error: fetchError } = await supabase.functions.invoke('google-drive-auth', {
          body: { action: 'readAllSheets', accessToken: token, fileId }
        });

        if (fetchError) throw fetchError;

        const processedSheets: Record<string, ModifiedSheet> = {};

        originalFileData.sheets.forEach((sheet: any) => {
          let maxLength = 0;
          for (let i = 0; i < sheet.values.length; i++) {
            maxLength = Math.max(maxLength, sheet.values[i].length);
          }
          for (let i = 0; i < sheet.values.length; i++) {
            for (let j = sheet.values[i].length; j < maxLength; j++) {
              sheet.values[i][j] = '';
            }
          }
          processedSheets[sheet.sheetName] = createModifiedSheet(sheet);
        });

        const resolvedSheetName = (sheetName && processedSheets[sheetName])
          ? sheetName
          : Object.keys(processedSheets)[0];

        setAllSheets(processedSheets);
        setSheetData(processedSheets[resolvedSheetName]);

        if (resolvedSheetName) {
          localStorage.setItem('google_drive_last_sheet_name', resolvedSheetName);
        }
        try {
          localStorage.setItem('google_drive_sheet_data', JSON.stringify(processedSheets));
        } catch {
          toast.warning(t('files.fileTooLargeToCache'));
        }
      });
    } catch (err) {
      console.error('Error in readSheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to read sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanFileName = (name: string): string => {
    const dateRegex = /\b(?:\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d{2,4}[-./]\d{1,2}[-./]\d{1,2})\b/g;
    return name.replace(dateRegex, ' ').trim().replace(/\s\s+/g, ' ');
  };

  const formatToday = (): string => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${today.getFullYear()}`;
  };

  const loadAndCopySheet = async (sheetName?: string, copySheet?: boolean) => {
    if (!selectedFile) {
      setError('No file selected to load and copy.');
      return;
    }
    setIsLoading(true);
    let copied: GoogleDriveFile | null;
    let newName: string;

    if (copySheet) {
      newName = `${cleanFileName(selectedFile.name)} ${formatToday()}`;
      copied = await copyFile(selectedFile.id, newName);
    } else {
      copied = selectedFile;
      newName = selectedFile.name;
    }

    if (copied) {
      setSelectedFile(copied);
      localStorage.setItem('google_drive_selected_file', JSON.stringify(copied));
      await readSheet(copied.id, newName);
    } else {
      setError('Failed to create a copy of the file. Please try again.');
    }
    setIsLoading(false);
  };

  const clearSheetData = () => {
    setSheetData(null);
    setAllSheets(null);
    localStorage.removeItem('google_drive_sheet_data');
    localStorage.removeItem('google_drive_last_sheet_name');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAccessToken(null);
    setRefreshToken(null);
    setFiles([]);
    setSelectedFile(null);
    setSheetData(null);
    setAllSheets(null);
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_token_expires');
    localStorage.removeItem('google_drive_refresh_token');
    localStorage.removeItem('google_drive_selected_file');
    localStorage.removeItem('google_drive_sheet_data');
    localStorage.removeItem('all_sheet_modifications');
    localStorage.removeItem('all_sheet_styles');
    localStorage.removeItem('google_drive_last_sheet_name');
    sessionStorage.removeItem('google_auth_code_used');
  };

  const createNewSheet = async (fileName: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!selectedFile) return { success: false, error: 'Missing file data' };

    const raw = localStorage.getItem('google_drive_sheet_data');
    const sheets = raw ? JSON.parse(raw) : allSheets;
    if (!sheets) return { success: false, error: 'No sheet data to save' };

    const sheetList = Object.entries(sheets).map(([, sheet]: [string, ModifiedSheet]) => {
      const values = sheet.values.map((row: any[]) => row.map(cell => getValue(cell)));
      const formatting: { rowIndex: number; columnIndex: number; format: any }[] = [];
      sheet.values.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
          if (cell?.formatting && Object.keys(cell.formatting).length > 0) {
            formatting.push({ rowIndex, columnIndex, format: cell.formatting });
          }
        });
      });
      return { ...sheet, values, formatting };
    });

    try {
      const { data, error } = await makeApiCall(async (token: string) => {
        return await supabase.functions.invoke('create-google-sheet', {
          body: { accessToken: token, fileName, sheets: sheetList, originalFileId: selectedFile.id }
        });
      });

      if (error) return { success: false, error: error.message || 'Failed to create new sheet' };
      if (data?.success) return { success: true, url: data.spreadsheetUrl };
      return { success: false, error: data?.error || 'Unknown error occurred' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken && files.length === 0) {
      loadFiles();
    }
  }, [isAuthenticated, accessToken]);

  const updateSheet = async (
    fileId: string,
    sheetName: string,
    updated: { row: number; column: number; value: string }[],
    refreshAll: boolean,
    refreshedSheetData: string[][],
    formattingUpdates: { rowIndex: number; columnIndex: number; format: any }[] = []
  ) => {
    try {
      await makeApiCall(async (token: string) => {
        return await supabase.functions.invoke('google-drive-auth', {
          body: {
            action: 'updateSheet',
            accessToken: token,
            fileId,
            sheetName,
            rangeUpdates: updated,
            refreshAll,
            refreshedSheetData,
            formattingUpdates,
          }
        });
      });
    } catch (err) {
      toast('Failed to update sheet:', err);
    }
  };

  const handleSaveProgress = async (newData: ModifiedSheet, refreshAll: boolean) => {
    setSheetData(newData);

    const raw = localStorage.getItem('google_drive_sheet_data');
    const updatedSheets = raw
      ? JSON.parse(raw)
      : allSheets ? { ...allSheets } : null;

    if (!updatedSheets) return;

    updatedSheets[newData.sheetName] = newData;
    setAllSheets(updatedSheets);

    try {
      localStorage.setItem('google_drive_sheet_data', JSON.stringify(updatedSheets));
    } catch {
      // Data stays in context; localStorage is best-effort
    }

    if (!selectedFile) return;

    const updated: { row: number; column: number; value: string }[] = [];
    const formattingUpdates: { rowIndex: number; columnIndex: number; format: any }[] = [];
    const refreshedSheetData: string[][] = [];

    for (let r = 0; r < newData.values.length; r++) {
      refreshedSheetData[r] = [];
      for (let c = 0; c < newData.values[r].length; c++) {
        if (!newData.values[r][c].saved) {
          updated.push({ row: r + 1, column: c + 1, value: getValue(newData.values[r][c]) });
          if (newData.values[r][c].formatting && Object.keys(newData.values[r][c].formatting).length > 0) {
            formattingUpdates.push({ rowIndex: r, columnIndex: c, format: newData.values[r][c].formatting });
          }
          newData.values[r][c].saved = true;
        }
        refreshedSheetData[r][c] = getValue(newData.values[r][c]);
      }
    }

    if (updated.length > 0 || formattingUpdates.length > 0 || refreshAll) {
      await updateSheet(selectedFile.id, newData.sheetName, updated, refreshAll, refreshedSheetData, formattingUpdates);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    files,
    selectedFile,
    sheetData,
    error,
    authenticate,
    selectFile,
    readSheet,
    loadAndCopySheet,
    logout,
    clearSheetData,
    createNewSheet,
    handleSaveProgress,
    loadSheetByName,
  };
};
