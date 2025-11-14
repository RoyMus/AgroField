import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCellStyling } from "@/hooks/useCellStyling";
import { applyCellFormatToStyle, extractStylesFromSheetData } from "@/utils/formatConverters";
import { SheetData, ModifiedCellData } from "@/types/cellTypes";
import { useModifiedData } from "@/contexts/ModifiedDataContext";
import { set } from "date-fns";

interface EditableSheetTableProps {
  sheetData: SheetData;
  onSaveProgress: (newData: SheetData) => void;
}

const EditableSheetTable = ({ sheetData, onSaveProgress }: EditableSheetTableProps) => {
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [localData, setLocalData] = useState<string[][]>([]);
  const { modifiedData, setModifiedData } = useModifiedData();
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const {
    getCellStyle,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    loadInitialStyles,
    clearStyles,
    saveStyles
  } = useCellStyling(sheetData.sheetName);

  // Initialize local data from sheet data and apply modifications
  useEffect(() => {
    if (sheetData?.values) {
      // Load initial styles from sheet data if available
      if (sheetData.formatting) {
        loadInitialStyles(sheetData.formatting);
      }
      
      const baseData = sheetData.values.map(row => [...row]); // Deep copy
      // Apply modifications from localStorage
      Object.values(modifiedData).forEach(modification => {
        const { rowIndex, columnIndex, modifiedValue } = modification;
        
        // Extend rows if needed
        while (baseData.length <= rowIndex) {
          baseData.push([]);
        }
        
        // Extend columns if needed
        while (baseData[rowIndex].length <= columnIndex) {
          baseData[rowIndex].push("");
        }
        
        baseData[rowIndex][columnIndex] = modifiedValue;
      });
      
      setLocalData(baseData);
    }
  }, [sheetData, modifiedData, loadInitialStyles, clearStyles, sheetData.formatting]);

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
        newData[rowIndex].push("");
      }
      
      newData[rowIndex][colIndex] = value;
      return newData;
    });

    const originalValue = (sheetData.values[rowIndex] && sheetData.values[rowIndex][colIndex]) || "";
    const newModifiedData = { ...modifiedData };

    if (originalValue !== value) {
      newModifiedData[`${rowIndex}-${colIndex}`] = {
        originalValue,
        modifiedValue: value,
        rowIndex,
        columnIndex: colIndex
      };
    } else {
      delete newModifiedData[`${rowIndex}-${colIndex}`];
    }
  }, [sheetData, modifiedData]);

  const handleCellFocus = (rowIndex: number, colIndex: number) => {
    setSelectedCell({ rowIndex, colIndex });
  };

  // Add new row
  const addRow = () => {
    const newRow = new Array(maxCols).fill("");
    const insertIndex = selectedCell ? selectedCell.rowIndex + 1 : localData.length;
    setLocalData(prev => {
      const updated = [...prev];
      updated.splice(insertIndex, 0, newRow); // insert *after* old row
      return updated;
    });
    insertRow(insertIndex); // Update styles
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
      deleteRow(removeIndex); // Update styles
    }
  };

  // Add new column
  const addColumn = () => {
    const insertIndex = selectedCell ? selectedCell.colIndex + 1 : maxCols;
    setLocalData(prev => {
      const updated = [...prev];
      updated.forEach(row => {
        row.splice(insertIndex, 0, "");
      });
      return updated;
    });
    insertColumn(insertIndex); // Update styles
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
      deleteColumn(removeIndex); // Update styles
    }
  };

  // Save current modifications
  const saveModifications = async () => {
    if (isSaving) return;
    // Create new modifications object
  const newModifications: Record<string, ModifiedCellData> = {};
    
    // Create new sheet data values
    // Create new sheet data values matching the current dimensions
  const newSheetValues: string[][] = [];
  
  // Get current dimensions
  const currentRows = localData.length;
  const currentCols = Math.max(...localData.map(row => row.length), 0);
  
  // Initialize newSheetValues with current dimensions
  for (let r = 0; r < currentRows; r++) {
    newSheetValues[r] = new Array(currentCols).fill("");
  }
  
  // Copy current values and track modifications
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const currentValue = localData[r][c] || "";
      const originalValue = (sheetData.values[r] && sheetData.values[r][c]) || "";
      
      // Set the value in new sheet data
      newSheetValues[r][c] = currentValue;
      
      // Track modification if value is different from original
      if (originalValue !== currentValue) {
        newModifications[`${r}-${c}`] = {
          originalValue,
          modifiedValue: currentValue,
          rowIndex: r,
          columnIndex: c
        };
      }
    }
  }
    const hasChanges = Object.keys(newModifications).length > 0;

    if (!hasChanges) {
      toast({
        title: "No changes to save",
        description: "There are no modifications to save.",
      });
      return;
    }
    
    setIsSaving(true);

    try {
      // The context already saved to localStorage.
      // We just need to save styles and inform the parent.
      saveStyles();

      const updatedSheetData: SheetData = {
        ...sheetData,
        values: localData
      };

      // Sync with other pages
      onSaveProgress(updatedSheetData);
      
      toast({
        title: "Progress Saved",
        description: `Saved modifications for ${Object.keys(newModifications).length} cells with formatting`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate maximum columns needed
  const maxCols = Math.max(...localData.map(row => row.length), 0);
  const hasChanges = Object.keys(modifiedData).length > 0;

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
          <span className="text-sm text-gray-600 text-center sm:text-left">
            {Object.keys(modifiedData).length} cells modified
          </span>
          <Button
            onClick={saveModifications}
            variant="outline"
            className="h-10 text-sm"
            disabled={!hasChanges || isSaving}
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
                    const cellStyle = getCellStyle(rowIndex, colIndex);
                    const cellCssStyle = cellStyle ? applyCellFormatToStyle(cellStyle) : {};
                    
                    return (
                      <td key={colIndex} className="border-r border-b p-0">
                        <Input
                          value={row[colIndex] || ""}
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

      {/* Info */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Rows:</strong> {localData.length} | <strong>Columns:</strong> {maxCols} | <strong>Modified Cells:</strong> {Object.keys(modifiedData).length}
        </p>
        <p className="mt-1">
          שינויים מסונכרנים עם תצוגת הגיליון ומאוחסנים מקומית. השתמש ב-"שמור לגיליון חדש" בתצוגה כדי ליצור גיליון Google עם השינויים שלך.
        </p>
      </div>
    </div>
  );
};

export default EditableSheetTable;