import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Download, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SheetData {
  values: string[][];
  sheetName: string;
}

interface EditableSheetTableProps {
  sheetData: SheetData;
}

const EditableSheetTable = ({ sheetData }: EditableSheetTableProps) => {
  const [localData, setLocalData] = useState<string[][]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  // Initialize local data from sheet data
  useEffect(() => {
    if (sheetData?.values) {
      setLocalData(sheetData.values.map(row => [...row])); // Deep copy
      setHasChanges(false);
    }
  }, [sheetData]);

  // Handle cell value changes
  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
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
    setHasChanges(true);
  }, []);

  // Add new row
  const addRow = () => {
    const maxCols = Math.max(...localData.map(row => row.length), 0);
    const newRow = new Array(maxCols).fill("");
    setLocalData(prev => [...prev, newRow]);
    setHasChanges(true);
  };

  // Remove last row
  const removeRow = () => {
    if (localData.length > 1) {
      setLocalData(prev => prev.slice(0, -1));
      setHasChanges(true);
    }
  };

  // Add new column
  const addColumn = () => {
    setLocalData(prev => prev.map(row => [...row, ""]));
    setHasChanges(true);
  };

  // Remove last column
  const removeColumn = () => {
    const maxCols = Math.max(...localData.map(row => row.length), 0);
    if (maxCols > 1) {
      setLocalData(prev => prev.map(row => row.slice(0, -1)));
      setHasChanges(true);
    }
  };

  // Export current data as CSV
  const exportToCSV = () => {
    const csv = localData.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheetData.sheetName || 'sheet'}_edited.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported successfully",
      description: "Your edited sheet has been downloaded as CSV.",
    });
  };

  // Calculate maximum columns needed
  const maxCols = Math.max(...localData.map(row => row.length), 0);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Button
            onClick={addRow}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </Button>
          <Button
            onClick={removeRow}
            variant="outline"
            size="sm"
            disabled={localData.length <= 1}
            className="flex items-center space-x-2"
          >
            <Minus className="w-4 h-4" />
            <span>Remove Row</span>
          </Button>
          <Button
            onClick={addColumn}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Column</span>
          </Button>
          <Button
            onClick={removeColumn}
            variant="outline"
            size="sm"
            disabled={maxCols <= 1}
            className="flex items-center space-x-2"
          >
            <Minus className="w-4 h-4" />
            <span>Remove Column</span>
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <span className="text-sm text-amber-600 font-medium">
              Unsaved changes
            </span>
          )}
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
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
                  {Array.from({ length: maxCols }, (_, colIndex) => (
                    <td key={colIndex} className="border-r border-b p-0">
                      <Input
                        value={row[colIndex] || ""}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        className="border-0 rounded-none focus:ring-2 focus:ring-blue-500 focus:ring-inset h-8 text-sm"
                        placeholder=""
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Rows:</strong> {localData.length} | <strong>Columns:</strong> {maxCols}
        </p>
        <p className="mt-1">
          Changes are made locally and won't affect the original Google Sheet until explicitly saved.
        </p>
      </div>
    </div>
  );
};

export default EditableSheetTable;