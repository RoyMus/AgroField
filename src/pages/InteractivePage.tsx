import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import { useEffect } from "react";
import { Cell } from "recharts";

const InteractivePage = () => {
  const{
    isTemplate,
    plant,
    grower,
    place,
  } = getData(false, null, null, null, null);
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();
  const placeGrowerPlantRowIndex = 0;
  /*if (!isTemplate)
  {
    for (let i = 0; i < sheetData.values[placeGrowerPlantRowIndex].length; i++) {
      if (sheetData.values[placeGrowerPlantRowIndex][i] != "")
      {
        let arr = sheetData.values[placeGrowerPlantRowIndex][i].split('-');
        //plant = arr[0].trim();
      }
    }
  }*/

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
                    {selectedFile?.name}
                  </h1>
                  <p className="text-gray-600">
                    {place} - {plant} - {grower}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={handleBackToHome}
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    חזור לדף הבית
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
