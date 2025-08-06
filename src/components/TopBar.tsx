import { Button } from "@/components/ui/button";
import { getData } from "@/hooks/getData";
import { useState, useEffect } from 'react';

const TopBar = ({sheetData, handleGoHome, selectedFile}) => {    
    const{
    isTemplate,
    plant,
    grower,
    place,
    } = getData(false, null, null, null, null);
    
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
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200">
            <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">
                {selectedFile?.name}
                </h1>
                <p className="text-gray-600">
                    {topBar}
                </p>
            </div>
            <div className="flex items-center space-x-4">
                <Button
                onClick={handleGoHome}
                variant="outline"
                className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                חזור לדף הבית
                </Button>
            </div>
            </div>
        </div>
        );
};
export default TopBar;