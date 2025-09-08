import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import { useCellStyling } from "@/hooks/useCellStyling";
import ProgressStats from "./ProgressStats";
import CellEditor from "./CellEditor";
import DataPreviewTable from "./DataPreviewTable";
import SaveToNewSheetDialog from "./SaveToNewSheetDialog";
import { SheetData, ModifiedCellData } from "@/types/cellTypes";
import { set } from "date-fns";

interface SheetDataEditorProps {
  sheetData: SheetData;
  onSaveProgress?: (saveFunc: () => void) => void;
  onSaveToNewSheet?: (saveFunc: () => void) => void;
}

const SheetDataEditor = ({ sheetData, onSaveProgress, onSaveToNewSheet }: SheetDataEditorProps) => {
  for (let i = 0; i < sheetData.values.length; i++) {
    if (sheetData.values[i][0] != null && sheetData.values[i][0].trim() != "")
    {
      var found_headers_row_index = i;
      break;
    }
  }
  for (let i = found_headers_row_index + 1; i < sheetData.values.length; i++) {
    var found_comment_index = true;
    for (let j = 0; j < sheetData.values[i].length; j++)
    {
      if (sheetData.values[i][j] != null && sheetData.values[i][j].trim() != "")
      {
        found_comment_index = false;
        break;
      }
    }
    if (found_comment_index)
    {
      var commentIndex = i;
      break;
    }
  }
  const headersRowIndex = found_headers_row_index + 1;
  const headers = sheetData.values[headersRowIndex -1] || [];
  const [rowChangeCounter, setRowChangeCounter] = useState(0);
  const {
    loadInitialStyles,
    clearStyles,
    setCellStyleFormat,
    saveStyles
  } = useCellStyling();

  // Load initial styles when component mounts
  useEffect(() => {
    const cellStyles = localStorage.getItem('sheet_cell_styles');
    if (cellStyles) 
    {
      return;
    }
    if (sheetData.formatting && sheetData.formatting.length > 0) {
      console.log('SheetDataEditor: Loading formatting with', sheetData.formatting.length, 'styles');
      loadInitialStyles(sheetData.formatting);
      saveStyles();

    } else {
      console.log('SheetDataEditor: No formatting available, clearing styles');
      clearStyles();
    }
  }, [sheetData, loadInitialStyles, clearStyles]);
  
  var AlreadySetFirst = false;
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] == "")
    {
      if (!AlreadySetFirst)
      {
        var firstIndex = i + 1;
        AlreadySetFirst = true;
      }
      else
      {
        var lastindex = i - 1;
      }
    }
  }
  
  const minColIndex = firstIndex;
  const maxColIndex = lastindex;
  const [currentRowIndex, setCurrentRowIndex] = useState(headersRowIndex);
  const [currentColumnIndex, setCurrentColumnIndex] = useState(minColIndex);
  const [currentCount, setCurrentCount] = useState(1);
  const [modifiedData, setModifiedData] = useState<Record<string, ModifiedCellData>>({});
  const [currentValue, setCurrentValue] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { isRecording, startRecording, stopRecording, error: recordingError, onWordRecognized } = useVoiceRecording();
  const { createNewSheet } = useGoogleDrive();
  const dataRows = sheetData.values.slice(0, commentIndex);
  const{
    isTemplate,
    plant,
    grower,
    place,
    faucetConductivity,
  } = getData(false, null, null, null, null, null);
  useEffect(()=>{
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    const parsedSavedModifications = savedModifications ? JSON.parse(savedModifications) : {};
    if (savedModifications) {
      setModifiedData(parsedSavedModifications);
    }
    const topBarRowIndex = 0;
    const faucetRowIndex = 1;
    const topBarRow = sheetData.values[topBarRowIndex];
    const faucetRow = sheetData.values[faucetRowIndex];
    let topBarIndex = 0;
    let faucetIndex = 0;
    for (let i = 0; i < topBarRow.length; i++) {
      if (topBarRow[i] != "")
      {
        topBarIndex = i;
        break;
      }
    }
    for (let i = 0; i < faucetRow.length; i++) {
      if (faucetRow[i] != "")
      {
        faucetIndex = i;
        break;
      }
    }
    const newModifiedData = {
      ...parsedSavedModifications,
      ...modifiedData,
      [`${faucetRowIndex}-${faucetIndex}`]: {
        originalValue: `${faucetConductivity} - מוליכות ברז`,
        modifiedValue: `${faucetConductivity} - מוליכות ברז`,
        rowIndex: faucetRowIndex,
        columnIndex: faucetIndex
      }
    };
        
    if (isTemplate)
    {
        newModifiedData[`${topBarRowIndex}-${topBarIndex}`] = {
            originalValue: `${place} - ${plant} - ${grower}`,
            modifiedValue: `${place} - ${plant} - ${grower}`,
            rowIndex: topBarRowIndex,
            columnIndex: topBarIndex
          };
    }


    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
  }, []);

  const calcAverages = () =>
  {
    const newModifiedData = {
      ...modifiedData
    };
    for (let i = minColIndex; i <= maxColIndex; i++)
    {
      let sum = 0;
      let temp = 0;
      let counter = 0;
      for (let j = headersRowIndex; j <= dataRows.length - 3 ; j++)
      {
        counter++;
        temp = parseFloat(sheetData.values[j][i]);
        if (!Number.isNaN(temp))
        {
          sum += temp;
        }
      }
      sum /= counter;
      newModifiedData[`${dataRows.length - 1}-${i}`] = {
        originalValue: `${sum}`,
        modifiedValue: `${sum}`,
        rowIndex: dataRows.length - 1,
        columnIndex: i
      };
      const wantedResult = sheetData.values[dataRows.length - 2][i]?.split('-');
      let isBetween = false;
      if(wantedResult && wantedResult.length > 1)
        isBetween = sum > parseFloat(wantedResult[0]) && sum < parseFloat(wantedResult[1]);
      else if (wantedResult && wantedResult.length === 1)
        isBetween = sum < parseFloat(wantedResult[0]);
      setCellStyleFormat(dataRows.length - 1,i,{
      backgroundColor:  isBetween ? '#00ff15ff' : '#ff0000ff',
    });
    }
    saveStyles();
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
  };

  useEffect(() => {
    // Load saved modifications from localStorage
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    if (savedModifications) {
      setModifiedData(JSON.parse(savedModifications));
    }

    // Listen for storage changes from other components (like EditableSheetTable)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sheet_cell_modifications' && e.newValue) {
        setModifiedData(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for localStorage changes within the same tab
    const handleLocalStorageUpdate = () => {
      const savedModifications = localStorage.getItem('sheet_cell_modifications');
      if (savedModifications) {
        const parsedData = JSON.parse(savedModifications);
        setModifiedData(parsedData);
      }
    };

    // Set up an interval to check for localStorage changes (for same-tab updates)
    const interval = setInterval(handleLocalStorageUpdate, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    // Only set current cell value when position changes
    const cellKey = `${currentRowIndex}-${currentColumnIndex}`;
    const savedModification = modifiedData[cellKey];
    speak(headers[currentColumnIndex]);
    setCurrentValue("");
  }, [currentRowIndex, currentColumnIndex]);

  onWordRecognized((word: string) => {
      handleInputChange(word);
  });

  const handleInputChange = (value: string) => {
    console.log('Recognized word:', value);
    if (value.includes("דלג") || value.includes("הבא")) {
      skipCurrentValue();
      setCurrentValue("");
    }
    else if (value.includes("חזור") || value.includes("אחורה")) {
      moveToPreviousCell();
      setCurrentValue("");
    }
    else if(value.includes("מחק"))
    {
      resetCurrentCell();
    }
    else if (value.includes("שמור")) {
      if(currentValue) {
        recordCurrentValue();
        setCurrentValue("");
      }
    }
    else {
      setCurrentValue(value);
    }
    
  };

  const handleChangeToNewRow = (value: number) => {
    setCurrentRowIndex(value);
    setCurrentColumnIndex(minColIndex);
  };

  const saveModifications = useCallback(() => {
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(modifiedData));
    toast({
      title: "Progress Saved",
      description: `Saved modifications for ${Object.keys(modifiedData).length} cells`,
    });
    
  }, [modifiedData, toast]);

  const handleSaveToNewSheet = useCallback(() => {
    if (Object.keys(modifiedData).length === 0) {
      toast({
        title: "No Changes to Save",
        description: "You haven't made any modifications to save.",
        variant: "destructive",
      });
      return;
    }
    calcAverages();
    setShowSaveDialog(true);
    
  }, [modifiedData, toast]);

  const handleCreateNewSheet = async (fileName: string) => {
    setIsSaving(true);
    try {
      const result = await createNewSheet(fileName, modifiedData);
      
      if (result.success) {
        toast({
          title: "Sheet Created Successfully",
          description: `Created new Google Sheet: ${fileName}`,
        });
        setShowSaveDialog(false);
        
        // Clear modifications since they've been saved to a new sheet
        setModifiedData({});
        localStorage.removeItem('sheet_cell_modifications');

        // Optionally open the new sheet
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else {
        toast({
          title: "Failed to Create Sheet",
          description: result.error || "An error occurred while creating the sheet.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the sheet.",
        variant: "destructive",
      });
      console.error('Error creating new sheet:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getCellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`;

  const recordCurrentValue = async () => {
    // Save the current value
    const cellKey = getCellKey(currentRowIndex, currentColumnIndex);
    const originalValue = dataRows[currentRowIndex][currentColumnIndex] || "";
    
    const newModifiedData = {
      ...modifiedData,
      [cellKey]: {
        originalValue,
        modifiedValue: currentValue,
        rowIndex: currentRowIndex,
        columnIndex: currentColumnIndex
      }
    };
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
    
    toast({
      title: "Value Recorded",
      description: `Recorded value for ${headers[currentColumnIndex]}`,
    });
    
    moveToNextCell();
  };

  const startVoiceRecording = async () => {
    if (!isRecording) {
      console.log('Starting voice recording...');
      await startRecording();
      toast({
        title: "Recording Started",
        description: "Speak now... Click Stop to finish.",
      });
    }
  };

  const stopVoiceRecording = async () => {
    if (isRecording) {
      console.log('Stopping voice recording...');
      await stopRecording();
    }
  };
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
    };

    // Chrome fires voiceschanged async
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const speak = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      // Try to find a Hebrew voice
      const hebrewVoice = voices.find((v) => v.lang.startsWith("he"));
      if (hebrewVoice) {
        utterance.voice = hebrewVoice;
      }
      console.log('Speaking:', text);

      window.speechSynthesis.speak(utterance);
    } 
  };


  const skipCurrentValue = () => {
    moveToNextCell();
  };

  const moveToNextCell = () => {
    if (currentColumnIndex < maxColIndex) {
      setCurrentColumnIndex(currentColumnIndex + 1);
    } else if (currentRowIndex < dataRows.length - 3) {
      setCurrentRowIndex(currentRowIndex + 1);
      setCurrentColumnIndex(minColIndex);
      setRowChangeCounter(rowChangeCounter + 1);
    }
    setCurrentCount(currentCount + 1);
  };

  const moveToPreviousCell = () => {
    if (currentColumnIndex > minColIndex) {
      setCurrentColumnIndex(currentColumnIndex - 1);
    } else if (currentRowIndex > headersRowIndex) {
      setCurrentRowIndex(currentRowIndex - 1);
      setCurrentColumnIndex(maxColIndex);
      setRowChangeCounter(rowChangeCounter + 1);
    }
  };

  const resetCurrentCell = () => {
    setCurrentValue("");
    // Remove from modified data if it exists
    const cellKey = getCellKey(currentRowIndex, currentColumnIndex);
    const newModifiedData = { ...modifiedData };
    delete newModifiedData[cellKey];
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
  };

  useEffect(() => {
    if (recordingError) {
      toast({
        title: "Recording Error",
        description: recordingError,
        variant: "destructive",
      });
    }
  }, [recordingError, toast]);

  if (dataRows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data rows found in the sheet
      </div>
    );
  }

  const isLastCell = currentRowIndex === dataRows.length - 1 && currentColumnIndex === headers.length - 1;
  const isFirstCell = currentRowIndex === 0 && currentColumnIndex === 0;

  // Set up the callback functions for the parent component
  useEffect(() => {
    if (onSaveProgress) {
      onSaveProgress(saveModifications);
    }
    if (onSaveToNewSheet) {
      onSaveToNewSheet(handleSaveToNewSheet);
    }
  }, [onSaveProgress, onSaveToNewSheet, saveModifications, handleSaveToNewSheet]);

  const [formattedDate] = useState(() => new Date().toLocaleDateString());
  return (
    <div className="space-y-6">
      {/* Current Cell Editor */}
      <CellEditor
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        rowChangeCounter={rowChangeCounter}
        headers={headers}
        dataRows={dataRows}
        currentValue={currentValue}
        modifiedData={modifiedData}
        isRecording={isRecording}
        onInputChange={handleInputChange}
        onChangeToRow={handleChangeToNewRow}
        onStartRecording={startVoiceRecording}
        onStopRecording={stopVoiceRecording}
        onResetCell={resetCurrentCell}
        onSaveProgress={saveModifications}
        onSaveToNewSheet={handleSaveToNewSheet}
        onMovePrevious={moveToPreviousCell}
        onSkipCurrent={skipCurrentValue}
        onRecordValue={recordCurrentValue}
        isFirstCell={isFirstCell}
        isLastCell={isLastCell}
      />
      
      {/* Save to New Sheet Dialog */}
      <SaveToNewSheetDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handleCreateNewSheet}
        onCancel={() => setShowSaveDialog(false)}
        modifiedCount={Object.keys(modifiedData).length}
        previousFileName={`${sheetData.metadata.title} ${formattedDate}`}
        isLoading={isSaving}
      />
      {/* Data Preview Table *}
      <DataPreviewTable
        headers={headers}
        dataRows={dataRows}
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        currentValue={currentValue}
        modifiedData={modifiedData}
      />
      {/* Progress Stats - Top Right 
      <div className="flex">
        <div className="w-full">
          <ProgressStats
            modifiedCount={currentCount}
            currentPosition={currentRowIndex * headers.length + currentColumnIndex + 1}
            totalCells={dataRows.length * headers.length}
          />
        </div>
      </div>*/}
    </div>
  );
};

export default SheetDataEditor;
