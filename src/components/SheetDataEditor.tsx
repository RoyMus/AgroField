
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, SkipForward, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SheetData {
  sheetName: string;
  values: string[][];
  metadata: {
    title: string;
    sheetCount: number;
  };
}

interface ModifiedRowData {
  originalRow: string[];
  modifiedRow: string[];
  rowIndex: number;
}

interface SheetDataEditorProps {
  sheetData: SheetData;
}

const SheetDataEditor = ({ sheetData }: SheetDataEditorProps) => {
  const [currentRowIndex, setCurrentRowIndex] = useState(1); // Start from row 1 (skip header)
  const [modifiedData, setModifiedData] = useState<Record<number, ModifiedRowData>>({});
  const [currentRowValues, setCurrentRowValues] = useState<string[]>([]);
  const { toast } = useToast();

  const headers = sheetData.values[0] || [];
  const dataRows = sheetData.values.slice(1);

  useEffect(() => {
    // Load saved modifications from localStorage
    const savedModifications = localStorage.getItem('sheet_modifications');
    if (savedModifications) {
      setModifiedData(JSON.parse(savedModifications));
    }
  }, []);

  useEffect(() => {
    // Set current row values when row index changes
    if (dataRows[currentRowIndex - 1]) {
      const savedModification = modifiedData[currentRowIndex - 1];
      if (savedModification) {
        setCurrentRowValues([...savedModification.modifiedRow]);
      } else {
        setCurrentRowValues([...dataRows[currentRowIndex - 1]]);
      }
    }
  }, [currentRowIndex, dataRows, modifiedData]);

  const saveModifications = () => {
    localStorage.setItem('sheet_modifications', JSON.stringify(modifiedData));
    toast({
      title: "Progress Saved",
      description: `Saved modifications for ${Object.keys(modifiedData).length} rows`,
    });
  };

  const handleValueChange = (columnIndex: number, value: string) => {
    const newValues = [...currentRowValues];
    newValues[columnIndex] = value;
    setCurrentRowValues(newValues);
  };

  const saveCurrentRow = () => {
    const originalRow = dataRows[currentRowIndex - 1];
    const newModifiedData = {
      ...modifiedData,
      [currentRowIndex - 1]: {
        originalRow: [...originalRow],
        modifiedRow: [...currentRowValues],
        rowIndex: currentRowIndex - 1
      }
    };
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_modifications', JSON.stringify(newModifiedData));
  };

  const handleNext = () => {
    saveCurrentRow();
    if (currentRowIndex < dataRows.length) {
      setCurrentRowIndex(currentRowIndex + 1);
    }
  };

  const handlePrevious = () => {
    saveCurrentRow();
    if (currentRowIndex > 1) {
      setCurrentRowIndex(currentRowIndex - 1);
    }
  };

  const handleSkip = () => {
    if (currentRowIndex < dataRows.length) {
      setCurrentRowIndex(currentRowIndex + 1);
    }
  };

  const resetCurrentRow = () => {
    const originalRow = dataRows[currentRowIndex - 1];
    setCurrentRowValues([...originalRow]);
    
    // Remove from modified data if it exists
    const newModifiedData = { ...modifiedData };
    delete newModifiedData[currentRowIndex - 1];
    setModifiedData(newModifiedData);
    localStorage.setItem('sheet_modifications', JSON.stringify(newModifiedData));
  };

  const getModificationStats = () => {
    const totalRows = dataRows.length;
    const modifiedRows = Object.keys(modifiedData).length;
    return { totalRows, modifiedRows, remainingRows: totalRows - modifiedRows };
  };

  const stats = getModificationStats();
  const isModified = modifiedData[currentRowIndex - 1] !== undefined;

  if (dataRows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data rows found in the sheet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Stats */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Progress Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.modifiedRows}</div>
            <div className="text-blue-700">Modified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.remainingRows}</div>
            <div className="text-gray-700">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.totalRows}</div>
            <div className="text-gray-700">Total</div>
          </div>
        </div>
      </div>

      {/* Current Row Editor */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Row {currentRowIndex} of {dataRows.length}
            {isModified && <span className="ml-2 text-sm text-green-600">(Modified)</span>}
          </h3>
          <div className="flex gap-2">
            <Button
              onClick={resetCurrentRow}
              variant="outline"
              size="sm"
              disabled={!isModified}
            >
              Reset
            </Button>
            <Button
              onClick={saveModifications}
              variant="outline"
              size="sm"
            >
              <Save className="mr-1 h-4 w-4" />
              Save Progress
            </Button>
          </div>
        </div>

        {/* Editable Form */}
        <div className="space-y-4">
          {headers.map((header, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 items-center">
              <label className="font-medium text-gray-700">{header}:</label>
              <div className="text-sm text-gray-500">
                Original: {dataRows[currentRowIndex - 1]?.[index] || ''}
              </div>
              <Input
                value={currentRowValues[index] || ''}
                onChange={(e) => handleValueChange(index, e.target.value)}
                placeholder={`Enter ${header}`}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <Button
            onClick={handlePrevious}
            disabled={currentRowIndex === 1}
            variant="outline"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleSkip}
              disabled={currentRowIndex === dataRows.length}
              variant="outline"
            >
              <SkipForward className="mr-1 h-4 w-4" />
              Skip
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentRowIndex === dataRows.length}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Sheet Preview</h3>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataRows.slice(0, 10).map((row, rowIndex) => {
                const isCurrentRow = rowIndex + 1 === currentRowIndex;
                const isRowModified = modifiedData[rowIndex] !== undefined;
                
                return (
                  <TableRow 
                    key={rowIndex}
                    className={`
                      ${isCurrentRow ? 'bg-blue-50 border-blue-200' : ''} 
                      ${isRowModified ? 'bg-green-50' : ''}
                    `}
                  >
                    <TableCell className="font-medium">
                      {rowIndex + 1}
                      {isRowModified && <span className="ml-1 text-green-600">✓</span>}
                    </TableCell>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="max-w-32 truncate">
                        {isRowModified && modifiedData[rowIndex] 
                          ? modifiedData[rowIndex].modifiedRow[cellIndex] || cell
                          : cell
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {dataRows.length > 10 && (
            <div className="text-center py-2 text-gray-500 text-sm">
              Showing first 10 rows of {dataRows.length} total rows
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SheetDataEditor;
