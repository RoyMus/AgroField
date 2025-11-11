import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCellStyling } from "@/hooks/useCellStyling";
import { applyCellFormatToStyle, extractStylesFromSheetData } from "@/utils/formatConverters";
import { SheetData, ModifiedCellData } from "@/types/cellTypes";
import { set } from "date-fns";

interface EditableSheetTableProps {
  sheetData: SheetData;
  onSaveProgress: (newData: SheetData) => void;
}

const EditableSheetTable = ({ sheetData, onSaveProgress }: EditableSheetTableProps) => {
  const [localData, setLocalData] = useState<string[][]>([]);
  const [modifiedData, setModifiedData] = useState<Record<string, ModifiedCellData>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  
  // Calculate max columns from local data
  const maxCols = Math.max(...(localData.length > 0 ? localData.map(row => row.length) : [0]), 0);
  
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

  // Load saved modifications from localStorage and apply to sheet data
  useEffect(() => {
    const savedModifications = localStorage.getItem('all_sheet_modifications');
    if (savedModifications) {
      const parsedModifications = JSON.parse(savedModifications);
      setModifiedData(parsedModifications[sheetData.sheetName] || {});
    }
  }, [sheetData.sheetName]);

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
      setHasChanges(Object.keys(modifiedData).length > 0);
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
    
    // Track modification
    const originalValue = (sheetData.values[rowIndex] && sheetData.values[rowIndex][colIndex]) || "";
    const cellKey = `${rowIndex}-${colIndex}`;
    
    setModifiedData(prev => {
      const updated = { ...prev };
      
      if (originalValue === value) {
        // Value returned to original, remove modification
        delete updated[cellKey];
      } else {
        // Value changed, track it
        updated[cellKey] = {
          originalValue,
          modifiedValue: value,
          rowIndex,
          columnIndex: colIndex
        };
      }
      
      return updated;
    });
    
    setHasChanges(true);
  }, [sheetData]);

  // Add new row
  const addRow = () => {
    setLocalData(prev => {
      const currentMaxCols = Math.max(...prev.map(row => row.length), 0);
      const newRow = new Array(currentMaxCols).fill("");
      const insertIndex = prev.length - 3; // Insert at second to last position
      const updated = [...prev];
      updated.splice(insertIndex + 1, 0, newRow); // insert *after* old row
      return updated;
    });
    const insertIndex = localData.length - 3;
    insertRow(insertIndex + 1); // Update styles
    setHasChanges(true);
  };

  // Remove last row
  const removeRow = () => {
    if (localData.length > 1) {
      const removeIndex = localData.length - 3;
      setLocalData(prev => {
        const updated = [...prev];
        updated.splice(removeIndex, 1);
        return updated;
      });
      deleteRow(removeIndex); // Update styles
      setHasChanges(true);
    }
  };

  // Add new column
  const addColumn = () => {
    setLocalData(prev => {
      const currentMaxCols = Math.max(...prev.map(row => row.length), 0);
      const insertIndex = currentMaxCols;
      const updated = prev.map(row => {
        const newRow = [...row];
        // Ensure row has the right length before adding
        while (newRow.length < currentMaxCols) {
          newRow.push("");
        }
        newRow.push(""); // Add new column at the end
        return newRow;
      });
      return updated;
    });
    const currentMaxCols = Math.max(...localData.map(row => row.length), 0);
    insertColumn(currentMaxCols); // Update styles
    setHasChanges(true);
  };

  // Remove last column
  const removeColumn = () => {
    if (maxCols <= 1) return;
    
    setLocalData(prev => {
      const currentMaxCols = Math.max(...prev.map(row => row.length), 0);
      const removeIndex = currentMaxCols - 1;
      return prev.map(row => {
        const newRow = [...row];
        if (newRow.length > removeIndex) {
          newRow.splice(removeIndex, 1);
        }
        return newRow;
      });
    });
    const currentMaxCols = Math.max(...localData.map(row => row.length), 0);
    deleteColumn(currentMaxCols - 1); // Update styles
    setHasChanges(true);
  };

  // Save current modifications
  const saveModifications = () => {
    // Get current dimensions
    const currentRows = localData.length;
    const currentCols = Math.max(...localData.map(row => row.length), 0);
    
    // Create new sheet data values matching current dimensions
    const newSheetValues: string[][] = [];
    for (let r = 0; r < currentRows; r++) {
      newSheetValues[r] = new Array(currentCols).fill("");
      for (let c = 0; c < currentCols; c++) {
        newSheetValues[r][c] = localData[r][c] || "";
      }
    }
    
    // Save styles and get current style formatting
    saveStyles();
    const currentStyles = getCellStyle ? 
      Array.from({ length: currentRows }, (_, r) =>
        Array.from({ length: currentCols }, (_, c) => ({
          rowIndex: r,
          columnIndex: c,
          format: getCellStyle(r, c) || {}
        }))
      ).flat().filter(style => Object.keys(style.format).length > 0) : [];
    
    // Update local storage - clear modifications for this sheet since we're saving
    const allModifications = JSON.parse(localStorage.getItem('all_sheet_modifications') || '{}');
    allModifications[sheetData.sheetName] = {};
    localStorage.setItem('all_sheet_modifications', JSON.stringify(allModifications));
    
    // Clear modification tracking
    setModifiedData({});
    setHasChanges(false);
    
    // Create new sheet data with updated values and formatting
    const updatedSheetData: SheetData = {
      ...sheetData,
      values: newSheetValues,
      formatting: currentStyles
    };
    
    // Sync with other pages
    onSaveProgress(updatedSheetData);
    
    // Show success message
    toast({
      title: "Progress Saved",
      description: `Saved ${currentRows} rows and ${currentCols} columns with formatting`,
    });
  };


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
            disabled={localData.length <= 1}
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
            disabled={maxCols <= 1}
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
            disabled={!hasChanges}
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
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="border-0 rounded-none focus:ring-2 focus:ring-blue-500 focus:ring-inset h-8 text-sm"
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