
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, SkipForward, Save, Type } from "lucide-react";
import VoiceControls from "./VoiceControls";
import SimpleDropdown from "./ui/simpleDropdown";
import { useEffect, useState} from "react";
import { ModifiedCell,isModified,getValue } from "@/types/cellTypes";

interface CellEditorProps {
  currentRowIndex: number;
  currentColumnIndex: number;
  rowChangeCounter: number;
  headers: ModifiedCell[];
  dataRows: ModifiedCell[][];
  currentValue: string;
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
  const isCurrentCellModified = isModified(dataRows[currentRowIndex][currentColumnIndex]);
  const [optionsHamama, setOptionsHamama] = useState([]);
  const [currentHamama, setCurrentHamama] = useState(null);
  const [optionsMagof, setOptionsMagof] = useState([]);
  const [currentMagof, setCurrentMagof] = useState(null);
  const [optionsGidul, setOptionsGidul] = useState([]);
  const [dropDownValueOfHamama, setDropDownHamama] = useState(null);
  const [dropDownValueOfMagof, setDropDownMagof] = useState(null);
  const [dropDownValueOfGidul, setDropDownGidul] = useState(null);
  
  const handleChangedRow = () => {
    let curHam = getValue(dataRows[currentRowIndex][0]).trim();
    let curMag = getValue(dataRows[currentRowIndex][1]).trim();
    let curGid = getValue(dataRows[currentRowIndex][3]);
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
      if (dataRows[i][0] != null && getValue(dataRows[i][0]).trim() == curHam && dataRows[i][1] != null && !optionsMagof.includes(getValue(dataRows[i][1]).trim()))
        optionsMagof.push(getValue(dataRows[i][1]).trim());
    }
    setOptionsMagof([...optionsMagof]);
    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && getValue(dataRows[i][0]).trim() == curHam && dataRows[i][1] != null && getValue(dataRows[i][1]).trim() == curMag)
      {
        optionsGidul.push(getValue(dataRows[i][3]));
      }
    }
    setOptionsGidul([...optionsGidul]);
  };

  const handleSelectHamama = (selectedValue) => {
    while (optionsMagof.length != 0)
      optionsMagof.pop();
    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && getValue(dataRows[i][0]).trim() == selectedValue.trim() && dataRows[i][1] != null && !optionsMagof.includes(getValue(dataRows[i][1]).trim()))
      {
        optionsMagof.push(getValue(dataRows[i][1]).trim());
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
      if (dataRows[i][0] != null && getValue(dataRows[i][0]).trim() == dropDownValueOfHamama.trim() && dataRows[i][1] != null && getValue(dataRows[i][1]).trim() == selectedValue.trim())
      {
        optionsGidul.push(getValue(dataRows[i][3]));
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
      if (dataRows[i][0] != null && getValue(dataRows[i][0]).trim() == dropDownValueOfHamama.trim() && getValue(dataRows[i][1]).trim() == dropDownValueOfMagof.trim() && getValue(dataRows[i][3]).trim() == selectedValue)
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
      if (dataRows[i][0] != null && getValue(dataRows[i][0]) != "" && getValue(dataRows[i][0]) != "חממה" && !optionsHamama.includes(getValue(dataRows[i][0]).trim()))
      {
        optionsHamama.push(getValue(dataRows[i][0]).trim());
      }
      setOptionsHamama([...optionsHamama]);
    }
    handleSelectHamama(optionsHamama[0]);
  }, []);
  
  useEffect (() => {
    handleChangedRow();
  }, [rowChangeCounter]);
  
  return (
    <div className="bg-card border-2 border-border rounded-xl p-4 shadow-lg">
      {/* Header Section - Consistent on mobile and desktop */}
      <div className="mb-4">
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {getValue(headers[currentColumnIndex])}
            {isCurrentCellModified && 
              <span className="ml-2 text-sm text-green-600">(Modified)</span>
            }
          </h3>
          
          {/* Dropdown Controls - Same layout on mobile */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">חממה</span>
              <SimpleDropdown options={optionsHamama} value={dropDownValueOfHamama} onSelect={handleSelectHamama} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">מגוף</span>
              <SimpleDropdown options={optionsMagof} value={dropDownValueOfMagof} onSelect={handleSelectMagof} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">גידול</span>
              <SimpleDropdown options={optionsGidul} value={dropDownValueOfGidul} onSelect={handleSelectGidul} />
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Cell {currentRowIndex * headers.length + currentColumnIndex + 1} of {dataRows.length * headers.length}
          </p>
        </div>
        
        {/* Top Action Buttons - Always visible */}
        <div className="mt-4 space-y-2">
          <div className="flex">
          <Button
            onClick={onResetCell}
            variant="outline"
            size="sm"
            disabled={!isCurrentCellModified}
            className="h-9 text-sm"
          >
            מחק
          </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onMovePrevious}
            disabled={isFirstCell}
            variant="outline"
            className="h-9 px-4 text-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            חזור
          </Button>
          <Button
            onClick={onSkipCurrent}
            disabled={isLastCell}
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50 h-9 px-4 text-sm"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            דלג
          </Button>
          <Button
            onClick={onRecordValue}
            disabled={isLastCell}
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 text-sm"
          >
            <Type className="mr-2 h-4 w-4" />
            שמור
          </Button>
      </div>
      </div>
      {/* Input Section */}
      <div className="mb-4">        
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Value:
          </label>
          <Input
            value={currentValue}
            onChange={(e) => onInputChange(e.target.value)}
            onInput={(e)=> onInputChange((e.target as HTMLInputElement).value)}
            placeholder={
              getValue(dataRows[currentRowIndex][currentColumnIndex])
            }
            className="text-base p-3 h-11"
            autoFocus
          />
        </div>
      </div>

      {/* Voice Recording Controls */}
      <div className="mb-4">
        <VoiceControls
          isRecording={isRecording}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
        />
      </div>
    </div>
  );
};

export default CellEditor;
