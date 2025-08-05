import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@radix-ui/react-checkbox";


const Index = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();
  const [isTemplate, SetTemplate] = useState(false);
  const [currentPlace, SetCurrentPlace] = useState("");
  const [currentPlant, SetCurrentPlant] = useState("");
  const [currentGrowerName, SetCurrentGrowerName] = useState("");
  
  useEffect(() => {
    getData(true, isTemplate, currentPlant, currentGrowerName, currentPlace);
  }, [isTemplate, currentPlace, currentPlant, currentGrowerName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center space-y-8 max-w-4xl">
              <div className="space-y-6">
                <div className="flex items-center justify-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                  </div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-800 mb-4">
                  <span className="bg-gradient-to-r from-blue-600 via-green-600 to-red-600 bg-clip-text text-transparent">
                    אורלומטי
                  </span>
                </h1>
                
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  התחבר לגוגל דרייב, בחר בטמפלייט או בקובץ קיים, והתחל להזין נתונים
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                      :האם ליצור קובץ חדש
                </label>
                <input
                  type="checkbox"
                  checked={isTemplate} 
                  onChange={(e) => SetTemplate(e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-center space-x-4 mb-6">
                <div className="space-y-4 mb-6">        
                  <div>
                    {isTemplate &&
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        :מיקום
                      </label>
                      <Input
                        value={currentPlace}
                        onChange={(e) => SetCurrentPlace(e.target.value)}
                        placeholder={"עין הבשור"}
                        className="text-lg p-3 h-12"
                        autoFocus
                        />
                      </div>
                    }
                  </div>
                </div>
                <div className="space-y-4 mb-6">        
                  <div>
                    {isTemplate &&
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        :גידול
                      </label>
                      <Input
                        value={currentPlant}
                        onChange={(e) => SetCurrentPlant(e.target.value)}
                        placeholder={"תותים"}
                        className="text-lg p-3 h-12"
                        autoFocus
                        />
                      </div>
                    }
                  </div>
                </div>
                <div className="space-y-4 mb-6">        
                  <div>
                    {isTemplate &&
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        :מגדל
                      </label>
                      <Input
                        value={currentGrowerName}
                        onChange={(e) => SetCurrentGrowerName(e.target.value)}
                        placeholder={"ארגואן"}
                        className="text-lg p-3 h-12"
                        autoFocus
                        />
                      </div>
                    }
                  </div>
                </div>
              </div>
              <div className="pt-8">
                <GoogleDriveFilePicker/>
              </div>
              
              <div className="pt-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default Index;
