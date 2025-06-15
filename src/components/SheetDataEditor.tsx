import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, SkipForward, Save, Mic, MicOff, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

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
  const [currentRowIndex, setCurrentRowIndex] = useState(0); // Start from row 0 (first data row)
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const [modifiedData, setModifiedData] = useState<Record<string, ModifiedCellData>>({});
  const [currentValue, setCurrentValue] = useState<string>("");
  const [isTextMode, setIsTextMode] = useState(true);
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
    // Set current cell value when position changes
    if (dataRows[currentRowIndex] && dataRows[currentRowIndex][currentColumnIndex] !== undefined) {
      const cellKey = `${currentRowIndex}-${currentColumnIndex}`;
      const savedModification = modifiedData[cellKey];
      if (savedModification) {
        setCurrentValue(savedModification.modifiedValue);
      } else {
        setCurrentValue(dataRows[currentRowIndex][currentColumnIndex] || "");
      }
    }
  }, [currentRowIndex, currentColumnIndex, dataRows, modifiedData]);

  const saveModifications = () => {
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(modifiedData));
    toast({
      title: "Progress Saved",
      description: `Saved modifications for ${Object.keys(modifiedData).length} cells`,
    });
  };

  const getCellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`;

  const recordCurrentValue = async () => {
    if (isTextMode) {
      // Text mode - use the current input value
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
    } else {
      // Voice mode - start/stop recording
      if (isRecording) {
        const transcription = await stopRecording();
        if (transcription) {
          setCurrentValue(transcription);
          
          const cellKey = getCellKey(currentRowIndex, currentColumnIndex);
          const originalValue = dataRows[currentRowIndex][currentColumnIndex] || "";
          
          const newModifiedData = {
            ...modifiedData,
            [cellKey]: {
              originalValue,
              modifiedValue: transcription,
              rowIndex: currentRowIndex,
              columnIndex: currentColumnIndex
            }
          };
          setModifiedData(newModifiedData);
          localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
          
          toast({
            title: "Voice Recorded",
            description: `Transcribed: "${transcription}"`,
          });
          
          moveToNextCell();
        } else {
          toast({
            title: "Recording Failed",
            description: "Could not transcribe audio. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        await startRecording();
        toast({
          title: "Recording Started",
          description: "Speak now... Click Record again to stop.",
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
    const originalValue = dataRows[currentRowIndex][currentColumnIndex] || "";
    setCurrentValue(originalValue);
    
    // Remove from modified data if it exists
    const cellKey = getCellKey(currentRowIndex, currentColumnIndex);
    const newModifiedData = { ...modifiedData };
    delete newModifiedData[cellKey];
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
  };

  const getModificationStats = () => {
    const totalCells = dataRows.length * headers.length;
    const modifiedCells = Object.keys(modifiedData).length;
    const currentCellPosition = currentRowIndex * headers.length + currentColumnIndex + 1;
    return { totalCells, modifiedCells, currentCellPosition };
  };

  const getCurrentCellKey = () => getCellKey(currentRowIndex, currentColumnIndex);
  const isCurrentCellModified = modifiedData[getCurrentCellKey()] !== undefined;
  const stats = getModificationStats();

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
      {/* Progress Stats */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Progress Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.modifiedCells}</div>
            <div className="text-blue-700">Modified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.currentCellPosition}</div>
            <div className="text-gray-700">Current Position</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.totalCells}</div>
            <div className="text-gray-700">Total Cells</div>
          </div>
        </div>
      </div>

      {/* Current Cell Editor */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              Row {currentRowIndex + 1}, Column: {headers[currentColumnIndex]}
              {isCurrentCellModified && <span className="ml-2 text-sm text-green-600">(Modified)</span>}
            </h3>
            <p className="text-sm text-gray-600">
              Cell {stats.currentCellPosition} of {stats.totalCells}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={resetCurrentCell}
              variant="outline"
              size="sm"
              disabled={!isCurrentCellModified}
            >
              Reset
            </Button>
            <Button
              onClick={saveModifications}
              variant="outline"
              size="sm"
            >
              <Save className="mr-1 h-4 w-4" />
              Save Progress
            </Button>
          </div>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setIsTextMode(true)}
            variant={isTextMode ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <Type className="h-4 w-4" />
            Text Input
          </Button>
          <Button
            onClick={() => setIsTextMode(false)}
            variant={!isTextMode ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <Mic className="h-4 w-4" />
            Voice Input
          </Button>
        </div>

        {/* Current Cell Focus */}
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Value:
            </label>
            <div className="text-lg text-gray-900 bg-white p-3 rounded border">
              {dataRows[currentRowIndex][currentColumnIndex] || '(empty)'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isTextMode ? 'New Value:' : 'Transcribed Value:'}
            </label>
            {isTextMode ? (
              <Input
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder={`Enter value for ${headers[currentColumnIndex]}`}
                className="text-lg p-3 h-12"
                autoFocus
              />
            ) : (
              <div className="text-lg p-3 h-12 border rounded-md bg-gray-50 flex items-center">
                {isRecording ? (
                  <span className="text-red-600 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                    Recording... Click Record to stop
                  </span>
                ) : (
                  currentValue || 'Click Record to start voice input'
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            onClick={moveToPreviousCell}
            disabled={isFirstCell}
            variant="outline"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={skipCurrentValue}
              disabled={isLastCell}
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <SkipForward className="mr-1 h-4 w-4" />
              Skip
            </Button>
            <Button
              onClick={recordCurrentValue}
              disabled={isLastCell && isTextMode}
              className={isRecording ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {isRecording ? (
                <>
                  <MicOff className="mr-1 h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  {isTextMode ? <Type className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
                  {isTextMode ? 'Record Text' : 'Record Voice'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Sheet Preview</h3>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {headers.map((header, index) => (
                  <TableHead key={index} className={index === currentColumnIndex ? 'bg-blue-100' : ''}>
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataRows.slice(0, 10).map((row, rowIndex) => {
                const isCurrentRow = rowIndex === currentRowIndex;
                
                return (
                  <TableRow 
                    key={rowIndex}
                    className={isCurrentRow ? 'bg-blue-50 border-blue-200' : ''}
                  >
                    <TableCell className="font-medium">
                      {rowIndex + 1}
                    </TableCell>
                    {row.map((cell, cellIndex) => {
                      const cellKey = getCellKey(rowIndex, cellIndex);
                      const isCellModified = modifiedData[cellKey] !== undefined;
                      const isCurrentCell = isCurrentRow && cellIndex === currentColumnIndex;
                      
                      return (
                        <TableCell 
                          key={cellIndex} 
                          className={`max-w-32 truncate ${
                            isCurrentCell ? 'bg-blue-200 font-semibold' : 
                            isCellModified ? 'bg-green-50 text-green-800' : ''
                          }`}
                        >
                          {isCellModified ? modifiedData[cellKey].modifiedValue : cell}
                          {isCellModified && <span className="ml-1 text-green-600">✓</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {dataRows.length > 10 && (
            <div className="text-center py-2 text-gray-500 text-sm">
              Showing first 10 rows of {dataRows.length} total rows
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SheetDataEditor;
