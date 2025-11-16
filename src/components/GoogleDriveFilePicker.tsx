import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ChevronDown, Sheet, LogOut, Loader2, FileText, Search } from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useToast } from "@/hooks/use-toast";
import SaveProgressDialog from "./SaveProgressDialog";
import { useNavigate } from "react-router-dom";
import { useCellStyling } from "@/hooks/useCellStyling";


const GoogleDriveFilePicker = () => {
  const navigate = useNavigate();
 
  const { 
    isAuthenticated, 
    isLoading, 
    files, 
    selectedFile, 
    sheetData,
    error,
    authenticate, 
    selectFile, 
    readSheet,
    logout 
  } = useGoogleDrive();
  const
  {
    clearStyles
  } = useCellStyling(sheetData?.sheetName);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isReadingSheet, setIsReadingSheet] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleAuthenticate = async () => {
    try {
      await authenticate();
    } catch (err) {
      toast({
        title: "התחברות נכשלה",
        description: "ההתחברות לגוגל דרייב נכשלה, אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  const checkForUnsavedProgress = () => {
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    return savedModifications ? Object.keys(JSON.parse(savedModifications)).length : 0;
  };

  const handleFileSelect = (file: any) => {
    const modifiedCount = checkForUnsavedProgress();
    
    // If there's existing sheet data and unsaved changes, show save dialog
    if (sheetData && modifiedCount > 0 && file.id !== selectedFile?.id) {
      setPendingFile(file);
      setShowSaveDialog(true);
      setIsOpen(false);
      return;
    }
    
    // Otherwise, proceed directly
    selectFile(file);
    setIsOpen(false);
    toast({
      title: "קובץ נבחר",
      description: `${file.name}`,
    });
  };

  const handleSaveProgressConfirm = () => {
    // Save current progress
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    if (savedModifications) {
      const modificationData = JSON.parse(savedModifications);
      const progressKey = `sheet_progress_${selectedFile?.id}`;
      localStorage.setItem(progressKey, savedModifications);
      
      toast({
        title: "השינויים נשמרו",
        description: `השינויים שערכת לקובץ נשמרו בהצלחה`,
      });
    }
    
    proceedWithFileSelection();
  };

  const handleSaveProgressCancel = () => {
    proceedWithFileSelection();
  };

  const proceedWithFileSelection = () => {
    if (pendingFile) {
      selectFile(pendingFile);
      localStorage.removeItem('all_sheet_modifications'); // Clear current modifications
      toast({
        title: "קובץ נבחר",
        description: `${pendingFile.name}`,
      });
      setPendingFile(null);
    }
    setShowSaveDialog(false);
  };

  const handleReadSheet = async (sheetName?: string) => {
    if (selectedFile) {
      try {
        setIsReadingSheet(true);
        console.log('Starting to read sheet for file:', selectedFile.id, 'sheet:', sheetName);
        await readSheet(selectedFile.id, sheetName);
        console.log('Sheet read completed successfully');
        toast({
          title: "הקובץ נטען בהצלחה",
          description: "הקובץ נטען בהצלחה וכעת יהיה ניתן לערוך אותו",
        });
        localStorage.removeItem('all_sheet_modifications'); // Clear modifications on fresh load
        clearStyles(); // Clear cell styles on fresh load
        navigate("/page/workspace"); // Navigate to workspace after loading
      } catch (err) {
        console.error('Error reading sheet:', err);
        toast({
          title: "שגיאה בטעינת הקובץ",
          description: "טעינת הקובץ נכשלה, אנא נסה שוב",
          variant: "destructive",
        });
      } finally {
        setIsReadingSheet(false);
      }
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    setSearchQuery(""); // Clear search when logging out
    toast({
      title: "מנותק",
      description: "מנותק מגוגל דרייב",
    });
  };

  // Filter files based on search query
  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={handleAuthenticate} variant="outline">
          נסה שוב
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button 
        onClick={handleAuthenticate}
        disabled={isLoading}
        size="lg"
        className="bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 shadow-lg text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:shadow-xl"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            מתחבר
          </>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-500 rounded-sm -ml-2 mt-1"></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-sm -ml-2 mt-2"></div>
              </div>
              <span>התחבר לגוגל דרייב</span>
            </div>
          </>
        )}
      </Button>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 shadow-lg text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:shadow-xl min-w-[300px]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <Sheet className="h-5 w-5 text-green-600" />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : "בחר קובץ לטעינה"}
                  </span>
                </div>
                <ChevronDown className="ml-2 h-5 w-5 flex-shrink-0" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-80 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-hidden"
            align="center"
          >
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="חפש קבצים"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}   
                  className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                />
              </div>
            </div>
            <ScrollArea className="h-72 w-full">
              <div className="p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">טוען קבצים</span>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? `לא נמצאו קבצים שתואמים ל ${searchQuery}` : "לא נמצאו קבצים"}
                  </div>
                ) : (
                  <>
                    {filteredFiles.map((file) => (
                      <DropdownMenuItem
                        key={file.id}
                        onClick={() => handleFileSelect(file)}
                        className="text-gray-800 hover:bg-blue-50 cursor-pointer py-3 px-4 text-base rounded-lg mx-1 my-1 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <Sheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{file.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              ערוך {new Date(file.modifiedTime).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    <div className="border-t border-gray-200 mt-2 pt-2">
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 hover:bg-red-50 cursor-pointer py-3 px-4 text-base rounded-lg mx-1 my-1 transition-all duration-200"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        התנתק
                      </DropdownMenuItem>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {selectedFile && !sheetData && (
          <Button
            onClick={() => handleReadSheet()}
            disabled={isLoading || isReadingSheet}
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading || isReadingSheet ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                טוען מידע מהקובץ
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                טען קובץ
              </>
            )}
          </Button>
        )}
        
        {selectedFile && sheetData && (
          <Button
            onClick={() => handleReadSheet()}
            disabled={isLoading || isReadingSheet}
            size="lg"
            variant="outline"
            className="w-full"
          >
            {isLoading || isReadingSheet ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                טוען מידע מהקובץ
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                טען מחדש את הקובץ
              </>
            )}
          </Button>
        )}
      </div>

      <SaveProgressDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handleSaveProgressConfirm}
        onCancel={handleSaveProgressCancel}
        modifiedCount={checkForUnsavedProgress()}
      />
    </>
  );
};

export default GoogleDriveFilePicker;
