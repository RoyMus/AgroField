import { Button } from "@/components/ui/button";
import { getData } from "@/hooks/getData";
import { useState, useEffect } from 'react';

const TopBar = ({handleGoHome, selectedFile}) => {    
    const{
    isTemplate,
    plant,
    grower,
    place,
    } = getData(false, null, null, null, null);

    return (
        
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