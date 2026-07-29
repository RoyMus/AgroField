import { observer } from "mobx-react-lite";
import { Button } from "@/components/ui/button";
import { useState } from 'react';
import { Edit, Save, Download } from "lucide-react";
import SheetSelector from "./SheetSelector";
import { drive, editor, settings } from "@/stores";
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from "./LanguageSwitcher";

const TopBar = ({ handleGoHome, onOpenEditor }) => {
    const { t } = useTranslation();
    const [fetchDataButtonDisabled, setFetchDataButtonDisabled] = useState(false);

    const sheet = drive.sheet;
    if (!sheet) return null;

    const topBarRow = sheet.values[0] ?? [];
    const topBarIndex = Math.max(0, topBarRow.findIndex(cell => cell.value.trim() !== ""));
    const topBar = settings.isTemplate
        ? `${settings.place} - ${settings.plant} - ${settings.grower}`
        : sheet.valueAt(0, topBarIndex);

    const handleClickFetchData = () => {
        if (fetchDataButtonDisabled) return;
        setFetchDataButtonDisabled(true);
        setTimeout(() => setFetchDataButtonDisabled(false), 5000);
        editor.fetchApiData();
    };

    return (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border-2 border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                            {drive.selectedFile?.name}
                        </h1>
                        {sheet.metadata?.availableSheets && (
                            <SheetSelector
                                availableSheets={sheet.metadata.availableSheets}
                                currentSheet={sheet.sheetName}
                                onSheetSelect={(name) => drive.loadSheetByName(name)}
                                isLoading={drive.isLoading}
                                disabled={drive.isLoading}
                            />
                        )}
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 truncate">
                        {topBar}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <LanguageSwitcher />
                    <Button
                        onClick={handleClickFetchData}
                        variant="default"
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 h-9 text-sm"
                        disabled={fetchDataButtonDisabled}
                    >
                        <Download className="mr-1 h-4 w-4" />
                        <span>{t('topbar.fetchApiData')}</span>
                    </Button>
                    <Button
                        onClick={() => editor.saveAndOpenSheet()}
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-9 text-sm"
                    >
                        <Save className="mr-1 h-4 w-4" />
                        <span>{t('topbar.saveAndOpen')}</span>
                    </Button>
                    <Button
                        onClick={onOpenEditor}
                        variant="default"
                        className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-4"
                    >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm sm:text-base">{t('topbar.openFullEditor')}</span>
                    </Button>
                    <Button
                        onClick={handleGoHome}
                        variant="outline"
                        className="flex items-center justify-center min-h-[44px] px-4"
                    >
                        <span className="text-sm sm:text-base">{t('topbar.backToHome')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default observer(TopBar);
