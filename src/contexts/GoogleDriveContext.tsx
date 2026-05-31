import { createContext, useContext, ReactNode } from 'react';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

type GoogleDriveContextType = ReturnType<typeof useGoogleDrive>;

const GoogleDriveContext = createContext<GoogleDriveContextType | null>(null);

export const GoogleDriveProvider = ({ children }: { children: ReactNode }) => {
  const value = useGoogleDrive();
  return (
    <GoogleDriveContext.Provider value={value}>
      {children}
    </GoogleDriveContext.Provider>
  );
};

export const useGoogleDriveContext = (): GoogleDriveContextType => {
  const ctx = useContext(GoogleDriveContext);
  if (!ctx) throw new Error('useGoogleDriveContext must be used within GoogleDriveProvider');
  return ctx;
};
