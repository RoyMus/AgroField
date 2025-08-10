
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, SkipForward, Save, Type } from "lucide-react";
import VoiceControls from "./VoiceControls";

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
            חממה {dataRows[currentRowIndex][0]}
          </h3>
          <h3 className="text-lg font-semibold">
            מגוף {dataRows[currentRowIndex][1]}
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
            שמור התקדמות
          </Button>
          {onSaveToNewSheet && (
            <Button
              onClick={onSaveToNewSheet}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-1 h-4 w-4" />
              שמור לגיליון חדש
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
