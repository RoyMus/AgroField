
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface SheetData {
  sheetName: string;
  values: string[][];
  metadata: {
    title: string;
    sheetCount: number;
  };
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
  readSheet: (fileId: string) => Promise<void>;
  logout: () => void;
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
      return; // Don't load saved state yet, wait for auth to complete
    }

    // Load saved state - do this regardless of authentication status
    const savedToken = localStorage.getItem('google_drive_token');
    const savedFile = localStorage.getItem('google_drive_selected_file');
    const savedSheetData = localStorage.getItem('google_drive_sheet_data');
    
    console.log('Loading saved state:', { savedToken: !!savedToken, savedFile: !!savedFile, savedSheetData: !!savedSheetData });
    
    // Always load saved file and sheet data if they exist
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
    
    // Clear previous sheet data when selecting a new file
    console.log('Clearing previous sheet data');
    setSheetData(null);
    localStorage.removeItem('google_drive_sheet_data');
  };

  const readSheet = async (fileId: string) => {
    try {
      console.log('Starting readSheet for fileId:', fileId);
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'readSheet', accessToken, fileId }
      });

      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      console.log('Sheet data received:', data);
      
      // Update state immediately and force re-render
      setSheetData(data);
      localStorage.setItem('google_drive_sheet_data', JSON.stringify(data));
      
      console.log('Sheet data set successfully');
    } catch (err) {
      console.error('Error in readSheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to read sheet');
    } finally {
      setIsLoading(false);
    }
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

  useEffect(() => {
    if (isAuthenticated && accessToken && files.length === 0) {
      loadFiles();
    }
  }, [isAuthenticated, accessToken]);

  // Debug logging for sheetData changes
  useEffect(() => {
    console.log('Sheet data changed in hook:', sheetData);
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
  };
};
