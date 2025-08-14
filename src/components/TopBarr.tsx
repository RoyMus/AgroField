import { Button } from "@/components/ui/button";
import { getData } from "@/hooks/getData";
import { useState, useEffect } from 'react';
import { Edit } from "lucide-react";

const TopBar = ({sheetData, handleGoHome, selectedFile, onOpenEditor}) => {
    const{
    isTemplate,
    plant,
    grower,
    place,
    faucetConductivity
    } = getData(false, null, null, null, null, null);
    
    const [topBar, setTopBar] = useState("");
    useEffect(()=>{
        const topBarRowIndex = 0;
        const topBarRow = sheetData.values[topBarRowIndex];
        let topBarIndex = 0;
        for (let i = 0; i < topBarRow.length; i++) {
            if (topBarRow[i] != "")
            {
                topBarIndex = i;
                break;
            }
        }
        if (isTemplate)
        {
            setTopBar(`${place} - ${plant} - ${grower}`);
        }
        else
        {
            setTopBar(sheetData.values[topBarRowIndex][topBarIndex]);
        }
    }, []);
    

    return (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border-2 border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                        {selectedFile?.name}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 truncate">
                        {topBar}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                        onClick={onOpenEditor}
                        variant="default"
                        className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] px-4"
                    >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm sm:text-base">פתח עורך גיליון מלא</span>
                    </Button>
                    <Button
                        onClick={handleGoHome}
                        variant="outline"
                        className="flex items-center justify-center min-h-[44px] px-4"
                    >
                        <span className="text-sm sm:text-base">חזור לדף הבית</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};
export default TopBar;