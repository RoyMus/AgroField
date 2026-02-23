import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ModifiedCell, ModifiedSheet,createModifiedSheet, getValue } from '@/types/cellTypes';
import { format } from 'path';
import { set } from 'date-fns';
import { ref } from 'process';
import { toast } from 'sonner';

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
  loadAndCopySheet: (sheetName?: string,copySheet?: boolean) => Promise<void>;
  logout: () => void;
  clearSheetData: () => void;
  createNewSheet: (fileName: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  handleSaveProgress: (newData: ModifiedSheet, refreshAll: boolean) => void;
  loadSheetByName: (sheetName: string) => Promise<void>;
}

export const useGoogleDrive = (): UseGoogleDriveReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [sheetData, setSheetData] = useState<ModifiedSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    // Check URL for authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    // Prevent reusing the same code
    const usedCode = sessionStorage.getItem('google_auth_code_used');
    
    if (code && !isAuthenticated && code !== usedCode) {
      sessionStorage.setItem('google_auth_code_used', code);
      handleAuthCode(code);
      return;
    }

    // Load saved state
    const savedToken = localStorage.getItem('google_drive_token');
    const savedRefreshToken = localStorage.getItem('google_drive_refresh_token');
    const savedFile = localStorage.getItem('google_drive_selected_file');
    const savedSheetData = localStorage.getItem('google_drive_sheet_data');
    
    console.log('Loading saved state:', { savedToken: !!savedToken, savedRefreshToken: !!savedRefreshToken, savedFile: !!savedFile, savedSheetData: !!savedSheetData });
    
    // Load saved file if it exists
    if (savedFile) {
      try {
        const parsedFile = JSON.parse(savedFile);
        console.log('Setting saved file:', parsedFile);
        setSelectedFile(parsedFile);
      } catch (err) {
        console.error('Error parsing saved file:', err);
        localStorage.removeItem('google_drive_selected_file');
      }
    }
    
    // Load saved sheet data if it exists
    if (savedSheetData) {
      try {
        const parsedSheetData = JSON.parse(savedSheetData);
        const values = Object.values(parsedSheetData);
        if(values.length > 0) {
          setSheetData(values[0] as ModifiedSheet);
        }
      } catch (err) {
        console.error('Error parsing saved sheet data:', err);
        localStorage.removeItem('google_drive_sheet_data');
      }
    }
    // Set authentication state and tokens if available
    if (savedToken) {
      setAccessToken(savedToken);
      setIsAuthenticated(true);
    }
    if (savedRefreshToken) {
      setRefreshToken(savedRefreshToken);
    }
  }, []);

  const handleAuthCode = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'exchangeCode', code }
      });

      if (error) throw error;

      const { access_token, refresh_token } = data;
      setAccessToken(access_token);
      setIsAuthenticated(true);
      localStorage.setItem('google_drive_token', access_token);
      
      if (refresh_token) {
        setRefreshToken(refresh_token);
        localStorage.setItem('google_drive_refresh_token', refresh_token);
      }
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load files
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };
  const loadSheetByName = async (sheetName: string) => {
    const processedSheets = localStorage.getItem('google_drive_sheet_data');
    if (!processedSheets) {
      setError('No sheet data to load');
      return;
    }
    const parsedSheets = JSON.parse(processedSheets);
    setSheetData(parsedSheets[sheetName]);
  }
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
    if (!refreshToken) {
      console.error('No refresh token available');
      return null;
    }

    try {
      console.log('Attempting to refresh access token');
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'refreshToken', refreshToken }
      });

      if (error) throw error;

      const { access_token } = data;
      setAccessToken(access_token);
      localStorage.setItem('google_drive_token', access_token);
      console.log('Access token refreshed successfully');
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
      // If the apiCall returns a supabase-like error object, throw it to be caught by the catch block.
      if (result && result.error) {
        throw result.error;
      }
      return result;
    };

    try {
      if (!accessToken) {
        console.error('makeApiCall: No access token available');
        throw new Error('No access token available. Please authenticate first.');
      }

      console.log('makeApiCall: Attempting API call with token');
      return await execute(accessToken);
    } catch (err: any) {
      // If we get a 401 or 403, try refreshing the token
      if (retryOnError && refreshToken) {
        
        console.log('makeApiCall: Token expired, attempting refresh');
        const newToken = await refreshAccessToken();
        
        if (newToken) {
          console.log('makeApiCall: Retrying with new token');
          return await execute(newToken);
        } else {
          console.error('makeApiCall: Token refresh failed');
          throw new Error('Failed to refresh authentication. Please log in again.');
        }
      }
      
      // Log the error before rethrowing
      console.error('makeApiCall error:', err);
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
          body: { 
            action: 'listFiles', 
            accessToken: token
          }
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
                body: {
                    action: 'copyFile',
                    accessToken: token,
                    fileId: fileId,
                    newFileName: newName,
                }
            });
        });

        if (error) {
            throw error;
        }

        return data.copiedFile;
    } catch (err) {
        console.error('Failed to copy file:', err);
        setError('Failed to copy file. Please try again.');
        return null;
    }
  };

  const selectFile = (file: GoogleDriveFile) => {
    console.log('Selecting file:', file);
    setSelectedFile(file);
    localStorage.setItem('google_drive_selected_file', JSON.stringify(file));
    
    // Clear previous sheet data immediately when selecting a new file
    console.log('Clearing previous sheet data due to file selection');
    setSheetData(null);
    localStorage.removeItem('google_drive_sheet_data');
  };

  const readSheet = async (fileId: string, sheetName?: string) => {
    try {
      console.log('Starting readSheet for fileId:', fileId, 'sheetName:', sheetName);
      setIsLoading(true);
      setError(null);
      
      if (!accessToken) {
        throw new Error('No access token available. Please authenticate first.');
      }
      
      await makeApiCall(async (token: string) => {
         const { data: originalFileData, error: fetchError} = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'readAllSheets', accessToken: token, fileId: fileId }
        });

        if (fetchError) throw fetchError;

        const processedSheets: Record<string, ModifiedSheet> = {};

        originalFileData.sheets.forEach((sheet: any) => {
          // Normalize row lengths
          let maxLength = 0;

          for (let i = 0; i < sheet.values.length; i++) {
            maxLength = Math.max(maxLength, sheet.values[i].length);
          }

          for (let i = 0; i < sheet.values.length; i++) {
            for (let j = sheet.values[i].length; j < maxLength; j++) {
              sheet.values[i][j] = "";
            }
          }

          // Create your ModifiedSheet
          const newSheetData: ModifiedSheet = createModifiedSheet(sheet);
          // Add to dictionary
          processedSheets[sheet.sheetName] = newSheetData;
        });

        setSheetData(processedSheets[sheetName]);
        localStorage.setItem('google_drive_sheet_data', JSON.stringify(processedSheets));
      
    });
  }
     catch (err) {
      console.error('Error in readSheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to read sheet');
    } finally {
      setIsLoading(false);
    }
  };
  const cleanFileName = (name: string): string => {
      const dateRegex =
        /\b(?:\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d{2,4}[-./]\d{1,2}[-./]\d{1,2})\b/g;
    
      const cleaned = name
        .replace(dateRegex, " ")
        .trim()
        .replace(/\s\s+/g, " "); // collapse extra spaces
    
      return cleaned;
  };
  function formatToday(): string {
    const today = new Date();

    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // months are 0-based
    const year = today.getFullYear();

    return `${day}/${month}/${year}`;
  }
  
  const loadAndCopySheet = async (sheetName?: string,copySheet?: boolean) => {
    if (!selectedFile) {
      setError('No file selected to load and copy.');
      return;
    }
    setIsLoading(true);
    let copied;
    let newName;
    if(copySheet)
    {
      newName = `${cleanFileName(selectedFile.name)} ${formatToday()}`;
      copied = await copyFile(selectedFile.id, newName);
    }
    else
    {
      copied = selectedFile;
      newName = selectedFile.name;
    }

    if (copied) {
        setSelectedFile(copied);
        localStorage.setItem('google_drive_selected_file', JSON.stringify(copied));
        await readSheet(copied.id, newName);
    } else {
        setError("Failed to create a copy of the file. Please try again.");
    }
    setIsLoading(false);
  };

  const clearSheetData = () => {
    console.log('Clearing sheet data manually');
    setSheetData(null);
    localStorage.removeItem('google_drive_sheet_data');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAccessToken(null);
    setRefreshToken(null);
    setFiles([]);
    setSelectedFile(null);
    setSheetData(null);
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_refresh_token');
    localStorage.removeItem('google_drive_selected_file');
    localStorage.removeItem('google_drive_sheet_data');
    localStorage.removeItem('all_sheet_modifications');
    localStorage.removeItem('all_sheet_styles');
    sessionStorage.removeItem('google_auth_code_used');
  };

  const createNewSheet = async (fileName: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!selectedFile) {
      return { success: false, error: 'Missing file data' };
    }
    const processedSheets = localStorage.getItem('google_drive_sheet_data');
    if (!processedSheets) {
      return { success: false, error: 'No sheet data to save' };
    }
    const parsedSheets = JSON.parse(processedSheets);
    const sheets = Object.entries(parsedSheets).map(([key, sheet]: [string, ModifiedSheet]) => {
      const values = sheet.values.map((row: any[]) =>
          row.map(cell => getValue(cell))
        );
        const formatting: { rowIndex: number; columnIndex: number; format: any }[] = [];
        sheet.values.forEach((row, rowIndex) => {
          row.forEach((cell, columnIndex) => {
            if (cell && cell.formatting && Object.keys(cell.formatting).length > 0) {
              formatting.push({
                rowIndex,
                columnIndex,
                format: cell.formatting,
              });
            }
          });
        });
        return {
          ...sheet,
          values: values,
          formatting: formatting
        };
      });
    try
    {
      const { data, error } = await makeApiCall(async (token: string) => {
        return await supabase.functions.invoke('create-google-sheet', {
          body: {
            accessToken: token,
            fileName,
            sheets: sheets,
            originalFileId: selectedFile.id
          }
        });
      });

      if (error) {
        console.error('Error creating new sheet:', error);
        return { success: false, error: error.message || 'Failed to create new sheet' };
      }

      if (data?.success) {
        return { success: true, url: data.spreadsheetUrl };
      } else {
        return { success: false, error: data?.error || 'Unknown error occurred' };
      }
    } catch (error) {
      console.error('Error in createNewSheet:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken && files.length === 0) {
      loadFiles();
    }
  }, [isAuthenticated, accessToken]);

  const updateSheet = async (fileId: string, sheetName: string, updated: { row: number; column: number; value: string }[], refreshAll: boolean, refreshedSheetData: string[][], formattingUpdates: { rowIndex: number; columnIndex: number; format: any }[] = []) => {
    try {
        await makeApiCall(async (token: string) => {
            return await supabase.functions.invoke('google-drive-auth', {
                body: {
                    action: 'updateSheet',
                    accessToken: token,
                    fileId: fileId,
                    sheetName: sheetName,
                    rangeUpdates: updated,
                    refreshAll: refreshAll,
                    refreshedSheetData: refreshedSheetData,
                    formattingUpdates: formattingUpdates
                }
            });
        });
    } catch (err) {
        toast('Failed to update sheet:', err);
    }
  };

  const handleSaveProgress = async (newData: ModifiedSheet, refreshAll: boolean) => {
    setSheetData(newData);
    const processedSheets = localStorage.getItem('google_drive_sheet_data');
    if (!processedSheets) {
        return;
    }
    const parsedSheets = JSON.parse(processedSheets);
    parsedSheets[newData.sheetName] = newData;
    localStorage.setItem('google_drive_sheet_data', JSON.stringify(parsedSheets));

    if (selectedFile) {
      const fileId = selectedFile.id;
      const updated = [];
      const formattingUpdates: { rowIndex: number; columnIndex: number; format: any }[] = [];
      const refreshedSheetData: string[][] = [];
      for(let r = 0; r < newData.values.length; r++) {
        refreshedSheetData[r] = [];
        for(let c = 0; c < newData.values[r].length; c++) {
          if (!newData.values[r][c].saved) {
            updated.push({row: r + 1, column: c + 1, value: getValue(newData.values[r][c])});
            // Collect formatting for unsaved cells that have formatting
            if (newData.values[r][c].formatting && Object.keys(newData.values[r][c].formatting).length > 0) {
              formattingUpdates.push({
                rowIndex: r,
                columnIndex: c,
                format: newData.values[r][c].formatting
            });
          }
          newData.values[r][c].saved = true;
        }
        refreshedSheetData[r][c] = getValue(newData.values[r][c]);
        }
      }
      if (updated.length > 0 || formattingUpdates.length > 0 || refreshAll) {
        await updateSheet(fileId, newData.sheetName, updated, refreshAll, refreshedSheetData, formattingUpdates);
      }
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