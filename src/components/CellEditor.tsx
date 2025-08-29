
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
  rowChangeCounter: number;
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
  rowChangeCounter,
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
  const [dropDownValueOfHamama, setDropDownHamama] = useState(null);
  const [dropDownValueOfMagof, setDropDownMagof] = useState(null);
  const [dropDownValueOfGidul, setDropDownGidul] = useState(null);

  const handleChangedRow = () => {
    let curHam = dataRows[currentRowIndex][0].trim();
    let curMag = dataRows[currentRowIndex][1].trim();
    let curGid = dataRows[currentRowIndex][3];
    setDropDownHamama(curHam);
    setDropDownMagof(curMag);
    setDropDownGidul(curGid);
    setCurrentHamama(null);
    setCurrentMagof(null);

    while (optionsMagof.length != 0)
      optionsMagof.pop();
    
    while (optionsGidul.length != 0)
      optionsGidul.pop();

    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0].trim() == curHam && dataRows[i][1] != null && !optionsMagof.includes(dataRows[i][1].trim()))
        optionsMagof.push(dataRows[i][1].trim());
    }
    setOptionsMagof([...optionsMagof]);
    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0].trim() == curHam && dataRows[i][1] != null && dataRows[i][1].trim() == curMag)
      {
        optionsGidul.push(dataRows[i][3]);
      }
    }
    setOptionsGidul([...optionsGidul]);
  };

  const handleSelectHamama = (selectedValue) => {
    while (optionsMagof.length != 0)
      optionsMagof.pop();
    
    console.log(selectedValue);
    for (let i = 0; i < dataRows.length; i++)
    {
      console.log(i);
      console.log(dataRows[i][0] != null && dataRows[i][0].trim() == selectedValue.trim() && !optionsMagof.includes(dataRows[i][1]));
      if (dataRows[i][0] != null && dataRows[i][0].trim() == selectedValue.trim() && !optionsMagof.includes(dataRows[i][1]))
      {
        console.log(dataRows[i][1]);
        optionsMagof.push(dataRows[i][1]);
      }
    }
    setOptionsMagof([...optionsMagof]);
    setCurrentHamama(selectedValue);
    setDropDownHamama(selectedValue);
  };

  const handleSelectMagof = (selectedValue) => {
    while (optionsGidul.length != 0)
      optionsGidul.pop();

    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0].trim() == dropDownValueOfHamama.trim() && dataRows[i][1] == selectedValue)
      {
        optionsGidul.push(dataRows[i][3]);
      }
    }
    setOptionsGidul([...optionsGidul]);
    setCurrentMagof(selectedValue);
    setDropDownMagof(selectedValue);
    if (selectedValue == currentMagof)
    {
      if (optionsGidul.length != 0)
      {
        handleSelectGidul(optionsGidul[0]);
      }
    }
  };

  const handleSelectGidul = (selectedValue) => {
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0].trim() == dropDownValueOfHamama.trim() && dataRows[i][1] == dropDownValueOfMagof && dataRows[i][3] == selectedValue)
      {
        onChangeToRow(i);
        break;
      }
    }
    setDropDownGidul(selectedValue);
  };

  useEffect (() => {
    if (currentHamama == null)
      return;

    if (optionsMagof.length != 0)
    {
      handleSelectMagof(optionsMagof[0]);
    }
  }, [currentHamama]);

  useEffect (() => {
    if (currentMagof == null)
      return;

    if (optionsGidul.length != 0)
    {
      handleSelectGidul(optionsGidul[0]);
    }
  }, [currentMagof]);

  useEffect (() => {
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0] != "" && dataRows[i][0] != "חממה" && !optionsHamama.includes(dataRows[i][0].trim()))
      {
        optionsHamama.push(dataRows[i][0].trim());
      }
      setOptionsHamama([...optionsHamama]);
    }
    handleSelectHamama(optionsHamama[0]);
  }, []);
  
  useEffect (() => {
    handleChangedRow();
  }, [rowChangeCounter]);
  
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 md:p-6 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {headers[currentColumnIndex]}
            {isCurrentCellModified && 
              <span className="ml-2 text-sm text-green-600">(Modified)</span>
            }
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsHamama} value = {dropDownValueOfHamama} onSelect={handleSelectHamama} /> חממה
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsMagof} value = {dropDownValueOfMagof} onSelect={handleSelectMagof} /> מגוף
          </h3>
          <h3 className="text-lg font-semibold">
            <SimpleDropdown options={optionsGidul} value = {dropDownValueOfGidul} onSelect={handleSelectGidul} /> גידול
          </h3>
          <p className="text-sm text-gray-600">
            Cell {currentRowIndex * headers.length + currentColumnIndex + 1} of {dataRows.length * headers.length}
          </p>
        </div>
        
        {/* Mobile-optimized action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Button
            onClick={onResetCell}
            variant="outline"
            size="sm"
            disabled={!isCurrentCellModified}
            className="h-10 text-sm"
          >
            מחק
          </Button>
          <Button
            onClick={onSaveProgress}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
            dir="rtl"
          >
            <Save className="mr-1 h-4 w-4" />
            <span className="sm:inline">שמור התקדמות</span>
          </Button>
          {onSaveToNewSheet && (
            <Button
              onClick={onSaveToNewSheet}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 h-10 text-sm"
              dir="rtl"
            >
              <Save className="mr-1 h-4 w-4" />
              <span className="sm:inline">שמור לגיליון חדש</span>
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
            onInput={(e)=> onInputChange((e.target as HTMLInputElement).value)}
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

      {/* Action Buttons - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t space-y-3 sm:space-y-0">
        <Button
          onClick={onMovePrevious}
          disabled={isFirstCell}
          variant="outline"
          className="h-12 w-full sm:w-auto text-base"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          חזור
        </Button>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={onSkipCurrent}
            disabled={isLastCell}
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50 h-12 text-base"
          >
            <SkipForward className="mr-2 h-5 w-5" />
            דלג
          </Button>
          <Button
            onClick={onRecordValue}
            disabled={isLastCell}
            className="bg-green-600 hover:bg-green-700 text-white h-12 text-base"
          >
            <Type className="mr-2 h-5 w-5" />
            שמור
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CellEditor;
