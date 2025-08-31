
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
    
    for (let i = 0; i < dataRows.length; i++)
    {
      if (dataRows[i][0] != null && dataRows[i][0].trim() == selectedValue.trim() && dataRows[i][1] != null && !optionsMagof.includes(dataRows[i][1].trim()))
      {
        optionsMagof.push(dataRows[i][1].trim());
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
      if (dataRows[i][0] != null && dataRows[i][0].trim() == dropDownValueOfHamama.trim() && dataRows[i][1] != null && dataRows[i][1].trim() == selectedValue.trim())
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
    <div className="bg-card border-2 border-border rounded-xl p-4 shadow-lg">
      {/* Header Section - Consistent on mobile and desktop */}
      <div className="mb-4">
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {headers[currentColumnIndex]}
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
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            onClick={onResetCell}
            variant="outline"
            size="sm"
            disabled={!isCurrentCellModified}
            className="h-9 text-sm"
          >
            מחק
          </Button>
          <Button
            onClick={onSaveProgress}
            variant="outline"
            size="sm"
            className="h-9 text-sm"
            dir="rtl"
          >
            <Save className="mr-1 h-4 w-4" />
            <span>שמור התקדמות</span>
          </Button>
          {onSaveToNewSheet && (
            <Button
              onClick={onSaveToNewSheet}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 h-9 text-sm"
              dir="rtl"
            >
              <Save className="mr-1 h-4 w-4" />
              <span>שמור לגיליון חדש</span>
            </Button>
          )}
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
            placeholder={dataRows[currentRowIndex][currentColumnIndex]}
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

// Fixed bottom action bar that stays visible when keyboard opens
const FixedActionBar = ({ 
  onMovePrevious, 
  onSkipCurrent, 
  onRecordValue,
  isFirstCell,
  isLastCell 
}: {
  onMovePrevious: () => void;
  onSkipCurrent: () => void;
  onRecordValue: () => Promise<void>;
  isFirstCell: boolean;
  isLastCell: boolean;
}) => (
  <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50 safe-area-bottom">
    <div className="flex justify-between items-center max-w-md mx-auto">
      <Button
        onClick={onMovePrevious}
        disabled={isFirstCell}
        variant="outline"
        className="h-11 px-6 text-base"
      >
        <ChevronLeft className="mr-2 h-5 w-5" />
        חזור
      </Button>

      <div className="flex gap-3">
        <Button
          onClick={onSkipCurrent}
          disabled={isLastCell}
          variant="outline"
          className="text-orange-600 border-orange-300 hover:bg-orange-50 h-11 px-4 text-base"
        >
          <SkipForward className="mr-2 h-5 w-5" />
          דלג
        </Button>
        <Button
          onClick={onRecordValue}
          disabled={isLastCell}
          className="bg-green-600 hover:bg-green-700 text-white h-11 px-6 text-base"
        >
          <Type className="mr-2 h-5 w-5" />
          שמור
        </Button>
      </div>
    </div>
  </div>
);

// Main component with fixed action bar for mobile
const CellEditorWithFixedActions = (props: CellEditorProps) => {
  return (
    <>
      <div className="pb-24"> {/* Add padding to prevent overlap with fixed bar */}
        <CellEditor {...props} />
      </div>
      <FixedActionBar 
        onMovePrevious={props.onMovePrevious}
        onSkipCurrent={props.onSkipCurrent} 
        onRecordValue={props.onRecordValue}
        isFirstCell={props.isFirstCell}
        isLastCell={props.isLastCell}
      />
    </>
  );
};

export default CellEditorWithFixedActions;
