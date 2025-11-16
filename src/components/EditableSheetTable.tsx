import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus } from "lucide-react";
import { toast, useToast } from "@/hooks/use-toast";
import { useCellStyling } from "@/hooks/useCellStyling";
import { applyCellFormatToStyle, extractStylesFromSheetData } from "@/utils/formatConverters";
import { ModifiedSheet, ModifiedCell, getValue } from "@/types/cellTypes";
import { set } from "date-fns";

interface EditableSheetTableProps {
  sheetData: ModifiedSheet;
  onSaveProgress: (data: ModifiedCell[][]) => void;
}

const EditableSheetTable = ({ sheetData, onSaveProgress }: EditableSheetTableProps) => {
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [localData, setLocalData] = useState<ModifiedCell[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize local data from sheet data and apply modifications
  useEffect(() => {
    if (sheetData?.values) {
      const baseData = sheetData.values.map(row => [...row]); // Deep copy
      setLocalData(baseData);
    }
  }, []);
  // Handle cell value changes and sync with localStorage
  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    // Update local data
    setLocalData(prev => {
      const newData = prev.map(row => [...row]);
      
      // Extend rows if needed
      while (newData.length <= rowIndex) {
        newData.push([]);
      }
      
      // Extend columns if needed
      while (newData[rowIndex].length <= colIndex) {
        newData[rowIndex].push({ original: "", modified: null,formatting: {} });
      }
      newData[rowIndex][colIndex].modified = value;
      return newData;
    });
  }, [sheetData]);

  const handleCellFocus = (rowIndex: number, colIndex: number) => {
    setSelectedCell({ rowIndex, colIndex });
  };

  // Add new row
  const addRow = () => {
    const newRow = new Array(maxCols).fill({ original: "", modified: null, formatting: {} });
    const insertIndex = selectedCell ? selectedCell.rowIndex + 1 : localData.length;
    setLocalData(prev => {
      const updated = [...prev];
      updated.splice(insertIndex, 0, newRow);
      return updated;
    });
  };

  // Remove last row
  const removeRow = () => {
    if (localData.length > 1 && selectedCell) {
      const removeIndex = selectedCell.rowIndex;
      setLocalData(prev => {
        const updated = [...prev];
        updated.splice(removeIndex, 1);
        return updated;
      });
    }
  };

  // Add new column
  const addColumn = () => {
    const insertIndex = selectedCell ? selectedCell.colIndex + 1 : maxCols;
    setLocalData(prev => {
      const updated = [...prev];
      updated.forEach(row => {
        row.splice(insertIndex, 0, { original: "", modified: null, formatting: {} });
      });
      return updated;
    });
  };

  // Remove last column
  const removeColumn = () => {
    if (maxCols > 0 && selectedCell) {
      const removeIndex = selectedCell.colIndex;
      setLocalData(prev => prev.map(row => {
        const newRow = [...row];
        newRow.splice(removeIndex, 1);
        return newRow;
      }));
    }
  };

  // Save current modifications
  const saveModifications = async () => {
    if (isSaving) return;
    setIsSaving(true);
    toast(
      {
        title: "השינויים נשמרו בהצלחה!",
        description: "ההתקדמות שלך נשמרה בהצלחה",
      }
    );
    try {
      onSaveProgress(localData);
    } 
    finally {
      setIsSaving(false);
    }
  };

  // Calculate maximum columns needed
  const maxCols = Math.max(...localData.map(row => row.length), 0);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Toolbar - Mobile Optimized */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        {/* Row/Column Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button
            onClick={addRow}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">הוסף שורה</span>
          </Button>
          <Button
            onClick={removeRow}
            variant="outline"
            size="sm"
            disabled={localData.length <= 1 || !selectedCell}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="sm:inline">מחק שורה</span>
          </Button>
          <Button
            onClick={addColumn}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">הוסף עמודה</span>
          </Button>
          <Button
            onClick={removeColumn}
            variant="outline"
            size="sm"
            disabled={maxCols <= 1 || !selectedCell}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="sm:inline">מחק עמודה</span>
          </Button>
        </div>
        
        {/* Save Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2">
          <Button
            onClick={saveModifications}
            variant="outline"
            className="h-10 text-sm"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-1" />
            <span>שמור התקדמות</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-2 py-2 text-xs font-medium text-gray-500 text-center border-r border-b">
                  #
                </th>
                {Array.from({ length: maxCols }, (_, colIndex) => (
                  <th
                    key={colIndex}
                    className="px-2 py-2 text-xs font-medium text-gray-500 text-center border-r border-b min-w-[120px]"
                  >
                    {String.fromCharCode(65 + (colIndex % 26))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="w-12 px-2 py-1 text-xs text-gray-500 text-center border-r bg-gray-50 font-medium">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIndex) => {
                    const cellCssStyle = localData?.[rowIndex]?.[colIndex]?.formatting
                    
                    return (
                      <td key={colIndex} className="border-r border-b p-0">
                        <Input
                          value={ row[colIndex] ? getValue(row[colIndex]) : "" }
                          onFocus={() => handleCellFocus(rowIndex, colIndex)}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className={`border-0 rounded-none focus:ring-2 focus:ring-blue-500 focus:ring-inset h-8 text-sm ${
                            selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex
                              ? "ring-2 ring-blue-500"
                              : ""
                          }`}
                          style={cellCssStyle}
                          placeholder=""
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EditableSheetTable;