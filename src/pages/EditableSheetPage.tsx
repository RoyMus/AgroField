import { useNavigate } from "react-router-dom";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import EditableSheetTable from "@/components/EditableSheetTable";

const EditableSheetPage = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile } = useGoogleDrive();

  const handleBackToInteractive = () => {
    navigate(-1); // Go back to previous page
  };

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
      <div className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleBackToInteractive}
                variant="outline" 
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  Edit Sheet: {selectedFile.name}
                </h1>
                <p className="text-sm text-gray-600">
                  Make changes locally without affecting the original sheet
                </p>
              </div>
            </div>
          </div>

          {/* Editable Table */}
          <EditableSheetTable sheetData={sheetData} />
        </div>
      </div>
    </div>
  );
};

export default EditableSheetPage;