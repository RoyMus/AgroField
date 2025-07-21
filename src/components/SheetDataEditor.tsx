
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import ProgressStats from "./ProgressStats";
import CellEditor from "./CellEditor";
import DataPreviewTable from "./DataPreviewTable";

interface SheetData {
  sheetName: string;
  values: string[][];
  metadata: {
    title: string;
    sheetCount: number;
  };
}

interface ModifiedCellData {
  originalValue: string;
  modifiedValue: string;
  rowIndex: number;
  columnIndex: number;
}

interface SheetDataEditorProps {
  sheetData: SheetData;
}

const SheetDataEditor = ({ sheetData }: SheetDataEditorProps) => {
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const [modifiedData, setModifiedData] = useState<Record<string, ModifiedCellData>>({});
  const [currentValue, setCurrentValue] = useState<string>("");
  const { toast } = useToast();
  const { isRecording, startRecording, stopRecording, error: recordingError } = useVoiceRecording();

  const headers = sheetData.values[0] || [];
  const dataRows = sheetData.values.slice(1);

  useEffect(() => {
    // Load saved modifications from localStorage
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    if (savedModifications) {
      setModifiedData(JSON.parse(savedModifications));
    }
  }, []);

  useEffect(() => {
    // Only set current cell value when position changes
    const cellKey = `${currentRowIndex}-${currentColumnIndex}`;
    const savedModification = modifiedData[cellKey];
    
    if (savedModification) {
      setCurrentValue(savedModification.modifiedValue);
    } else {
      setCurrentValue("");
    }
  }, [currentRowIndex, currentColumnIndex]);

  const handleInputChange = (value: string) => {
    setCurrentValue(value);
  };

  const handleVoiceTranscription = (transcription: string) => {
    setCurrentValue(transcription);
  };

  const saveModifications = () => {
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(modifiedData));
    toast({
      title: "Progress Saved",
      description: `Saved modifications for ${Object.keys(modifiedData).length} cells`,
    });
  };

  const getCellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`;

  const recordCurrentValue = async () => {
    if (!isRecording) {
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
    }
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
      const transcription = await stopRecording();
      console.log('Received transcription:', transcription);
      
      if (transcription) {
        handleVoiceTranscription(transcription);
        toast({
          title: "Voice Added",
          description: `Added: "${transcription}"`,
        });
      } else {
        toast({
          title: "Recording Failed",
          description: "Could not transcribe audio. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const skipCurrentValue = () => {
    const cellKey = getCellKey(currentRowIndex, currentColumnIndex);
    // Remove from modified data if it exists
    const newModifiedData = { ...modifiedData };
    delete newModifiedData[cellKey];
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
    
    moveToNextCell();
  };

  const moveToNextCell = () => {
    if (currentColumnIndex < headers.length - 1) {
      setCurrentColumnIndex(currentColumnIndex + 1);
    } else if (currentRowIndex < dataRows.length - 1) {
      setCurrentRowIndex(currentRowIndex + 1);
      setCurrentColumnIndex(0);
    }
  };

  const moveToPreviousCell = () => {
    if (currentColumnIndex > 0) {
      setCurrentColumnIndex(currentColumnIndex - 1);
    } else if (currentRowIndex > 0) {
      setCurrentRowIndex(currentRowIndex - 1);
      setCurrentColumnIndex(headers.length - 1);
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

  return (
    <div className="space-y-6">
      {/* Current Cell Editor */}
      <CellEditor
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        headers={headers}
        dataRows={dataRows}
        currentValue={currentValue}
        modifiedData={modifiedData}
        isRecording={isRecording}
        onInputChange={handleInputChange}
        onStartRecording={startVoiceRecording}
        onStopRecording={stopVoiceRecording}
        onResetCell={resetCurrentCell}
        onSaveProgress={saveModifications}
        onMovePrevious={moveToPreviousCell}
        onSkipCurrent={skipCurrentValue}
        onRecordValue={recordCurrentValue}
        isFirstCell={isFirstCell}
        isLastCell={isLastCell}
      />
      {/* Progress Stats */}
      <ProgressStats
        modifiedCount={Object.keys(modifiedData).length}
        currentPosition={currentRowIndex * headers.length + currentColumnIndex + 1}
        totalCells={dataRows.length * headers.length}
      />
      {/* Data Preview Table */}
      <DataPreviewTable
        headers={headers}
        dataRows={dataRows}
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        currentValue={currentValue}
        modifiedData={modifiedData}
      />
    </div>
  );
};

export default SheetDataEditor;
