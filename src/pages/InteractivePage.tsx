import { useNavigate } from "react-router-dom";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/topBar";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useEffect } from "react";
import { Cell } from "recharts";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();
  const placeGrowerPlantRowIndex = 0;

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
            {sheetData && <TopBar sheetData={sheetData} handleGoHome={handleBackToHome} selectedFile={selectedFile}/>}
            
            {/* Sheet Data Editor */}
            {sheetData && <SheetDataEditor sheetData={sheetData} />}
          {/* Edit Sheet Button */}
            {sheetData && (
              <div className="flex justify-center">
                <Button 
                  onClick={handleEditSheet}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit className="w-4 h-4" />
                  <span>Open Full Sheet Editor</span>
                </Button>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default InteractivePage;
