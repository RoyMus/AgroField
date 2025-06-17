
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ModifiedCellData {
  originalValue: string;
  modifiedValue: string;
  rowIndex: number;
  columnIndex: number;
}

interface DataPreviewTableProps {
  headers: string[];
  dataRows: string[][];
  currentRowIndex: number;
  currentColumnIndex: number;
  currentValue: string;
  modifiedData: Record<string, ModifiedCellData>;
}

const DataPreviewTable = ({
  headers,
  dataRows,
  currentRowIndex,
  currentColumnIndex,
  currentValue,
  modifiedData,
}: DataPreviewTableProps) => {
  const getCellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}-${columnIndex}`;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-4">Sheet Preview</h3>
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {headers.map((header, index) => (
                <TableHead key={index} className={index === currentColumnIndex ? 'bg-blue-100' : ''}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataRows.slice(0, 10).map((row, rowIndex) => {
              const isCurrentRow = rowIndex === currentRowIndex;
              
              return (
                <TableRow 
                  key={rowIndex}
                  className={isCurrentRow ? 'bg-blue-50 border-blue-200' : ''}
                >
                  <TableCell className="font-medium">
                    {rowIndex + 1}
                  </TableCell>
                  {row.map((cell, cellIndex) => {
                    const cellKey = getCellKey(rowIndex, cellIndex);
                    const isCellModified = modifiedData[cellKey] !== undefined;
                    const isCurrentCell = isCurrentRow && cellIndex === currentColumnIndex;
                    
                    // Show current value if it's the current cell and has been modified
                    const displayValue = isCurrentCell && currentValue !== (dataRows[rowIndex][cellIndex] || '') 
                      ? currentValue 
                      : isCellModified 
                      ? modifiedData[cellKey].modifiedValue 
                      : cell;
                    
                    return (
                      <TableCell 
                        key={cellIndex} 
                        className={`max-w-32 truncate ${
                          isCurrentCell ? 'bg-blue-200 font-semibold' : 
                          isCellModified ? 'bg-green-50 text-green-800' : ''
                        }`}
                      >
                        {displayValue}
                        {(isCellModified || (isCurrentCell && currentValue !== (dataRows[rowIndex][cellIndex] || ''))) && 
                          <span className="ml-1 text-green-600">✓</span>
                        }
                      </TableCell>
                    );
                  })}
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
  );
};

export default DataPreviewTable;
