import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";
import SheetDataEditor from "@/components/SheetDataEditor";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";


const Index = () => {
  const navigate = useNavigate();
  const { sheetData, selectedFile, clearSheetData } = useGoogleDrive();
  const [isTemplate, SetTemplate] = useState(false);
  const [currentPlace, SetCurrentPlace] = useState("");
  const [currentPlant, SetCurrentPlant] = useState("");
  const [currentGrowerName, SetCurrentGrowerName] = useState("");
  const [faucetConductivity, SetfaucetConductivity] = useState("");
  
  useEffect(() => {
    getData(true, isTemplate, currentPlant, currentGrowerName, currentPlace, faucetConductivity);
  }, [isTemplate, currentPlace, currentPlant, currentGrowerName, faucetConductivity]);

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
              <Card className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center space-x-3 justify-center">
                    <Checkbox
                      id="create-new"
                      checked={isTemplate}
                      onCheckedChange={(checked) => SetTemplate(checked as boolean)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label 
                      htmlFor="create-new" 
                      className="text-base font-medium text-foreground cursor-pointer"
                    >
                      צור קובץ חדש
                    </Label>
                  </div>

                  {isTemplate && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="place" className="text-sm font-medium text-muted-foreground">
                            מיקום
                          </Label>
                          <Input
                            id="place"
                            dir = "rtl"
                            value={currentPlace}
                            onChange={(e) => SetCurrentPlace(e.target.value)}
                            placeholder="עין הבשור"
                            className="h-11 bg-background border-border focus:border-primary transition-colors"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="plant" className="text-sm font-medium text-muted-foreground">
                            גידול
                          </Label>
                          <Input
                            id="plant"
                            dir = "rtl"
                            value={currentPlant}
                            onChange={(e) => SetCurrentPlant(e.target.value)}
                            placeholder="תותים"
                            className="h-11 bg-background border-border focus:border-primary transition-colors"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="grower" className="text-sm font-medium text-muted-foreground">
                            מגדל
                          </Label>
                          <Input
                            id="grower"
                            dir = "rtl"
                            value={currentGrowerName}
                            onChange={(e) => SetCurrentGrowerName(e.target.value)}
                            placeholder="ארגואן"
                            className="h-11 bg-background border-border focus:border-primary transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Input
                id="faucetConductivity"
                value={faucetConductivity}
                onChange={(e) => SetfaucetConductivity(e.target.value)}
                placeholder="מוליכות ברז"
                className="h-11 bg-background text-center border-border focus:border-primary transition-colors"
              />
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
