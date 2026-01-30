import { useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/TopBarr";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData, loadSheetByName, isLoading, handleSaveProgress} = useGoogleDrive();
  const [saveProgressFunc, setSaveProgressFunc] = useState<(() => void) | null>(null);
  const [saveToNewSheetFunc, setSaveToNewSheetFunc] = useState<(() => void) | null>(null);
  const [fetchSheetDataFunc, setFetchSheetDataFunc] = useState<(() => void) | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const handleSaveProgressSetter = useCallback((func: () => void) => {
    setSaveProgressFunc(() => func);
  }, []);

  const handleSaveToNewSheetSetter = useCallback((func: () => void) => {
    setSaveToNewSheetFunc(() => func);
  }, []);

  const handleFetchSheetDataSetter = useCallback((func: () => void) => {
    setFetchSheetDataFunc(() => func);
  }, []);

  // Track when loading completes
  useEffect(() => {
    if (isLoading) {
      return;
    }
    setHasLoadedOnce(true);
  }, [isLoading]);

  // Navigate home if no data after loading
  useEffect(() => {
    if (hasLoadedOnce && !isLoading && !sheetData) {
      console.log('No sheet data available after loading, redirecting to home');
      clearSheetData();
      navigate('/');
    }
  }, [sheetData, isLoading, hasLoadedOnce, navigate, clearSheetData]);

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
              <>
                <TopBar
                  sheetData={sheetData}
                  handleGoHome={handleBackToHome}
                  selectedFile={selectedFile}
                  onOpenEditor={handleEditSheet}
                  onSaveProgress={saveProgressFunc}
                  onSaveToNewSheet={saveToNewSheetFunc}
                  onFetchSheetData={fetchSheetDataFunc}
                  loadSheetByName={loadSheetByName}
                  isLoading={isLoading}
                />
                
                {/* Sheet Data Editor */}
                <SheetDataEditor
                  sheetData={sheetData}
                  onSaveProgress={handleSaveProgressSetter}
                  onSaveToNewSheet={handleSaveToNewSheetSetter}
                  onFetchSheetData={handleFetchSheetDataSetter}
                  handleSaveProgress={() => handleSaveProgress(sheetData)}
                  selectedFile={cleanFileName(selectedFile?.name || '')}
                />
              </>
            )}
          </div>
      </div>
    </div>
  );
};

export default InteractivePage;
