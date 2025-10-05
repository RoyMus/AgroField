import { useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/TopBarr";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData, readSheet, isLoading} = useGoogleDrive();
  const [saveProgressFunc, setSaveProgressFunc] = useState<(() => void) | null>(null);
  const [saveToNewSheetFunc, setSaveToNewSheetFunc] = useState<(() => void) | null>(null);

  const handleSheetChange = useCallback((sheetName: string) => {
    // Clear modifications when switching sheets
    localStorage.removeItem('sheet_cell_modifications');
  }, []);

  const handleBackToHome = () => {
    console.log('Going back to home screen');
    clearSheetData();
    navigate("/");
  };

  const handleEditSheet = () => {
    navigate("/edit-sheet");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            {/* Header With File info */}
            {sheetData && (
              <TopBar 
                sheetData={sheetData} 
                handleGoHome={handleBackToHome} 
                selectedFile={selectedFile} 
                onOpenEditor={handleEditSheet}
                onSaveProgress={saveProgressFunc}
                onSaveToNewSheet={saveToNewSheetFunc}
                readSheet={readSheet}
                isLoading={isLoading}
              />
            )}
            
            {/* Sheet Data Editor */}
            {sheetData && (
              <SheetDataEditor 
                sheetData={sheetData}
                onSaveProgress={(func) => setSaveProgressFunc(() => func)}
                onSaveToNewSheet={(func) => setSaveToNewSheetFunc(() => func)}
                onSheetChange={handleSheetChange}
              />
            )}
          </div>
      </div>
    </div>
  );
};

export default InteractivePage;
