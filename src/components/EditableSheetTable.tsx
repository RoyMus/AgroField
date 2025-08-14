import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCellStyling } from "@/hooks/useCellStyling";
import { applyCellFormatToStyle, extractStylesFromSheetData } from "@/utils/formatConverters";
import { SheetData, ModifiedCellData } from "@/types/cellTypes";

interface EditableSheetTableProps {
  sheetData: SheetData;
}

const EditableSheetTable = ({ sheetData }: EditableSheetTableProps) => {
  const [localData, setLocalData] = useState<string[][]>([]);
  const [modifiedData, setModifiedData] = useState<Record<string, ModifiedCellData>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  
  const {
    cellStyles,
    getCellStyle,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    loadInitialStyles,
    clearStyles
  } = useCellStyling();

  // Load saved modifications from localStorage and apply to sheet data
  useEffect(() => {
    const savedModifications = localStorage.getItem('sheet_cell_modifications');
    if (savedModifications) {
      setModifiedData(JSON.parse(savedModifications));
    }
  }, []);

  // Initialize local data from sheet data and apply modifications
  useEffect(() => {
    if (sheetData?.values) {
      const baseData = sheetData.values.map(row => [...row]); // Deep copy
      
      // Load initial styles if available
      if (sheetData.formatting) {
        loadInitialStyles(sheetData.formatting);
      } else {
        // Clear styles if no formatting data
        clearStyles();
      }
      
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
  }, [sheetData, modifiedData, loadInitialStyles, clearStyles]);

  // Handle cell value changes and sync with localStorage
  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    const cellKey = `${rowIndex}-${colIndex}`;
    const originalValue = sheetData?.values?.[rowIndex]?.[colIndex] || "";
    
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
    
    // Update modifiedData and sync to localStorage
    const newModifiedData = { ...modifiedData };
    
    if (value === originalValue || value === "") {
      // Remove from modifications if reverting to original or empty
      delete newModifiedData[cellKey];
    } else {
      // Add/update modification
      newModifiedData[cellKey] = {
        originalValue,
        modifiedValue: value,
        rowIndex,
        columnIndex: colIndex
      };
    }
    
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(newModifiedData));
    setHasChanges(Object.keys(newModifiedData).length > 0);
  }, [sheetData, modifiedData]);

  // Add new row
  const addRow = () => {
    const maxCols = Math.max(...localData.map(row => row.length), 0);
    const newRow = new Array(maxCols).fill("");
    const insertIndex = localData.length; // Insert at end
    
    setLocalData(prev => [...prev, newRow]);
    insertRow(insertIndex); // Update styles
    setHasChanges(true);
  };

  // Remove last row
  const removeRow = () => {
    if (localData.length > 1) {
      const removeIndex = localData.length - 1;
      setLocalData(prev => prev.slice(0, -1));
      deleteRow(removeIndex); // Update styles
      setHasChanges(true);
    }
  };

  // Add new column
  const addColumn = () => {
    const insertIndex = Math.max(...localData.map(row => row.length), 0);
    setLocalData(prev => prev.map(row => [...row, ""]));
    insertColumn(insertIndex); // Update styles
    setHasChanges(true);
  };

  // Remove last column
  const removeColumn = () => {
    const maxCols = Math.max(...localData.map(row => row.length), 0);
    if (maxCols > 1) {
      const removeIndex = maxCols - 1;
      setLocalData(prev => prev.map(row => row.slice(0, -1)));
      deleteColumn(removeIndex); // Update styles
      setHasChanges(true);
    }
  };

  // Save current modifications
  const saveModifications = () => {
    const modifiedDataWithStyles = {
      ...modifiedData,
      _styles: cellStyles // Include styles in saved data
    };
    localStorage.setItem('sheet_cell_modifications', JSON.stringify(modifiedData));
    localStorage.setItem('sheet_cell_styles', JSON.stringify(cellStyles));
    
    toast({
      title: "Progress Saved",
      description: `Saved modifications for ${Object.keys(modifiedData).length} cells with formatting`,
    });
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
            <span className="hidden sm:inline">Add Row</span>
            <span className="sm:hidden">הוסף שורה</span>
          </Button>
          <Button
            onClick={removeRow}
            variant="outline"
            size="sm"
            disabled={localData.length <= 1}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">מחק שורה</span>
            <span className="sm:hidden">Row -</span>
          </Button>
          <Button
            onClick={addColumn}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Add Column</span>
            <span className="sm:hidden">הוסף עמודה</span>
          </Button>
          <Button
            onClick={removeColumn}
            variant="outline"
            size="sm"
            disabled={maxCols <= 1}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">מחק עמודה</span>
            <span className="sm:hidden">Col -</span>
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
            disabled={Object.keys(modifiedData).length === 0}
          >
            <Save className="w-4 h-4 mr-1" />
            <span>Save Progress</span>
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