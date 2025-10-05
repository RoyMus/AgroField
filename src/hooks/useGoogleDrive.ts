import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface SheetTab {
  id: number;
  title: string;
  index: number;
}

interface SheetData {
  sheetName: string;
  values: string[][];
  metadata: {
    title: string;
    sheetCount: number;
    availableSheets?: SheetTab[];
  };
  formatting?: Array<{
    rowIndex: number;
    columnIndex: number;
    format: any;
  }>;
}

interface UseGoogleDriveReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  files: GoogleDriveFile[];
  selectedFile: GoogleDriveFile | null;
  sheetData: SheetData | null;
  error: string | null;
  authenticate: () => Promise<void>;
  selectFile: (file: GoogleDriveFile) => void;
  readSheet: (fileId: string, sheetName?: string) => Promise<void>;
  logout: () => void;
  clearSheetData: () => void;
  createNewSheet: (fileName: string, modifiedData: Record<string, any>) => Promise<{ success: boolean; url?: string; error?: string }>;
  handleSaveProgress: (newData: SheetData) => void;
}

export const useGoogleDrive = (): UseGoogleDriveReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Check URL for authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && !isAuthenticated) {
      handleAuthCode(code);
      return;
    }

    // Load saved state
    const savedToken = localStorage.getItem('google_drive_token');
    const savedFile = localStorage.getItem('google_drive_selected_file');
    const savedSheetData = localStorage.getItem('google_drive_sheet_data');
    
    console.log('Loading saved state:', { savedToken: !!savedToken, savedFile: !!savedFile, savedSheetData: !!savedSheetData });
    
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
        console.log('Setting saved sheet data:', parsedSheetData);
        setSheetData(parsedSheetData);
      } catch (err) {
        console.error('Error parsing saved sheet data:', err);
        localStorage.removeItem('google_drive_sheet_data');
      }
    }
    
    // Set authentication state and token if available
    if (savedToken) {
      setAccessToken(savedToken);
      setIsAuthenticated(true);
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

      const { access_token } = data;
      setAccessToken(access_token);
      setIsAuthenticated(true);
      localStorage.setItem('google_drive_token', access_token);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load files
      await loadFiles(access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
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

  const loadFiles = async (token: string = accessToken!) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'listFiles', accessToken: token }
      });

      if (error) throw error;

      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
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
      
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'readSheet', accessToken, fileId, sheetName }
      });

      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      console.log('Sheet data received from API:', data);
      
      // Set the sheet data immediately for responsive UI

      setSheetData(data);
      localStorage.setItem('google_drive_sheet_data', JSON.stringify(data));
      
      console.log('Sheet data set successfully, triggering re-render');
      
    } catch (err) {
      console.error('Error in readSheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to read sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSheetData = () => {
    console.log('Clearing sheet data manually');
    setSheetData(null);
    localStorage.removeItem('google_drive_sheet_data');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAccessToken(null);
    setFiles([]);
    setSelectedFile(null);
    setSheetData(null);
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_selected_file');
    localStorage.removeItem('google_drive_sheet_data');
  };

  const createNewSheet = async (fileName: string, modifiedData: Record<string, any>): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!accessToken || !selectedFile) {
      return { success: false, error: 'Missing authentication or file data' };
    }

    try {
      // Get all modifications for all sheets
      const allModifications = localStorage.getItem('all_sheet_modifications');
      const allSheetModifications = allModifications ? JSON.parse(allModifications) : {};
      
      // Get all styles for all sheets
      const allStylesData = localStorage.getItem('all_sheet_styles');
      const allSheetStyles = allStylesData ? JSON.parse(allStylesData) : {};

      // Fetch all sheets from the original file
      const { data: originalFileData, error: fetchError } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'readAllSheets', accessToken, fileId: selectedFile.id }
      });

      if (fetchError) throw fetchError;

      // Process each sheet with its modifications
      const processedSheets = originalFileData.sheets.map((sheet: any) => {
        const sheetName = sheet.sheetName;
        const modifications = allSheetModifications[sheetName] || {};
        const styles = allSheetStyles[sheetName] || sheet.formatting || [];

        // Apply modifications to the sheet data
        const updatedValues = [...sheet.values];
        Object.entries(modifications).forEach(([cellKey, modification]: [string, any]) => {
          const [rowIndex, columnIndex] = cellKey.split('-').map(Number);
          if (!updatedValues[rowIndex]) {
            updatedValues[rowIndex] = [];
          }
          updatedValues[rowIndex][columnIndex] = modification.modifiedValue;
        });

        return {
          ...sheet,
          values: updatedValues,
          formatting: styles
        };
      });

      const { data, error } = await supabase.functions.invoke('create-google-sheet', {
        body: {
          accessToken,
          fileName,
          sheets: processedSheets,
          originalFileId: selectedFile.id
        }
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

  const handleSaveProgress = (newData: SheetData) => {
    setSheetData(newData);
    localStorage.setItem('google_drive_sheet_data', JSON.stringify(newData));
  };
  // Debug logging for sheetData changes
  useEffect(() => {
    console.log('Sheet data changed in hook:', sheetData);
    console.log('Should show editor:', !!sheetData);
  }, [sheetData]);

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
    logout,
    clearSheetData,
    createNewSheet,
    handleSaveProgress
  };
};
