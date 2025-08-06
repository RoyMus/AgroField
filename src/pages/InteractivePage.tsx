import { useNavigate } from "react-router-dom";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/topBar";
import { getData } from "@/hooks/getData";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useEffect } from "react";
import { Cell } from "recharts";

const InteractivePage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();
  const placeGrowerPlantRowIndex = 0;
  const{
      isTemplate,
      plant,
      grower,
      place,
      } = getData(false, null, null, null, null);
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
            {/* Header With File info */}
            {sheetData && <TopBar handleGoHome={handleBackToHome} selectedFile={selectedFile}/>}
            {/* Sheet Data Editor */}
            {sheetData && <SheetDataEditor sheetData={sheetData} />}
          </div>
      </div>
    </div>
  );
};

export default InteractivePage;
