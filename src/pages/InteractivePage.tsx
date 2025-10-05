import { useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/TopBarr";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData, readSheet, isLoading} = useGoogleDrive();
  const [saveProgressFunc, setSaveProgressFunc] = useState<(() => void) | null>(null);
  const [saveToNewSheetFunc, setSaveToNewSheetFunc] = useState<(() => void) | null>(null);

  const handleSheetChange = useCallback((sheetName: string) => {
    // Clear modifications when switching sheets
    localStorage.removeItem('all_sheet_modifications');
  }, []);

  const handleBackToHome = () => {
    console.log('Going back to home screen');
    clearSheetData();
    navigate("/");
  };

  const handleEditSheet = () => {
    navigate("/edit-sheet");
  };
  
  if (!sheetData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">No Sheet Data Available</h1>
            <p className="text-gray-600 mb-6">Please select a Google Sheet first.</p>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
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
