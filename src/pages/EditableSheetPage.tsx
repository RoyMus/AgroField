import { useNavigate } from "react-router-dom";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ModifiedDataProvider } from "@/contexts/ModifiedDataContext";
import EditableSheetTable from "@/components/EditableSheetTable";
import SheetSelector from "@/components/SheetSelector";
import { useCallback } from "react";

const EditableSheetPage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, handleSaveProgress, readSheet, isLoading } = useGoogleDrive();

  const handleBackToInteractive = () => {
    navigate(-1); // Go back to previous page
  };

  const handleSheetChange = useCallback(async (sheetName: string) => {
    if (selectedFile) {
      try {
        await readSheet(selectedFile.id, sheetName);
        // Don't clear modifications - we're tracking all sheets now
      } catch (error) {
        console.error('Error switching sheet:', error);
      }
    }
  }, [selectedFile, readSheet]);

  if (!sheetData || !selectedFile) {
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
      <div className="w-full px-6 py-8">
        <div className="space-y-6 h-full">
          {/* Header - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Button 
                onClick={handleBackToInteractive}
                variant="outline" 
                size="sm"
                className="h-10 w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Back to Preview</span>
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-800 truncate">
                    Edit Sheet: {selectedFile.name}
                  </h1>
                  {sheetData.metadata?.availableSheets && (
                    <SheetSelector
                      availableSheets={sheetData.metadata.availableSheets}
                      currentSheet={sheetData.sheetName}
                      onSheetSelect={handleSheetChange}
                      isLoading={isLoading}
                      disabled={isLoading}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Make changes locally without affecting the original sheet
                </p>
              </div>
            </div>
          </div>
          {/* Editable Table */}
          <ModifiedDataProvider sheetName={sheetData.sheetName}>
            <EditableSheetTable sheetData={sheetData} onSaveProgress={handleSaveProgress} />
          </ModifiedDataProvider>
        </div>
      </div>
    </div>
  );
};

export default EditableSheetPage;