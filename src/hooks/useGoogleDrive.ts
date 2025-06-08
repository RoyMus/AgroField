
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  error: string | null;
  authenticate: () => Promise<void>;
  selectFile: (file: GoogleDriveFile) => void;
  logout: () => void;
}

export const useGoogleDrive = (): UseGoogleDriveReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Check URL for authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && !isAuthenticated) {
      handleAuthCode(code);
    }

    // Load saved state
    const savedToken = localStorage.getItem('google_drive_token');
    const savedFile = localStorage.getItem('google_drive_selected_file');
    
    if (savedToken) {
      setAccessToken(savedToken);
      setIsAuthenticated(true);
      
      if (savedFile) {
        setSelectedFile(JSON.parse(savedFile));
      }
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
    setSelectedFile(file);
    localStorage.setItem('google_drive_selected_file', JSON.stringify(file));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAccessToken(null);
    setFiles([]);
    setSelectedFile(null);
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_selected_file');
  };

  useEffect(() => {
    if (isAuthenticated && accessToken && files.length === 0) {
      loadFiles();
    }
  }, [isAuthenticated, accessToken]);

  return {
    isAuthenticated,
    isLoading,
    files,
    selectedFile,
    error,
    authenticate,
    selectFile,
    logout,
  };
};
