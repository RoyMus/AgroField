import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCellStyling } from "@/hooks/useCellStyling";
import { applyCellFormatToStyle } from "@/utils/formatConverters";
import { SheetData } from "@/types/cellTypes";
import { useSheetModificationsContext } from "@/contexts/SheetModificationsContext";

interface EditableSheetTableProps {
  sheetData: SheetData;
  onSaveProgress: (newData: SheetData) => void;
}

const EditableSheetTable = ({ sheetData, onSaveProgress }: EditableSheetTableProps) => {
  const { toast } = useToast();
  const { 
    modifications,
    getCurrentData,
    updateCell,
    addRow,
    removeRow,
    addColumn,
    removeColumn,
    getChangeCount 
  } = useSheetModificationsContext();

  const {
    getCellStyle,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    loadInitialStyles,
    saveStyles
  } = useCellStyling(sheetData.sheetName);

  // Get current data with all modifications applied
  const localData = getCurrentData();
  const maxCols = Math.max(...localData.map(row => row.length), 0);

  // Find headers row and max column index
  const [maxColIndex, setMaxColIndex] = useState(0);

  useEffect(() => {
    let foundHeadersRowIndex = 0;
    for (let i = 0; i < sheetData.values.length; i++) {
      if (sheetData.values[i][0] != null && sheetData.values[i][0].trim() !== "") {
        foundHeadersRowIndex = i;
        break;
      }
    }
    
    const headers = sheetData.values[foundHeadersRowIndex] || [];
    let alreadySetFirst = false;
    let lastIndex = headers.length - 1;
    
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === "") {
        if (!alreadySetFirst) {
          alreadySetFirst = true;
        } else {
          lastIndex = i - 1;
          break;
        }
      }
    }
    
    setMaxColIndex(lastIndex);
  }, [sheetData]);

  // Load initial styles from sheet data
  useEffect(() => {
    if (sheetData?.formatting) {
      loadInitialStyles(sheetData.formatting);
    }
  }, [sheetData?.formatting, loadInitialStyles]);

  // Handle cell value changes
  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    updateCell(rowIndex, colIndex, value);
  }, [updateCell]);

  // Add new row
  const handleAddRow = () => {
    const insertIndex = localData.length - 2; // Insert before last two rows
    addRow(insertIndex);
    insertRow(insertIndex);
  };

  // Remove last data row
  const handleRemoveRow = () => {
    if (localData.length > 1) {
      const removeIndex = localData.length - 3;
      removeRow(removeIndex);
      deleteRow(removeIndex);
    }
  };

  // Add new column
  const handleAddColumn = () => {
    const insertIndex = maxColIndex + 1;
    addColumn(insertIndex);
    insertColumn(insertIndex);
    setMaxColIndex(insertIndex);
  };

  // Remove last column
  const handleRemoveColumn = () => {
    if (maxColIndex > 0) {
      removeColumn(maxColIndex);
      deleteColumn(maxColIndex);
      setMaxColIndex(maxColIndex - 1);
    }
  };

  // Save current modifications
  const saveModifications = () => {
    // Save styles
    saveStyles();

    // Create new sheet data with current values
    const updatedSheetData: SheetData = {
      ...sheetData,
      values: localData,
      formatting: modifications.cellStyles,
    };

    // Sync with other pages
    onSaveProgress(updatedSheetData);

    toast({
      title: "Progress Saved",
      description: `Saved ${getChangeCount()} changes with formatting`,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        {/* Row/Column Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button
            onClick={handleAddRow}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">הוסף שורה</span>
          </Button>
          <Button
            onClick={handleRemoveRow}
            variant="outline"
            size="sm"
            disabled={localData.length <= 1}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="sm:inline">מחק שורה</span>
          </Button>
          <Button
            onClick={handleAddColumn}
            variant="outline"
            size="sm"
            className="h-10 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">הוסף עמודה</span>
          </Button>
          <Button
            onClick={handleRemoveColumn}
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
            {getChangeCount()} changes
          </span>
          <Button
            onClick={saveModifications}
            variant="outline"
            className="h-10 text-sm"
            disabled={getChangeCount() === 0}
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
          <strong>Rows:</strong> {localData.length} | <strong>Columns:</strong> {maxCols} | <strong>Changes:</strong> {getChangeCount()}
        </p>
        <p className="mt-1">
          שינויים מסונכרנים עם תצוגת הגיליון ומאוחסנים מקומית. השתמש ב-"שמור לגיליון חדש" בתצוגה כדי ליצור גיליון Google עם השינויים שלך.
        </p>
      </div>
    </div>
  );
};

export default EditableSheetTable;
