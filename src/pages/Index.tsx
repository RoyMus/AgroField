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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
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
                    AgroField
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
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default Index;
