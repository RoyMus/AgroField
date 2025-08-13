
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, SkipForward, Save, Type } from "lucide-react";
import VoiceControls from "./VoiceControls";
import SimpleDropdown from "./ui/simpleDropdown";
import { useEffect, useState} from "react";

interface ModifiedCellData {
  originalValue: string;
  modifiedValue: string;
  rowIndex: number;
  columnIndex: number;
}

interface CellEditorProps {
  currentRowIndex: number;
  currentColumnIndex: number;
  headers: string[];
  dataRows: string[][];
  currentValue: string;
  modifiedData: Record<string, ModifiedCellData>;
  isRecording: boolean;
  onInputChange: (value: string) => void;
  onChangeToRow: (rowIndex: number) => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onResetCell: () => void;
  onSaveProgress: () => void;
  onSaveToNewSheet?: () => void;
  onMovePrevious: () => void;
  onSkipCurrent: () => void;
  onRecordValue: () => Promise<void>;
  isFirstCell: boolean;
  isLastCell: boolean;
}

const CellEditor = ({
  currentRowIndex,
  currentColumnIndex,
  headers,
  dataRows,
  currentValue,
  modifiedData,
  isRecording,
  onInputChange,
  onChangeToRow,
  onStartRecording,
  onStopRecording,
  onResetCell,
  onSaveProgress,
  onSaveToNewSheet,
  onMovePrevious,
  onSkipCurrent,
  onRecordValue,
  isFirstCell,
  isLastCell,
}: CellEditorProps) => {
  const getCellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`;
  const currentCellKey = getCellKey(currentRowIndex, currentColumnIndex);
  const isCurrentCellModified = modifiedData[currentCellKey] !== undefined;
  const [optionsHamama, setOptionsHamama] = useState([]);
  const [currentHamama, setCurrentHamama] = useState(null);
  const [optionsMagof, setOptionsMagof] = useState([]);
  const [currentMagof, setCurrentMagof] = useState(null);
  const [optionsGidul, setOptionsGidul] = useState([]);
  
  const handleSelectHamama = (selectedValue) => {
    while (optionsMagof.length != 0)
      optionsMagof.pop();
    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] == selectedValue && !optionsMagof.includes(dataRows[i][1]))
        optionsMagof.push(dataRows[i][1]);
    }
    setOptionsMagof([...optionsMagof]);
    setCurrentHamama(selectedValue);
  };

  const handleSelectMagof = (selectedValue) => {
    if (currentHamama == null)
      return;

    while (optionsGidul.length != 0)
      optionsGidul.pop();

    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] == currentHamama && dataRows[i][1] == selectedValue)
      {
        optionsGidul.push(dataRows[i][3]);
      }
    }
    setOptionsGidul([...optionsGidul]);
    setCurrentMagof(selectedValue);
    if (selectedValue == currentMagof)
    {
      if (optionsGidul.length != 0)
      {
        handleSelectGidul(optionsGidul[0]);
      }
    }
  };

  const handleSelectGidul = (selectedValue) => {
    if (currentHamama == null || currentMagof == null || selectedValue == null)
      return;
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] == currentHamama && dataRows[i][1] == currentMagof && dataRows[i][3] == selectedValue)
      {
        onChangeToRow(i);
        return;
      }
    }
  };

  useEffect (() => {
    if (optionsMagof.length != 0)
    {
      handleSelectMagof(optionsMagof[0]);
    }
  }, [currentHamama]);

  useEffect (() => {
    if (optionsGidul.length != 0)
    {
      handleSelectGidul(optionsGidul[0]);
    }
  }, [currentMagof]);

  useEffect (() => {
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != "" && dataRows[i][0] != "חממה" && !optionsHamama.includes(dataRows[i][0]))
        optionsHamama.push(dataRows[i][0]);
      setOptionsHamama([...optionsHamama]);
    }
    handleSelectHamama(optionsHamama[0]);
  }, []);
  
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {headers[currentColumnIndex]}
            {isCurrentCellModified && 
              <span className="ml-2 text-sm text-green-600">(Modified)</span>
            }
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsHamama} onSelect={handleSelectHamama} /> חממה
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsMagof} onSelect={handleSelectMagof} /> מגוף
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsGidul} onSelect={handleSelectGidul} /> גידול
          </h3>
          <p className="text-sm text-gray-600">
            Cell {currentRowIndex * headers.length + currentColumnIndex + 1} of {dataRows.length * headers.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onResetCell}
            variant="outline"
            size="sm"
            disabled={!isCurrentCellModified}
          >
            בטל
          </Button>
          <Button
            onClick={onSaveProgress}
            variant="outline"
            size="sm"
          >
            <Save className="mr-1 h-4 w-4" />
            Save Progress
          </Button>
          {onSaveToNewSheet && (
            <Button
              onClick={onSaveToNewSheet}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-1 h-4 w-4" />
              Save to New Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Current Cell Focus */}
      <div className="space-y-4 mb-6">        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Value:
          </label>
          <Input
            value={currentValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={dataRows[currentRowIndex][currentColumnIndex]}
            className="text-lg p-3 h-12"
            autoFocus
          />
        </div>
      </div>

      {/* Voice Recording Controls */}
      <div className="mb-6">
        <VoiceControls
          isRecording={isRecording}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          onClick={onMovePrevious}
          disabled={isFirstCell}
          variant="outline"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          חזור
        </Button>

        <div className="flex gap-3">
          <Button
            onClick={onSkipCurrent}
            disabled={isLastCell}
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            <SkipForward className="mr-1 h-4 w-4" />
            דלג
          </Button>
          <Button
            onClick={onRecordValue}
            disabled={isLastCell}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Type className="mr-1 h-4 w-4" />
            שמור
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CellEditor;
