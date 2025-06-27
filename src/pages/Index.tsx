import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useEffect } from "react";

const Index = () => {
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
  };

  // Use sheetData directly for rendering decision
  const showEditor = !!sheetData;
  console.log('Render decision - showEditor:', showEditor, 'sheetData exists:', !!sheetData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
        {!showEditor ? (
          // Landing/Selection Phase
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center space-y-8 max-w-4xl">
              <div className="space-y-6">
                <div className="flex items-center justify-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-800 mb-4">
                  <span className="bg-gradient-to-r from-blue-600 via-green-600 to-red-600 bg-clip-text text-transparent">
                    Sheet Data Editor
                  </span>
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  Connect to Google Drive, select a spreadsheet, and edit your data row by row with local storage backup.
                </p>
              </div>
              
              <div className="pt-8">
                <GoogleDriveFilePicker />
              </div>
              
              <div className="pt-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <div className="w-6 h-6 bg-blue-500 rounded"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Read Sheet Data</h3>
                    <p className="text-gray-600 text-sm">Load and display column names and row data from your Google Sheets.</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <div className="w-6 h-6 bg-green-500 rounded"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Edit Row by Row</h3>
                    <p className="text-gray-600 text-sm">Navigate through rows with Next/Skip buttons and override values as needed.</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <div className="w-6 h-6 bg-red-500 rounded"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Local Storage</h3>
                    <p className="text-gray-600 text-sm">All modifications are automatically saved locally for safe data handling.</p>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  variant="outline"
                  onClick={() => navigate("/page/workspace")}
                  className="text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  Or explore our demo workspace
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Data Editing Phase
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
                  <GoogleDriveFilePicker />
                </div>
              </div>
            </div>

            {/* Sheet Data Editor */}
            {sheetData && <SheetDataEditor sheetData={sheetData} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
