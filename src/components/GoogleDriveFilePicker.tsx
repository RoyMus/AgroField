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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "./ui/label";
import { useTranslation } from 'react-i18next';
import { useLang } from '@/contexts/LanguageContext';


const GoogleDriveFilePicker = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLang();

  const {
    isAuthenticated,
    isLoading,
    files,
    selectedFile,
    sheetData,
    error,
    authenticate,
    selectFile,
    loadAndCopySheet,
    logout
  } = useGoogleDrive();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isReadingSheet, setIsReadingSheet] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createNewFile, setCreateNewFile] = useState(false);

  const handleAuthenticate = async () => {
    try {
      await authenticate();
    } catch (err) {
      toast({
        title: t('auth.loginFailed'),
        description: t('auth.loginFailedDesc'),
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

    if (sheetData && modifiedCount > 0 && file.id !== selectedFile?.id) {
      setPendingFile(file);
      setShowSaveDialog(true);
      setIsOpen(false);
      return;
    }

    selectFile(file);
    setIsOpen(false);
    toast({
      title: t('files.fileSelected'),
      description: `${file.name}`,
    });
  };

  const handleSaveProgressConfirm = () => {
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    if (savedModifications) {
      const progressKey = `sheet_progress_${selectedFile?.id}`;
      localStorage.setItem(progressKey, savedModifications);

      toast({
        title: t('files.changesSaved'),
        description: t('files.changesSavedDesc'),
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
      localStorage.removeItem('all_sheet_modifications');
      toast({
        title: t('files.fileSelected'),
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
        console.log('Starting to load and copy sheet for file:', selectedFile.id, 'sheet:', sheetName);
        await loadAndCopySheet(sheetName, createNewFile);
        console.log('Sheet load and copy completed successfully');
        navigate("/page/workspace");
      } catch (err) {
        console.error('Error loading and copying sheet:', err);
        toast({
          title: t('files.fileLoadError'),
          description: t('files.fileLoadErrorDesc'),
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
    setSearchQuery("");
    toast({
      title: t('auth.disconnected'),
      description: t('auth.disconnectedDesc'),
    });
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={handleAuthenticate} variant="outline">
          {t('auth.retry')}
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
            {t('auth.connecting')}
          </>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-500 rounded-sm -ml-2 mt-1"></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-sm -ml-2 mt-2"></div>
              </div>
              <span>{t('auth.connectGoogleDrive')}</span>
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
                    {selectedFile ? selectedFile.name : t('files.selectFile')}
                  </span>
                </div>
                <ChevronDown className="ml-2 h-5 w-5 flex-shrink-0" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-80 max-w-lg w-max bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-hidden"
            align="center"
          >
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('files.searchFiles')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                />
              </div>
            </div>
            <ScrollArea className="h-48 overflow auto w-full">
              <div className="p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">{t('files.loadingFiles')}</span>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? t('files.noFilesMatch', { query: searchQuery }) : t('files.noFiles')}
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <DropdownMenuItem
                      key={file.id}
                      onClick={() => handleFileSelect(file)}
                      className="text-gray-800 hover:bg-blue-50 cursor-pointer py-3 px-4 text-base rounded-lg mx-1 my-1 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <Sheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium">{file.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {t('files.lastEdited', { date: new Date(file.modifiedTime).toLocaleDateString(locale) })}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-gray-200">
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 hover:bg-red-50 cursor-pointer py-3 px-4 text-base rounded-lg mx-1 my-1 transition-all duration-200"
              >
                <LogOut className="mr-3 h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </div>
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
                {t('files.loadingFile')}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {t('files.loadFile')}
              </>
            )}
          </Button>
        )}

      </div>

      <div className="flex items-center space-x-3 justify-center">
        <Checkbox
          id="copy-sheet"
          checked={createNewFile}
          onCheckedChange={(checked) => setCreateNewFile(checked as boolean)}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <Label
          htmlFor="copy-sheet"
          className="text-base font-medium text-foreground cursor-pointer"
        >
          {t('files.copyToNewFile')}
        </Label>
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
