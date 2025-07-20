import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useEffect } from "react";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();

  // Debug logging
  useEffect(() => {
    console.log('Index component - sheetData changed:', sheetData);
    console.log('Index component - selectedFile:', selectedFile);
    console.log('Index component - should show editor:', !!sheetData);
  }, [sheetData, selectedFile]);

  const handleBackToHome = () => {
    console.log('Going back to home screen');
    clearSheetData();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            {/* Header with file info */}
            <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    Editing: {selectedFile?.name}
                  </h1>
                  <p className="text-gray-600">
                    Sheet: {sheetData?.sheetName} • {sheetData ? sheetData.values.length - 1 : 0} data rows
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={handleBackToHome}
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Back to Home
                  </Button>
                </div>
              </div>
            </div>

            {/* Sheet Data Editor */}
            {sheetData && <SheetDataEditor sheetData={sheetData} />}
          </div>
      </div>
    </div>
  );
};

export default InteractivePage;
