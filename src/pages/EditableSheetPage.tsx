import { useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { drive } from "@/stores";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import EditableSheetTable from "@/components/EditableSheetTable";
import SheetSelector from "@/components/SheetSelector";
import { useTranslation } from 'react-i18next';

const EditableSheetPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sheet, selectedFile, isLoading } = drive;

  const handleBackToInteractive = () => {
    navigate(-1);
  };

  const handleSheetChange = async (sheetName: string) => {
    if (selectedFile) {
      await drive.loadSheetByName(sheetName);
    }
  };

  if (!sheet || !selectedFile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('noSheet.title')}</h1>
            <p className="text-gray-600 mb-6">{t('noSheet.description')}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('noSheet.goHome')}
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
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Button
                onClick={handleBackToInteractive}
                size="sm"
                className="h-10 w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 rounded"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>{t('topbar.backToHome')}</span>
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-800 truncate">
                    {t('table.editSheet', { name: selectedFile.name })}
                  </h1>
                  {sheet.metadata?.availableSheets && (
                    <SheetSelector
                      availableSheets={sheet.metadata.availableSheets}
                      currentSheet={sheet.sheetName}
                      onSheetSelect={handleSheetChange}
                      isLoading={isLoading}
                      disabled={isLoading}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Editable Table */}
          <EditableSheetTable />
        </div>
      </div>
    </div>
  );
};

export default observer(EditableSheetPage);
